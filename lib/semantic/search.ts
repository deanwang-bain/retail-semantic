/**
 * Concept resolution — semantic layer over the embedded graph store.
 */
import { embed } from "@/lib/embeddings";
import { similarEntities } from "@/lib/embeddings/store";
import { detectConceptsInText, parseQuery } from "@/lib/llm";
import { ensureStore } from "@/lib/store/runtime";
import { getStore, nodeId } from "@/lib/store/types";

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

export async function resolveConceptsToAttributes(concepts: string[]): Promise<{
  resolvedConcepts: string[];
  attributes: Array<{ name: string; value: string; uid: string; via: string }>;
  unmapped: string[];
}> {
  await ensureStore();
  const store = getStore();
  if (concepts.length === 0) {
    return { resolvedConcepts: [], attributes: [], unmapped: [] };
  }

  const attributes: Array<{
    name: string;
    value: string;
    uid: string;
    via: string;
  }> = [];
  const resolvedConcepts: string[] = [];
  const unmapped: string[] = [];
  const seen = new Set<string>();

  for (const cname of concepts) {
    const concept = store
      .byLabel("Concept")
      .find(
        (c) => String(c.props.name).toLowerCase() === cname.toLowerCase()
      );
    if (!concept) {
      unmapped.push(cname);
      continue;
    }
    const expanded = store.expandSynonyms(concept.id, 2);
    for (const root of expanded) {
      resolvedConcepts.push(String(root.props.name));
      for (const attr of store.neighbors(root.id, "MAPS_TO", "out")) {
        const uid = String(attr.props.uid);
        if (seen.has(uid)) continue;
        seen.add(uid);
        attributes.push({
          name: String(attr.props.name),
          value: String(attr.props.value),
          uid,
          via: String(root.props.name),
        });
      }
    }
  }

  return {
    resolvedConcepts: Array.from(new Set(resolvedConcepts)),
    attributes,
    unmapped,
  };
}

export async function semanticProductSearch(
  rawQuery: string
): Promise<SearchResult> {
  await ensureStore();
  const store = getStore();
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

  const attrUids = attributes.map((a) => a.uid);
  const scoreMap = new Map<string, { score: number; matched: string[] }>();

  if (attrUids.length > 0) {
    for (const product of store.byLabel("Product")) {
      const matched: string[] = [];
      for (const attr of store.neighbors(product.id, "HAS_ATTRIBUTE", "out")) {
        const uid = String(attr.props.uid);
        if (attrUids.includes(uid)) matched.push(uid);
      }
      if (matched.length) {
        scoreMap.set(product.id, { score: matched.length, matched });
      }
    }
  }

  const graphHits: ProductHit[] = [];
  for (const [pid, { score, matched }] of scoreMap) {
    const p = store.get(pid)!;
    const cat = store.neighbors(pid, "IN_CATEGORY", "out")[0];
    graphHits.push({
      sku: String(p.props.sku),
      name: String(p.props.name),
      brand: String(p.props.brand),
      price: Number(p.props.price),
      currency: String(p.props.currency),
      description: String(p.props.description),
      category: cat ? String(cat.props.name) : undefined,
      score,
      matchedAttributes: matched,
    });
  }
  graphHits.sort((a, b) => b.score - a.score);

  trace.push({
    step: "3. Graph attribute match",
    detail: `Product→HAS_ATTRIBUTE where uid IN [${attrUids.join(", ") || "∅"}] → ${graphHits.length} products`,
  });

  const [queryVec] = await embed([rawQuery]);
  const similar = await similarEntities({
    embedding: queryVec,
    entityType: "product",
    limit: 15,
  });
  trace.push({
    step: "4. Vector similarity (in-process)",
    detail: `Top neighbours: ${similar
      .slice(0, 5)
      .map((s) => `${s.entity_id} (d=${s.distance.toFixed(3)})`)
      .join(", ")}`,
  });

  const bySku = new Map<string, ProductHit>();
  for (const hit of graphHits) {
    bySku.set(hit.sku, { ...hit, score: hit.score * 2 });
  }
  for (const s of similar) {
    const existing = bySku.get(s.entity_id);
    const vectorBoost = Math.max(0, 1 - s.distance) * 3;
    if (existing) {
      existing.score += vectorBoost;
      existing.vectorDistance = s.distance;
    } else {
      const p = store.get(nodeId("Product", s.entity_id));
      if (!p) continue;
      const cat = store.neighbors(p.id, "IN_CATEGORY", "out")[0];
      const penalty = unmapped.length > 0 && attrUids.length === 0 ? 0.35 : 1;
      bySku.set(s.entity_id, {
        sku: String(p.props.sku),
        name: String(p.props.name),
        brand: String(p.props.brand),
        price: Number(p.props.price),
        currency: String(p.props.currency),
        description: String(p.props.description),
        category: cat ? String(cat.props.name) : undefined,
        score: vectorBoost * penalty,
        matchedAttributes: [],
        vectorDistance: s.distance,
      });
    }
  }

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

  if (unmapped.length > 0) {
    for (const hit of bySku.values()) hit.score *= 0.55;
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
    detail: `Attribute overlap ×2 + vector ×3 → top ${products.length}`,
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
