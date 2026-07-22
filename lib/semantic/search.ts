/**
 * Concept resolution — the heart of the semantic layer.
 *
 * Fuzzy language → Concept nodes → (SYNONYM_OF*) → MAPS_TO → Attribute → Product
 */
import { getSession } from "@/lib/ontology/neo4j";
import { embed } from "@/lib/embeddings";
import { similarEntities } from "@/lib/embeddings/store";
import { detectConceptsInText, parseQuery } from "@/lib/llm";

export type ResolutionStep = {
  step: string;
  detail: string;
  data?: unknown;
};

export type ProductHit = {
  sku: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  description: string;
  category?: string;
  score: number;
  matchedAttributes: string[];
  vectorDistance?: number;
};

export type SearchResult = {
  query: string;
  concepts: string[];
  attributes: string[];
  products: ProductHit[];
  trace: ResolutionStep[];
  mode: "live" | "simulated";
};

/** Expand concepts through SYNONYM_OF, then collect MAPS_TO attributes. */
export async function resolveConceptsToAttributes(concepts: string[]): Promise<{
  resolvedConcepts: string[];
  attributes: Array<{ name: string; value: string; uid: string; via: string }>;
  unmapped: string[];
}> {
  if (concepts.length === 0) {
    return { resolvedConcepts: [], attributes: [], unmapped: [] };
  }
  const session = getSession();
  try {
    const result = await session.run(
      `
      UNWIND $concepts AS cname
      OPTIONAL MATCH (c:Concept)
        WHERE toLower(c.name) = toLower(cname)
      OPTIONAL MATCH path = (c)-[:SYNONYM_OF*0..2]->(root:Concept)
      OPTIONAL MATCH (root)-[:MAPS_TO]->(a:Attribute)
      RETURN cname,
             c.name AS matched,
             collect(DISTINCT root.name) AS expanded,
             collect(DISTINCT {name: a.name, value: a.value, uid: a.uid, via: root.name}) AS attrs
      `,
      { concepts }
    );

    const attributes: Array<{
      name: string;
      value: string;
      uid: string;
      via: string;
    }> = [];
    const resolvedConcepts: string[] = [];
    const unmapped: string[] = [];
    const seen = new Set<string>();

    for (const rec of result.records) {
      const cname = rec.get("cname") as string;
      const matched = rec.get("matched") as string | null;
      if (!matched) {
        unmapped.push(cname);
        continue;
      }
      resolvedConcepts.push(matched);
      const expanded = (rec.get("expanded") as string[]).filter(Boolean);
      resolvedConcepts.push(...expanded);
      const attrs = rec.get("attrs") as Array<{
        name: string | null;
        value: string | null;
        uid: string | null;
        via: string | null;
      }>;
      for (const a of attrs) {
        if (!a?.uid) continue;
        if (seen.has(a.uid)) continue;
        seen.add(a.uid);
        attributes.push({
          name: a.name!,
          value: a.value!,
          uid: a.uid,
          via: a.via ?? matched,
        });
      }
    }

    return {
      resolvedConcepts: Array.from(new Set(resolvedConcepts)),
      attributes,
      unmapped,
    };
  } finally {
    await session.close();
  }
}

