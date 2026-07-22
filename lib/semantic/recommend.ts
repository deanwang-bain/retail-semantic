/**
 * UC4 — personalized recommendations via multi-hop ontology traversal.
 *
 * Path: Customer → Order → Product → Attribute ← Product (candidates)
 *     filtered by STOCKED_AT in the customer's region.
 */
import { getSession } from "@/lib/ontology/neo4j";

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
  const session = getSession();
  const trace: Array<{ step: string; detail: string }> = [];
  try {
    const cust = await session.run(
      `MATCH (c:Customer {id: $id}) RETURN c`,
      { id: customerId }
    );
    if (cust.records.length === 0) return null;
    const c = cust.records[0].get("c").properties;
    trace.push({
      step: "1. Customer",
      detail: `${c.name} · region=${c.region}`,
    });

    const history = await session.run(
      `
      MATCH (c:Customer {id: $id})-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)
      RETURN DISTINCT p
      `,
      { id: customerId }
    );
    const boughtSkus = history.records.map(
      (r) => r.get("p").properties.sku as string
    );
    trace.push({
      step: "2. Past products",
      detail: boughtSkus.join(", ") || "none",
    });

    if (boughtSkus.length === 0) {
      return {
        customerId: c.id,
        customerName: c.name,
        region: c.region,
        recommendations: [],
        trace: [
          ...trace,
          {
            step: "3. Multi-hop",
            detail: "No purchase history — nothing to traverse",
          },
        ],
      };
    }

    const recs = await session.run(
      `
      MATCH (bought:Product)
      WHERE bought.sku IN $bought
      MATCH (bought)-[:HAS_ATTRIBUTE]->(a:Attribute)<-[:HAS_ATTRIBUTE]-(cand:Product)
      WHERE NOT cand.sku IN $bought
      WITH cand, bought, collect(DISTINCT a.uid) AS sharedAttrs
      WITH cand,
           collect(DISTINCT bought.name)[0] AS becauseProduct,
           max(size(sharedAttrs)) AS attrOverlap,
           collect(DISTINCT sharedAttrs)[0] AS attrs
      OPTIONAL MATCH (cand)-[st:STOCKED_AT]->(s:Store)-[:IN_REGION]->(reg:Region {name: $region})
      WITH cand, becauseProduct, attrOverlap, attrs,
           sum(coalesce(st.qty, 0)) AS availableQty
      WHERE availableQty > 0 AND attrOverlap > 0
      OPTIONAL MATCH (cand)-[:IN_CATEGORY]->(cat:Category)
      RETURN cand, becauseProduct, attrs, availableQty, attrOverlap, cat.name AS category,
             (attrOverlap * 2.0) AS score
      ORDER BY score DESC, availableQty DESC
      LIMIT 8
      `,
      { bought: boughtSkus, region: c.region }
    );

    trace.push({
      step: "3. Multi-hop traversal",
      detail:
        "Product→HAS_ATTRIBUTE←Product, filtered by STOCKED_AT in customer region",
    });

    const conceptRes = await session.run(
      `
      MATCH (c:Customer {id: $id})-[:WROTE]->(r:Review)-[:MENTIONS]->(concept:Concept)
      WHERE r.sentiment = 'positive' OR r.rating >= 4
      RETURN collect(DISTINCT concept.name) AS concepts
      `,
      { id: customerId }
    );
    const posConcepts =
      (conceptRes.records[0]?.get("concepts") as string[]) ?? [];

    const recommendations: Recommendation[] = recs.records.map((rec) => {
      const p = rec.get("cand").properties;
      const becauseProduct = rec.get("becauseProduct") as string;
      const attrs = ((rec.get("attrs") as string[]) ?? []).filter(Boolean);
      const viaConcept = posConcepts[0] ?? null;
      const why = viaConcept
        ? `because you bought ${becauseProduct} and reviewed concepts like “${viaConcept}” positively`
        : `because you bought ${becauseProduct} sharing attributes [${attrs
            .slice(0, 3)
            .join(", ")}]`;
      const path = `Customer→Order→${becauseProduct}→Attribute[${attrs
        .slice(0, 2)
        .join(",")}]←${p.name}→STOCKED_AT→${c.region}`;
      return {
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        price: p.price,
        description: p.description,
        why,
        path,
        score: Number(rec.get("score")),
        availableQty: Number(rec.get("availableQty")),
      };
    });

    trace.push({
      step: "4. Rank & explain",
      detail: `${recommendations.length} candidates with regional availability`,
    });

    return {
      customerId: c.id,
      customerName: c.name,
      region: c.region,
      recommendations,
      trace,
    };
  } finally {
    await session.close();
  }
}
