/**
 * Living semantic layer pipeline on the embedded store:
 *   Extract → Resolve → Detect novelty → Propose → Apply
 */
import { embed } from "@/lib/embeddings";
import { upsertEmbedding } from "@/lib/embeddings/store";
import { extractFromText, type ExtractionResult } from "@/lib/llm";
import { DEMO_CHURN_CUSTOMER_ID } from "@/lib/demo-constants";
import { ensureStore } from "@/lib/store/runtime";
import { getStore, nodeId } from "@/lib/store/types";

export type Mutation =
  | { kind: "create_concept"; name: string; description: string }
  | { kind: "create_synonym"; from: string; to: string; note: string }
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
  | { kind: "link_mentions"; reviewId: string; concepts: string[] };

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

export async function proposeIngest(opts: {
  text: string;
  source: "email" | "review" | "support";
  customerId?: string;
  productSku?: string;
  rating?: number;
}): Promise<IngestProposal> {
  await ensureStore();
  const store = getStore();
  const extraction = await extractFromText(opts.text, opts.source);
  const before = store.counts();

  const knownConcepts: string[] = [];
  const novelConcepts: string[] = [];
  for (const name of extraction.concepts) {
    const exists = store
      .byLabel("Concept")
      .some((c) => String(c.props.name).toLowerCase() === name.toLowerCase());
    if (exists) knownConcepts.push(name);
    else novelConcepts.push(name);
  }

  const customerId =
    opts.customerId ??
    (opts.source === "email" || /cancel/i.test(opts.text)
      ? DEMO_CHURN_CUSTOMER_ID
      : "CUST-010");
  const productSku =
    opts.productSku ??
    (/\bwindbreaker\b|aerolite/i.test(opts.text) ? "SKU-0004" : null);

  const mutations: Mutation[] = [];
  const narrative: string[] = [
    `Extracted concepts=[${extraction.concepts.join(", ")}] sentiment=${extraction.sentiment}`,
  ];

  const ASPECT_BLOCKLIST = new Set(["sizing", "warmth", "weight", "soft"]);
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
      rating:
        opts.rating ??
        (extraction.sentiment === "positive"
          ? 5
          : extraction.sentiment === "negative"
            ? 2
            : 3),
      text: opts.text,
      sentiment: extraction.sentiment,
    });
    const mentionConcepts = [...knownConcepts, ...novelProductConcepts];
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
      const cust = store.get(nodeId("Customer", customerId));
      const from = Number(cust?.props.churn_risk ?? 0.5);
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
    }

    if (opts.source === "support" && extraction.aspects.includes("sizing")) {
      if (
        !mutations.some((m) => m.kind === "create_signal" && m.type === "size_issue")
      ) {
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
    beforeCounts: { nodes: before.totalNodes, edges: before.totalEdges },
    narrative,
  };
}

export async function applyIngest(
  proposal: IngestProposal
): Promise<IngestApplyResult> {
  await ensureStore();
  const store = getStore();
  const newNodeIds: string[] = [];
  const newLinkKeys: string[] = [];
  let churnBefore: number | undefined;
  let churnAfter: number | undefined;
  let customerId: string | undefined;

  for (const m of proposal.mutations) {
    if (m.kind === "create_concept") {
      const id = nodeId("Concept", m.name);
      store.upsertNode({
        id,
        label: "Concept",
        props: { name: m.name, description: m.description, learned: true },
      });
      newNodeIds.push(id);
    } else if (m.kind === "create_synonym") {
      const fromId = nodeId("Concept", m.from);
      const toId = nodeId("Concept", m.to);
      store.mergeEdge("SYNONYM_OF", fromId, toId);
      newLinkKeys.push(`${fromId}|SYNONYM_OF|${toId}`);
      // Inherit MAPS_TO from synonym target (+ its synonym roots)
      const roots = store.expandSynonyms(toId, 2);
      for (const root of roots) {
        for (const attr of store.neighbors(root.id, "MAPS_TO", "out")) {
          store.mergeEdge("MAPS_TO", fromId, attr.id);
        }
      }
      newNodeIds.push(fromId);
    } else if (m.kind === "create_review") {
      const id = nodeId("Review", m.id);
      store.upsertNode({
        id,
        label: "Review",
        props: {
          id: m.id,
          rating: m.rating,
          text: m.text,
          sentiment: m.sentiment,
          created_at: new Date().toISOString().slice(0, 10),
        },
      });
      store.mergeEdge("WROTE", nodeId("Customer", m.customerId), id);
      store.mergeEdge("ABOUT", id, nodeId("Product", m.productSku));
      newNodeIds.push(id);
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
        const cid = nodeId("Concept", concept);
        if (!store.get(cid)) continue;
        store.mergeEdge("MENTIONS", nodeId("Review", m.reviewId), cid);
        newLinkKeys.push(
          `Review:${m.reviewId}|MENTIONS|Concept:${concept}`
        );
      }
    } else if (m.kind === "create_signal") {
      const id = nodeId("Signal", m.id);
      store.upsertNode({
        id,
        label: "Signal",
        props: {
          id: m.id,
          type: m.type,
          value: m.value,
          source: m.source,
          created_at: new Date().toISOString().slice(0, 10),
        },
      });
      store.mergeEdge("EXPRESSED", nodeId("Customer", m.customerId), id);
      if (m.productSku) {
        store.mergeEdge("REGARDS", id, nodeId("Product", m.productSku));
      }
      newNodeIds.push(id);
      customerId = m.customerId;
    } else if (m.kind === "update_churn_risk") {
      churnBefore = m.from;
      churnAfter = m.to;
      customerId = m.customerId;
      const cust = store.get(nodeId("Customer", m.customerId));
      if (cust) cust.props.churn_risk = m.to;
    }
  }

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

  const after = store.counts();
  return {
    applied: proposal.mutations,
    afterCounts: { nodes: after.totalNodes, edges: after.totalEdges },
    newNodeIds,
    newLinkKeys,
    churnBefore,
    churnAfter,
    customerId,
  };
}