export async function semanticProductSearch(
  rawQuery: string
): Promise<SearchResult> {
  const trace: ResolutionStep[] = [];
  const intent = await parseQuery(rawQuery);
  const mode = process.env.ANTHROPIC_API_KEY ? "live" : "simulated";

  const concepts =
    intent.kind === "product_search"
      ? intent.concepts
      : detectConceptsInText(rawQuery);

  trace.push({
    step: "1. Parse query",
    detail: `Intent=${intent.kind}; concepts detected: [${concepts.join(", ") || "none"}]`,
    data: intent,
  });

  const { resolvedConcepts, attributes, unmapped } =
    await resolveConceptsToAttributes(concepts);

  trace.push({
    step: "2. Resolve concepts → attributes (semantic layer)",
    detail:
      unmapped.length > 0
        ? `Mapped ${attributes.length} attributes via ${resolvedConcepts.join(", ")}. UNMAPPED: [${unmapped.join(", ")}] — no MAPS_TO / SYNONYM yet.`
        : `Mapped ${attributes.length} attributes via ${resolvedConcepts.join(", ") || "—"}`,
    data: { resolvedConcepts, attributes, unmapped },
  });

  // Graph: products matching resolved attributes (score by overlap)
  const attrUids = attributes.map((a) => a.uid);
  const session = getSession();
  let graphHits: ProductHit[] = [];
  try {
    if (attrUids.length > 0) {
      const result = await session.run(
        `
        MATCH (p:Product)-[:HAS_ATTRIBUTE]->(a:Attribute)
        WHERE a.uid IN $uids
        OPTIONAL MATCH (p)-[:IN_CATEGORY]->(cat:Category)
        WITH p, cat, collect(DISTINCT a.uid) AS matched, size(collect(DISTINCT a.uid)) AS score
        RETURN p, cat.name AS category, matched, score
        ORDER BY score DESC
        LIMIT 20
        `,
        { uids: attrUids }
      );
      graphHits = result.records.map((rec) => {
        const p = rec.get("p").properties;
        return {
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          price: p.price,
          currency: p.currency,
          description: p.description,
          category: rec.get("category") ?? undefined,
          score: Number(rec.get("score")),
          matchedAttributes: rec.get("matched") as string[],
        };
      });
    }
    trace.push({
      step: "3. Cypher attribute match",
      detail: `MATCH (Product)-[:HAS_ATTRIBUTE]->(Attribute) WHERE uid IN [${attrUids.join(", ") || "∅"}] → ${graphHits.length} products`,
    });
  } finally {
    await session.close();
  }

  // Vector similarity over product descriptions
  const [queryVec] = await embed([rawQuery]);
  const similar = await similarEntities({
    embedding: queryVec,
    entityType: "product",
    limit: 15,
  });
  trace.push({
    step: "4. pgvector similarity",
    detail: `Top vector neighbours: ${similar
      .slice(0, 5)
      .map((s) => `${s.entity_id} (d=${s.distance.toFixed(3)})`)
      .join(", ")}`,
  });

  // Hybrid rank: graph score + vector boost
  const bySku = new Map<string, ProductHit>();
  for (const hit of graphHits) {
    bySku.set(hit.sku, { ...hit, score: hit.score * 2 });
  }

  const session2 = getSession();
  try {
    for (const s of similar) {
      const existing = bySku.get(s.entity_id);
      const vectorBoost = Math.max(0, 1 - s.distance) * 3;
      if (existing) {
        existing.score += vectorBoost;
        existing.vectorDistance = s.distance;
      } else {
        const result = await session2.run(
          `MATCH (p:Product {sku: $sku})
           OPTIONAL MATCH (p)-[:IN_CATEGORY]->(cat:Category)
           RETURN p, cat.name AS category`,
          { sku: s.entity_id }
        );
        if (result.records.length === 0) continue;
        const p = result.records[0].get("p").properties;
        // If concepts were unmapped (e.g. windbreaker), vector-only hits stay weak
        const penalty = unmapped.length > 0 && attrUids.length === 0 ? 0.35 : 1;
        bySku.set(s.entity_id, {
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          price: p.price,
          currency: p.currency,
          description: p.description,
          category: result.records[0].get("category") ?? undefined,
          score: vectorBoost * penalty,
          matchedAttributes: [],
          vectorDistance: s.distance,
        });
      }
    }
  } finally {
    await session2.close();
  }

  // Soft category / concept boosts
  const categoryHint =
    intent.kind === "product_search" ? intent.categoryHint : undefined;
  const hasJacketConcept = resolvedConcepts.some(
    (c) => c.toLowerCase() === "jacket"
  );
  if (categoryHint || hasJacketConcept) {
    for (const hit of bySku.values()) {
      if (
        hit.category === categoryHint ||
        ["Jackets", "Raincoats", "Fleeces"].includes(hit.category ?? "")
      ) {
        if (categoryHint === "Outerwear" || hasJacketConcept) hit.score += 1.2;
        else if (hit.category === categoryHint) hit.score += 0.8;
      }
    }
  }

  // When key concepts are unmapped (demo gap: windbreaker), suppress confidence
  if (unmapped.length > 0) {
    for (const hit of bySku.values()) {
      hit.score *= 0.55;
    }
    trace.push({
      step: "5a. Unmapped penalty",
      detail: `Penalised scores ×0.55 because unmapped concepts: [${unmapped.join(", ")}]`,
    });
  }

  const products = Array.from(bySku.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  trace.push({
    step: "5. Hybrid rank",
    detail: `Combined attribute overlap ×2 + vector similarity ×3${unmapped.length ? " (penalised: unmapped concepts)" : ""} → top ${products.length}`,
    data: products.map((p) => ({ sku: p.sku, score: p.score })),
  });

  return {
    query: rawQuery,
    concepts,
    attributes: attrUids,
    products,
    trace,
    mode: mode as "live" | "simulated",
  };
}
