/**
 * Living semantic layer pipeline:
 *   Extract → Resolve/entity-link → Detect novelty → Propose mutations → Apply
 *
 * The demo climax: learning that "windbreaker" SYNONYM_OF jacket
 * inherits jacket's (and related) MAPS_TO edges — and churn signals propagate.
 */
import { getSession } from "@/lib/ontology/neo4j";
import { embed } from "@/lib/embeddings";
import { upsertEmbedding } from "@/lib/embeddings/store";
import { extractFromText, type ExtractionResult } from "@/lib/llm";
import { DEMO_CHURN_CUSTOMER_ID } from "@/lib/demo-constants";

export type Mutation =
  | {
      kind: "create_concept";
      name: string;
      description: string;
    }
  | {
      kind: "create_synonym";
      from: string;
      to: string;
      note: string;
    }
  | {
      kind: "create_review";
      id: string;
      customerId: string;
      productSku: string;
      rating: number;
      text: string;
      sentiment: string;
    }
  | {
      kind: "create_signal";
      id: string;
      customerId: string;
      type: string;
      value: string;
      source: string;
      productSku?: string;
    }
  | {
      kind: "update_churn_risk";
      customerId: string;
      from: number;
      to: number;
      reason: string;
    }
  | {
      kind: "link_mentions";
      reviewId: string;
      concepts: string[];
    };

export type IngestProposal = {
  extraction: ExtractionResult;
  resolved: {
    customerId: string | null;
    productSku: string | null;
    knownConcepts: string[];
    novelConcepts: string[];
  };
  mutations: Mutation[];
  beforeCounts: { nodes: number; edges: number };
  narrative: string[];
};

export type IngestApplyResult = {
  applied: Mutation[];
  afterCounts: { nodes: number; edges: number };
  newNodeIds: string[];
  newLinkKeys: string[];
  churnBefore?: number;
  churnAfter?: number;
  customerId?: string;
};

export const PRESET_INPUTS = {
  email: {
    label: "Customer email",
    source: "email" as const,
    text: "Hi, I'm thinking of cancelling — the windbreaker I bought leaks in the rain and the sizing was way off.",
    customerId: DEMO_CHURN_CUSTOMER_ID,
    productSku: "SKU-0004",
  },
  review: {
    label: "Product review",
    source: "review" as const,
    text: "Perfect windbreaker for Manila's sudden downpours, super light.",
    customerId: "CUST-010",
    productSku: "SKU-0004",
    rating: 5,
  },
  support: {
    label: "Support comment",
    source: "support" as const,
    text: "Customer called about sizing on the AeroLite Shell — said it ran a full size small and wants an exchange.",
    customerId: "CUST-003",
    productSku: "SKU-0004",
  },
};

async function countGraph(): Promise<{ nodes: number; edges: number }> {
  const session = getSession();
  try {
    const n = await session.run(`MATCH (n) RETURN count(n) AS c`);
    const e = await session.run(`MATCH ()-[r]->() RETURN count(r) AS c`);
    return {
      nodes: Number(n.records[0].get("c")),
      edges: Number(e.records[0].get("c")),
    };
  } finally {
    await session.close();
  }
}

