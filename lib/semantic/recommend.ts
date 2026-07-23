/**
 * UC4 — recommendations via multi-hop traversal on the embedded store.
 */
import { ensureStore } from "@/lib/store/runtime";
import { getStore, nodeId } from "@/lib/store/types";

export type Recommendation = {
  sku: string;
  name: string;
  brand: string;
  price: number;
  description: string;
  why: string;
  path: string;
  score: number;
  availableQty: number;
};

export type RecommendResult = {
  customerId: string;
  customerName: string;
  region: string;
  recommendations: Recommendation[];
  trace: Array<{ step: string; detail: string }>;
};

export async function recommendForCustomer(
  customerId: string
): Promise<RecommendResult | null> {
  await ensureStore();
  const store = getStore();
  const c = store.get(nodeId("Customer", customerId));
  if (!c) return null;
  const trace: Array<{ step: string; detail: string }> = [];
  const region = String(c.props.region);
  trace.push({
    step: "1. Customer",
    detail: `${c.props.name} · region=${region}`,
  });

  const bought = store
    .neighbors(c.id, "PLACED", "out")
    .flatMap((o) => store.neighbors(o.id, "CONTAINS", "out"));
  const boughtSkus = Array.from(
    new Set(bought.map((p) => String(p.props.sku)))
  );
  trace.push({
    step: "2. Past products",
    detail: boughtSkus.join(", ") || "none",
  });

  if (boughtSkus.length === 0) {
    return {
      customerId: String(c.props.id),
      customerName: String(c.props.name),
      region,
      recommendations: [],
      trace: [
        ...trace,
        { step: "3. Multi-hop", detail: "No purchase history" },
      ],
    };
  }

  const boughtSet = new Set(boughtSkus);
  const candScores = new Map<
    string,
    { score: number; attrs: Set<string>; because: string; qty: number }
  >();

  for (const sku of boughtSkus) {
    const boughtNode = store.get(nodeId("Product", sku))!;
    const attrs = store.neighbors(boughtNode.id, "HAS_ATTRIBUTE", "out");
    for (const attr of attrs) {
      for (const cand of store.neighbors(attr.id, "HAS_ATTRIBUTE", "in")) {
        const csku = String(cand.props.sku);
        if (boughtSet.has(csku)) continue;
        // regional stock
        let qty = 0;
        for (const e of store.outEdges(cand.id, "STOCKED_AT")) {
          const s = store.get(e.to);
          if (!s) continue;
          const reg = store.neighbors(s.id, "IN_REGION", "out")[0];
          if (reg && String(reg.props.name) === region) {
            qty += Number(e.props?.qty ?? 0);
          }
        }
        if (qty <= 0) continue;
        const cur = candScores.get(csku) ?? {
          score: 0,
          attrs: new Set<string>(),
          because: String(boughtNode.props.name),
          qty: 0,
        };
        cur.score += 2;
        cur.attrs.add(String(attr.props.uid));
        cur.qty = Math.max(cur.qty, qty);
        candScores.set(csku, cur);
      }
    }
  }

  const posConcepts: string[] = [];
  for (const rev of store.neighbors(c.id, "WROTE", "out")) {
    if (
      String(rev.props.sentiment) === "positive" ||
      Number(rev.props.rating) >= 4
    ) {
      for (const concept of store.neighbors(rev.id, "MENTIONS", "out")) {
        posConcepts.push(String(concept.props.name));
      }
    }
  }

  trace.push({
    step: "3. Multi-hop traversal",
    detail:
      "Product→HAS_ATTRIBUTE←Product, filtered by STOCKED_AT in customer region",
  });

  const recommendations: Recommendation[] = Array.from(candScores.entries())
    .map(([sku, meta]) => {
      const p = store.get(nodeId("Product", sku))!;
      const attrs = Array.from(meta.attrs);
      const viaConcept = posConcepts[0] ?? null;
      const why = viaConcept
        ? `because you bought ${meta.because} and reviewed concepts like “${viaConcept}” positively`
        : `because you bought ${meta.because} sharing attributes [${attrs.slice(0, 3).join(", ")}]`;
      return {
        sku,
        name: String(p.props.name),
        brand: String(p.props.brand),
        price: Number(p.props.price),
        description: String(p.props.description),
        why,
        path: `Customer→Order→${meta.because}→Attribute[${attrs.slice(0, 2).join(",")}]←${p.props.name}→STOCKED_AT→${region}`,
        score: meta.score,
        availableQty: meta.qty,
      };
    })
    .sort((a, b) => b.score - a.score || b.availableQty - a.availableQty)
    .slice(0, 8);

  trace.push({
    step: "4. Rank & explain",
    detail: `${recommendations.length} candidates with regional availability`,
  });

  return {
    customerId: String(c.props.id),
    customerName: String(c.props.name),
    region,
    recommendations,
    trace,
  };
}
