/**
 * Customer 360 — aggregate orders, reviews, signals from the embedded store.
 */
import { ensureStore } from "@/lib/store/runtime";
import { getStore, nodeId } from "@/lib/store/types";

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

export async function listCustomers(opts?: { atRiskOnly?: boolean }) {
  await ensureStore();
  const store = getStore();
  return store
    .byLabel("Customer")
    .map((c) => ({
      id: String(c.props.id),
      name: String(c.props.name),
      segment: String(c.props.segment),
      churn_risk: Number(c.props.churn_risk),
      lifetime_value: Number(c.props.lifetime_value),
      region: String(c.props.region),
    }))
    .filter((c) =>
      opts?.atRiskOnly
        ? c.churn_risk >= 0.5 || c.segment === "At-risk"
        : true
    )
    .sort((a, b) => b.churn_risk - a.churn_risk || a.name.localeCompare(b.name));
}

export async function getCustomer360(
  customerId: string
): Promise<CustomerProfile | null> {
  await ensureStore();
  const store = getStore();
  const c = store.get(nodeId("Customer", customerId));
  if (!c) return null;
  const trace: Array<{ step: string; detail: string }> = [];
  trace.push({
    step: "1. Load customer node",
    detail: `${c.props.name} · segment=${c.props.segment} · churn_risk=${c.props.churn_risk}`,
  });

  const orders = store.neighbors(c.id, "PLACED", "out").map((o) => {
    const products = store
      .neighbors(o.id, "CONTAINS", "out")
      .map((p) => String(p.props.name));
    return {
      id: String(o.props.id),
      date: String(o.props.date),
      total: Number(o.props.total),
      channel: String(o.props.channel),
      products,
    };
  });
  orders.sort((a, b) => b.date.localeCompare(a.date));
  trace.push({
    step: "2. Traverse PLACED → CONTAINS",
    detail: `${orders.length} orders`,
  });

  const reviews = store.neighbors(c.id, "WROTE", "out").map((r) => {
    const product = store.neighbors(r.id, "ABOUT", "out")[0];
    const concepts = store
      .neighbors(r.id, "MENTIONS", "out")
      .map((x) => String(x.props.name));
    return {
      id: String(r.props.id),
      rating: Number(r.props.rating),
      text: String(r.props.text),
      sentiment: String(r.props.sentiment),
      created_at: String(r.props.created_at),
      product: product ? String(product.props.name) : "",
      concepts,
    };
  });
  reviews.sort((a, b) => b.created_at.localeCompare(a.created_at));
  trace.push({
    step: "3. Traverse WROTE → ABOUT / MENTIONS",
    detail: `${reviews.length} reviews`,
  });

  const signals = store.neighbors(c.id, "EXPRESSED", "out").map((s) => {
    const target = store.neighbors(s.id, "REGARDS", "out")[0];
    return {
      id: String(s.props.id),
      type: String(s.props.type),
      value: String(s.props.value),
      source: String(s.props.source),
      created_at: String(s.props.created_at),
      regards: target
        ? String(target.props.name ?? target.props.sku ?? target.props.id)
        : undefined,
    };
  });
  signals.sort((a, b) => b.created_at.localeCompare(a.created_at));
  trace.push({
    step: "4. Traverse EXPRESSED → Signal",
    detail: `${signals.length} signals: ${signals.map((s) => s.type).join(", ") || "none"}`,
  });

  const riskDrivers: string[] = [];
  const negReviews = reviews.filter((r) => r.sentiment === "negative");
  if (negReviews.length) {
    const sizing = negReviews.filter(
      (r) => r.concepts.includes("sizing") || /siz/i.test(r.text)
    );
    if (sizing.length) {
      riskDrivers.push(`${sizing.length} negative review(s) mentioning sizing`);
    }
    riskDrivers.push(`${negReviews.length} negative review(s) overall`);
  }
  for (const s of signals) {
    if (s.type === "intent_to_churn") {
      riskDrivers.push(
        `Signal: intent to churn — "${s.value}" (${s.source})`
      );
    } else if (s.type === "complaint") {
      riskDrivers.push(`Complaint signal: ${s.value}`);
    } else if (s.type === "size_issue") {
      riskDrivers.push(`Size issue signal: ${s.value}`);
    } else {
      riskDrivers.push(`${s.type}: ${s.value}`);
    }
  }
  if (c.props.segment === "At-risk") {
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
    id: String(c.props.id),
    name: String(c.props.name),
    segment: String(c.props.segment),
    lifetime_value: Number(c.props.lifetime_value),
    join_date: String(c.props.join_date),
    churn_risk: Number(c.props.churn_risk),
    region: String(c.props.region),
    orders,
    reviews,
    signals,
    riskDrivers,
    timeline,
    trace,
  };
}
