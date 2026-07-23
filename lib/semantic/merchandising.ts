/**
 * Merchandising Q&A over Store→IN_REGION + STOCKED_AT + order velocity.
 */
import { parseQuery } from "@/lib/llm";
import { ensureStore } from "@/lib/store/runtime";
import { getStore } from "@/lib/store/types";

export type RegionRow = {
  region: string;
  category: string;
  stock: number;
  orderCount: number;
  unitsSold: number;
  sellThrough: number;
  status: "overstocked" | "understocked" | "healthy" | "slow";
};

export type MerchandisingResult = {
  query: string;
  focus: string;
  rows: RegionRow[];
  chart: Array<{ region: string; stock: number; unitsSold: number }>;
  highlights: string[];
  trace: Array<{ step: string; detail: string }>;
};

function topCategory(
  store: ReturnType<typeof getStore>,
  productId: string
): string {
  const cat = store.neighbors(productId, "IN_CATEGORY", "out")[0];
  if (!cat) return "Unknown";
  const parent = store.neighbors(cat.id, "SUBCATEGORY_OF", "out")[0];
  return String((parent ?? cat).props.name);
}

export async function merchandisingQuery(
  rawQuery: string
): Promise<MerchandisingResult> {
  await ensureStore();
  const store = getStore();
  const intent = await parseQuery(rawQuery);
  const focus =
    intent.kind === "merchandising" ? intent.focus : "general";
  const categoryHint =
    intent.kind === "merchandising" ? intent.categoryHint : undefined;

  const trace: Array<{ step: string; detail: string }> = [
    {
      step: "1. Parse",
      detail: `focus=${focus}${categoryHint ? ` category=${categoryHint}` : ""}`,
    },
  ];

  // Stock by region|category
  const stockMap = new Map<string, number>();
  for (const product of store.byLabel("Product")) {
    const category = topCategory(store, product.id);
    if (
      categoryHint &&
      category !== categoryHint &&
      !(
        categoryHint === "Outerwear" &&
        ["Outerwear", "Jackets", "Raincoats", "Fleeces"].includes(category)
      )
    ) {
      // also allow leaf match
      const leaf = store.neighbors(product.id, "IN_CATEGORY", "out")[0];
      if (!leaf || String(leaf.props.name) !== categoryHint) {
        if (categoryHint !== "Outerwear" || category !== "Outerwear") {
          if (category !== categoryHint) continue;
        }
      }
    }
    for (const e of store.outEdges(product.id, "STOCKED_AT")) {
      const storeNode = store.get(e.to);
      if (!storeNode) continue;
      const region = store.neighbors(storeNode.id, "IN_REGION", "out")[0];
      if (!region) continue;
      const key = `${region.props.name}|${category}`;
      stockMap.set(
        key,
        (stockMap.get(key) ?? 0) + Number(e.props?.qty ?? 0)
      );
    }
  }

  // Velocity via customer.region
  const velMap = new Map<string, { orderCount: number; unitsSold: number }>();
  const orderSeen = new Set<string>();
  for (const order of store.byLabel("Order")) {
    const customer = store.neighbors(order.id, "PLACED", "in")[0];
    if (!customer) continue;
    const region = String(customer.props.region);
    const products = store.neighbors(order.id, "CONTAINS", "out");
    for (const p of products) {
      const category = topCategory(store, p.id);
      if (categoryHint && category !== categoryHint) {
        if (
          !(
            categoryHint === "Outerwear" && category === "Outerwear"
          )
        ) {
          continue;
        }
      }
      const key = `${region}|${category}`;
      const cur = velMap.get(key) ?? { orderCount: 0, unitsSold: 0 };
      cur.unitsSold += 1;
      if (!orderSeen.has(`${order.id}|${key}`)) {
        cur.orderCount += 1;
        orderSeen.add(`${order.id}|${key}`);
      }
      velMap.set(key, cur);
    }
  }

  trace.push({
    step: "2. Traverse Store→IN_REGION + STOCKED_AT",
    detail: `${stockMap.size} region/category stock rows`,
  });
  trace.push({
    step: "3. Join order velocity via Customer.region",
    detail: `${velMap.size} velocity rows`,
  });

  let rows: RegionRow[] = Array.from(stockMap.entries()).map(([key, stock]) => {
    const [region, category] = key.split("|");
    const vel = velMap.get(key) ?? { orderCount: 0, unitsSold: 0 };
    const sellThrough =
      stock + vel.unitsSold === 0
        ? 0
        : vel.unitsSold / (stock + vel.unitsSold);
    let status: RegionRow["status"] = "healthy";
    if (stock >= 200 && sellThrough < 0.15) status = "overstocked";
    else if (stock < 250) status = "understocked";
    else if (sellThrough < 0.08) status = "slow";
    return {
      region,
      category,
      stock,
      orderCount: vel.orderCount,
      unitsSold: vel.unitsSold,
      sellThrough: Math.round(sellThrough * 1000) / 1000,
      status,
    };
  });

  const chartMap = new Map<string, { stock: number; unitsSold: number }>();
  for (const r of rows) {
    const cur = chartMap.get(r.region) ?? { stock: 0, unitsSold: 0 };
    cur.stock += r.stock;
    cur.unitsSold += r.unitsSold;
    chartMap.set(r.region, cur);
  }
  const chart = [
    "Singapore",
    "Thailand",
    "Malaysia",
    "Philippines",
    "Vietnam",
  ].map((region) => ({
    region:
      region === "Singapore"
        ? "SG"
        : region === "Thailand"
          ? "TH"
          : region === "Malaysia"
            ? "MY"
            : region === "Philippines"
              ? "PH"
              : "VN",
    stock: chartMap.get(region)?.stock ?? 0,
    unitsSold: chartMap.get(region)?.unitsSold ?? 0,
  }));

  if (focus === "overstocked") {
    rows = rows.filter((r) => r.status === "overstocked" || r.stock >= 180);
    rows.sort((a, b) => b.stock - a.stock);
  } else if (focus === "underperforming") {
    rows = rows.filter(
      (r) =>
        r.status === "slow" ||
        r.status === "overstocked" ||
        r.sellThrough < 0.12
    );
    rows.sort((a, b) => a.sellThrough - b.sellThrough);
  } else {
    rows.sort((a, b) => b.stock - a.stock);
  }

  const highlights: string[] = [];
  for (const r of rows.filter((x) => x.status === "overstocked").slice(0, 3)) {
    highlights.push(
      `${r.category} overstocked in ${r.region} (stock=${r.stock}, sell-through=${(r.sellThrough * 100).toFixed(1)}%)`
    );
  }
  for (const r of Array.from(stockMap.entries())
    .map(([key, stock]) => {
      const [region, category] = key.split("|");
      return { region, category, stock };
    })
    .filter((r) => r.stock < 250)
    .slice(0, 2)) {
    highlights.push(
      `${r.category} understocked in ${r.region} (stock=${r.stock})`
    );
  }

  trace.push({
    step: "4. Flag over/under/slow",
    detail: highlights.join("; ") || "No extreme flags",
  });

  return { query: rawQuery, focus, rows, chart, highlights, trace };
}
