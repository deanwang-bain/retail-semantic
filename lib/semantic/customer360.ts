/**
 * Customer 360 — aggregate orders, reviews, signals into a churn narrative.
 */
import { getSession } from "@/lib/ontology/neo4j";

export type CustomerProfile = {
  id: string;
  name: string;
  segment: string;
  lifetime_value: number;
  join_date: string;
  churn_risk: number;
  region: string;
  orders: Array<{
    id: string;
    date: string;
    total: number;
    channel: string;
    products: string[];
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    text: string;
    sentiment: string;
    created_at: string;
    product: string;
    concepts: string[];
  }>;
  signals: Array<{
    id: string;
    type: string;
    value: string;
    source: string;
    created_at: string;
    regards?: string;
  }>;
  riskDrivers: string[];
  timeline: Array<{ date: string; kind: string; label: string }>;
  trace: Array<{ step: string; detail: string }>;
};

export async function listCustomers(opts?: {
  atRiskOnly?: boolean;
}): Promise<
  Array<{
    id: string;
    name: string;
    segment: string;
    churn_risk: number;
    lifetime_value: number;
    region: string;
  }>
> {
  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (c:Customer)
      WHERE $atRiskOnly = false OR c.churn_risk >= 0.5 OR c.segment = 'At-risk'
      RETURN c
      ORDER BY c.churn_risk DESC, c.name
      `,
      { atRiskOnly: opts?.atRiskOnly ?? false }
    );
    return result.records.map((r) => {
      const c = r.get("c").properties;
      return {
        id: c.id,
        name: c.name,
        segment: c.segment,
        churn_risk: c.churn_risk,
        lifetime_value: c.lifetime_value,
        region: c.region,
      };
    });
  } finally {
    await session.close();
  }
}

export async function getCustomer360(customerId: string): Promise<CustomerProfile | null> {
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
      step: "1. Load customer node",
      detail: `${c.name} · segment=${c.segment} · churn_risk=${c.churn_risk}`,
    });

    const ordersRes = await session.run(
      `
      MATCH (c:Customer {id: $id})-[:PLACED]->(o:Order)-[:CONTAINS]->(p:Product)
      WITH o, collect(p.name) AS products
      RETURN o, products
      ORDER BY o.date DESC
      `,
      { id: customerId }
    );
    const orders = ordersRes.records.map((r) => {
      const o = r.get("o").properties;
      return {
        id: o.id,
        date: o.date,
        total: o.total,
        channel: o.channel,
        products: r.get("products") as string[],
      };
    });
    trace.push({
      step: "2. Traverse PLACED → CONTAINS",
      detail: `${orders.length} orders`,
    });

    const reviewsRes = await session.run(
      `
      MATCH (c:Customer {id: $id})-[:WROTE]->(r:Review)-[:ABOUT]->(p:Product)
      OPTIONAL MATCH (r)-[:MENTIONS]->(concept:Concept)
      WITH r, p, collect(concept.name) AS concepts
      RETURN r, p.name AS product, concepts
      ORDER BY r.created_at DESC
      `,
      { id: customerId }
    );
    const reviews = reviewsRes.records.map((r) => {
      const rev = r.get("r").properties;
      return {
        id: rev.id,
        rating: rev.rating,
        text: rev.text,
        sentiment: rev.sentiment,
        created_at: rev.created_at,
        product: r.get("product") as string,
        concepts: (r.get("concepts") as string[]).filter(Boolean),
      };
    });
    trace.push({
      step: "3. Traverse WROTE → ABOUT / MENTIONS",
      detail: `${reviews.length} reviews`,
    });

    const signalsRes = await session.run(
      `
      MATCH (c:Customer {id: $id})-[:EXPRESSED]->(s:Signal)
      OPTIONAL MATCH (s)-[:REGARDS]->(target)
      RETURN s, coalesce(target.name, target.sku, target.id) AS regards
      ORDER BY s.created_at DESC
      `,
      { id: customerId }
    );
    const signals = signalsRes.records.map((r) => {
      const s = r.get("s").properties;
      return {
        id: s.id,
        type: s.type,
        value: s.value,
        source: s.source,
        created_at: s.created_at,
        regards: (r.get("regards") as string) || undefined,
      };
    });
    trace.push({
      step: "4. Traverse EXPRESSED → Signal",
      detail: `${signals.length} signals: ${signals.map((s) => s.type).join(", ") || "none"}`,
    });

    const riskDrivers: string[] = [];
    const negReviews = reviews.filter((r) => r.sentiment === "negative");
    if (negReviews.length) {
      const sizing = negReviews.filter((r) =>
        r.concepts.includes("sizing") || /siz/i.test(r.text)
      );
      if (sizing.length) {
        riskDrivers.push(
          `${sizing.length} negative review(s) mentioning sizing`
        );
      }
      riskDrivers.push(`${negReviews.length} negative review(s) overall`);
    }
    for (const s of signals) {
      if (s.type === "intent_to_churn") {
        riskDrivers.push(`Signal: intent to churn — "${s.value}" (${s.source})`);
      } else if (s.type === "complaint") {
        riskDrivers.push(`Complaint signal: ${s.value}`);
      } else if (s.type === "size_issue") {
        riskDrivers.push(`Size issue signal: ${s.value}`);
      } else {
        riskDrivers.push(`${s.type}: ${s.value}`);
      }
    }
    if (c.segment === "At-risk") {
      riskDrivers.push("Customer segment flagged At-risk");
    }
    trace.push({
      step: "5. Derive risk drivers",
      detail: riskDrivers.join("; ") || "No elevated drivers",
    });

    const timeline = [
      ...orders.map((o) => ({
        date: o.date,
        kind: "order",
        label: `Ordered ${o.products.join(", ")} ($${o.total})`,
      })),
      ...reviews.map((r) => ({
        date: r.created_at,
        kind: "review",
        label: `Review ★${r.rating} on ${r.product}: ${r.text.slice(0, 60)}…`,
      })),
      ...signals.map((s) => ({
        date: s.created_at,
        kind: "signal",
        label: `${s.type}: ${s.value}`,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return {
      id: c.id,
      name: c.name,
      segment: c.segment,
      lifetime_value: c.lifetime_value,
      join_date: c.join_date,
      churn_risk: c.churn_risk,
      region: c.region,
      orders,
      reviews,
      signals,
      riskDrivers,
      timeline,
      trace,
    };
  } finally {
    await session.close();
  }
}