export async function proposeIngest(opts: {
  text: string;
  source: "email" | "review" | "support";
  customerId?: string;
  productSku?: string;
  rating?: number;
}): Promise<IngestProposal> {
  const extraction = await extractFromText(opts.text, opts.source);
  const beforeCounts = await countGraph();

  const session = getSession();
  const knownConcepts: string[] = [];
  const novelConcepts: string[] = [];
  try {
    const conceptCheck = await session.run(
      `
      UNWIND $names AS name
      OPTIONAL MATCH (c:Concept)
        WHERE toLower(c.name) = toLower(name)
      RETURN name, c.name AS existing
      `,
      { names: extraction.concepts }
    );
    for (const rec of conceptCheck.records) {
      const name = rec.get("name") as string;
      if (rec.get("existing")) knownConcepts.push(name);
      else novelConcepts.push(name);
    }
  } finally {
    await session.close();
  }

  // Entity link defaults for demo presets
  const customerId = opts.customerId ?? guessCustomer(opts.text, opts.source);
  const productSku =
    opts.productSku ??
    (/\bwindbreaker\b|aerolite/i.test(opts.text) ? "SKU-0004" : null);

  const mutations: Mutation[] = [];
  const narrative: string[] = [];

  narrative.push(
    `Extracted concepts=[${extraction.concepts.join(", ")}] sentiment=${extraction.sentiment}`
  );

  // Novelty: only treat product-ish concepts as graph Concepts (not aspects)
  const ASPECT_BLOCKLIST = new Set([
    "sizing",
    "warmth",
    "weight",
    "soft",
  ]);
  const novelProductConcepts = novelConcepts.filter(
    (c) => !ASPECT_BLOCKLIST.has(c.toLowerCase())
  );

  for (const novel of novelProductConcepts) {
    mutations.push({
      kind: "create_concept",
      name: novel,
      description: `Learned from ${opts.source}: “${opts.text.slice(0, 80)}…”`,
    });
    if (novel.toLowerCase() === "windbreaker") {
      mutations.push({
        kind: "create_synonym",
        from: novel,
        to: "jacket",
        note: "Inherit jacket MAPS_TO edges; windbreaker was the intentional seed gap.",
      });
      // Reviews mentioning rain also imply waterproof — add direct MAPS_TO via synonym to waterproof
      if (/rain|downpour|leak|waterproof/i.test(opts.text)) {
        mutations.push({
          kind: "create_synonym",
          from: novel,
          to: "waterproof",
          note: "Context: rain/downpour in source text → also align with waterproof.",
        });
      }
      narrative.push(
        "Novelty: “windbreaker” is unmapped → propose SYNONYM_OF → jacket (+ waterproof from rain context)."
      );
    } else {
      const target =
        knownConcepts.filter((k) => !ASPECT_BLOCKLIST.has(k))[0] ??
        extraction.concepts.find(
          (c) =>
            !novelConcepts.includes(c) && !ASPECT_BLOCKLIST.has(c.toLowerCase())
        ) ??
        "casual";
      mutations.push({
        kind: "create_synonym",
        from: novel,
        to: target,
        note: `Heuristic synonym → ${target}`,
      });
    }
  }

  if (opts.source === "review" && customerId && productSku) {
    const reviewId = `REV-INGEST-${Date.now()}`;
    mutations.push({
      kind: "create_review",
      id: reviewId,
      customerId,
      productSku,
      rating: opts.rating ?? (extraction.sentiment === "positive" ? 5 : extraction.sentiment === "negative" ? 2 : 3),
      text: opts.text,
      sentiment: extraction.sentiment,
    });
    const mentionConcepts = [
      ...knownConcepts,
      ...novelConcepts,
    ].filter((c) => c !== "sizing");
    if (mentionConcepts.length) {
      mutations.push({
        kind: "link_mentions",
        reviewId,
        concepts: mentionConcepts,
      });
    }
    narrative.push(`Propose Review node linked to ${customerId} / ${productSku}`);
  }

  if (customerId) {
    for (const signal of extraction.signals) {
      mutations.push({
        kind: "create_signal",
        id: `SIG-INGEST-${signal.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId,
        type: signal.type,
        value: signal.value,
        source: opts.source,
        productSku: productSku ?? undefined,
      });
      narrative.push(`Propose Signal:${signal.type} on ${customerId}`);
    }

    if (
      extraction.signals.some((s) => s.type === "intent_to_churn") ||
      (opts.source === "email" && extraction.sentiment === "negative")
    ) {
      const session2 = getSession();
      try {
        const risk = await session2.run(
          `MATCH (c:Customer {id: $id}) RETURN c.churn_risk AS risk`,
          { id: customerId }
        );
        const from = Number(risk.records[0]?.get("risk") ?? 0.5);
        const to = Math.min(0.98, Math.round((from + 0.25) * 100) / 100);
        mutations.push({
          kind: "update_churn_risk",
          customerId,
          from,
          to,
          reason: "Cancellation intent / negative email ingested",
        });
        narrative.push(
          `Churn risk ${from} → ${to} (will be visible in UC2 for ${customerId})`
        );
      } finally {
        await session2.close();
      }
    }

    // Support sizing complaint also raises mild risk + signal
    if (opts.source === "support" && extraction.aspects.includes("sizing")) {
      if (!mutations.some((m) => m.kind === "create_signal" && m.type === "size_issue")) {
        mutations.push({
          kind: "create_signal",
          id: `SIG-INGEST-size-${Date.now()}`,
          customerId,
          type: "size_issue",
          value: "support sizing complaint",
          source: "support",
          productSku: productSku ?? undefined,
        });
      }
    }
  }

  return {
    extraction,
    resolved: {
      customerId,
      productSku,
      knownConcepts,
      novelConcepts,
    },
    mutations,
    beforeCounts,
    narrative,
  };
}

function guessCustomer(
  text: string,
  source: string
): string | null {
  if (source === "email" || /cancel/i.test(text)) return DEMO_CHURN_CUSTOMER_ID;
  return "CUST-010";
}

export async function applyIngest(
  proposal: IngestProposal
): Promise<IngestApplyResult> {
  const session = getSession();
  const newNodeIds: string[] = [];
  const newLinkKeys: string[] = [];
  let churnBefore: number | undefined;
  let churnAfter: number | undefined;
  let customerId: string | undefined;

  try {
    for (const m of proposal.mutations) {
      if (m.kind === "create_concept") {
        await session.run(
          `MERGE (c:Concept {name: $name})
           SET c.description = $description, c.learned = true`,
          { name: m.name, description: m.description }
        );
        newNodeIds.push(`Concept:${m.name}`);
      } else if (m.kind === "create_synonym") {
        await session.run(
          `
          MATCH (from:Concept {name: $from}), (to:Concept {name: $to})
          MERGE (from)-[:SYNONYM_OF]->(to)
          WITH from, to
          // Inherit MAPS_TO from the synonym target (and its synonym roots)
          OPTIONAL MATCH (to)-[:SYNONYM_OF*0..2]->(root:Concept)-[:MAPS_TO]->(a:Attribute)
          FOREACH (_ IN CASE WHEN a IS NULL THEN [] ELSE [1] END |
            MERGE (from)-[:MAPS_TO]->(a)
          )
          `,
          { from: m.from, to: m.to }
        );
        newLinkKeys.push(`Concept:${m.from}|SYNONYM_OF|Concept:${m.to}`);
        newNodeIds.push(`Concept:${m.from}`);
      } else if (m.kind === "create_review") {
        await session.run(
          `
          MATCH (c:Customer {id: $customerId}), (p:Product {sku: $productSku})
          MERGE (r:Review {id: $id})
          SET r.rating = $rating, r.text = $text, r.sentiment = $sentiment,
              r.created_at = $created_at
          MERGE (c)-[:WROTE]->(r)
          MERGE (r)-[:ABOUT]->(p)
          `,
          {
            ...m,
            created_at: new Date().toISOString().slice(0, 10),
          }
        );
        newNodeIds.push(`Review:${m.id}`);
        // Embed review text
        const [vec] = await embed([m.text]);
        await upsertEmbedding({
          id: `review:${m.id}`,
          entityType: "review",
          entityId: m.id,
          content: m.text,
          embedding: vec,
        });
      } else if (m.kind === "link_mentions") {
        for (const concept of m.concepts) {
          await session.run(
            `
            MATCH (r:Review {id: $reviewId}), (c:Concept {name: $concept})
            MERGE (r)-[:MENTIONS]->(c)
            `,
            { reviewId: m.reviewId, concept }
          );
          newLinkKeys.push(`Review:${m.reviewId}|MENTIONS|Concept:${concept}`);
        }
      } else if (m.kind === "create_signal") {
        await session.run(
          `
          MATCH (c:Customer {id: $customerId})
          MERGE (s:Signal {id: $id})
          SET s.type = $type, s.value = $value, s.source = $source,
              s.created_at = $created_at
          MERGE (c)-[:EXPRESSED]->(s)
          `,
          {
            ...m,
            created_at: new Date().toISOString().slice(0, 10),
          }
        );
        if (m.productSku) {
          await session.run(
            `
            MATCH (s:Signal {id: $id}), (p:Product {sku: $sku})
            MERGE (s)-[:REGARDS]->(p)
            `,
            { id: m.id, sku: m.productSku }
          );
        }
        newNodeIds.push(`Signal:${m.id}`);
        customerId = m.customerId;
      } else if (m.kind === "update_churn_risk") {
        churnBefore = m.from;
        churnAfter = m.to;
        customerId = m.customerId;
        await session.run(
          `MATCH (c:Customer {id: $customerId}) SET c.churn_risk = $to`,
          { customerId: m.customerId, to: m.to }
        );
      }
    }

    // Embed newly created concepts
    for (const m of proposal.mutations) {
      if (m.kind === "create_concept") {
        const [vec] = await embed([`${m.name}. ${m.description}`]);
        await upsertEmbedding({
          id: `concept:${m.name}`,
          entityType: "concept",
          entityId: m.name,
          content: `${m.name}. ${m.description}`,
          embedding: vec,
        });
      }
    }
  } finally {
    await session.close();
  }

  const afterCounts = await countGraph();
  return {
    applied: proposal.mutations,
    afterCounts,
    newNodeIds,
    newLinkKeys,
    churnBefore,
    churnAfter,
    customerId,
  };
}
