/**
 * Merchandising Q&A — inventory × order velocity by SEA region / category.
 */
import { getSession } from "@/lib/ontology/neo4j";
import { parseQuery } from "@/lib/llm";

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

export async function merchandisingQuery(
  rawQuery: string
): Promise<MerchandisingResult> {
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

  const session = getSession();
  try {
    const stockRes = await session.run(
      `
      MATCH (p:Product)-[st:STOCKED_AT]->(s:Store)-[:IN_REGION]->(r:Region)
      MATCH (p)-[:IN_CATEGORY]->(cat:Category)
      OPTIONAL MATCH (cat)-[:SUBCATEGORY_OF]->(parent:Category)
      WITH r.name AS region,
           coalesce(parent.name, cat.name) AS category,
           cat.name AS leaf,
           sum(st.qty) AS stock
      WHERE $categoryHint IS NULL
         OR category = $categoryHint
         OR leaf = $categoryHint
         OR ($categoryHint = 'Outerwear' AND category = 'Outerwear')
      RETURN region, category, stock
      ORDER BY region, category
      `,
      { categoryHint: categoryHint ?? null }
    );

    const velocityRes = await session.run(
      `
      MATCH (o:Order)-[:CONTAINS]->(p:Product)-[:IN_CATEGORY]->(cat:Category)
      OPTIONAL MATCH (cat)-[:SUBCATEGORY_OF]->(parent:Category)
      MATCH (cust:Customer)-[:PLACED]->(o)
      WITH coalesce(parent.name, cat.name) AS category,
           cat.name AS leaf,
           cust.region AS region,
           count(DISTINCT o) AS orderCount,
           count(p) AS unitsSold
      WHERE $categoryHint IS NULL
         OR category = $categoryHint
         OR leaf = $categoryHint
         OR ($categoryHint = 'Outerwear' AND category = 'Outerwear')
      RETURN region, category, orderCount, unitsSold
      `,
      { categoryHint: categoryHint ?? null }
    );

    trace.push({
      step: "2. Traverse Store→IN_REGION + STOCKED_AT",
      detail: `${stockRes.records.length} region/category stock rows`,
    });
    trace.push({
      step: "3. Join order velocity via Customer.region",
      detail: `${velocityRes.records.length} velocity rows`,
    });

    const velocityKey = new Map<
      string,
      { orderCount: number; unitsSold: number }
    >();
    for (const rec of velocityRes.records) {
      const key = `${rec.get("region")}|${rec.get("category")}`;
      velocityKey.set(key, {
        orderCount: Number(rec.get("orderCount")),
        unitsSold: Number(rec.get("unitsSold")),
      });
    }

    let rows: RegionRow[] = stockRes.records.map((rec) => {
      const region = rec.get("region") as string;
      const category = rec.get("category") as string;
      const stock = Number(rec.get("stock"));
      const vel = velocityKey.get(`${region}|${category}`) ?? {
        orderCount: 0,
        unitsSold: 0,
      };
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

    // Chart from FULL rows (before focus filter) so all SEA regions appear
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
    const over = rows.filter((r) => r.status === "overstocked").slice(0, 3);
    for (const r of over) {
      highlights.push(
        `${r.category} overstocked in ${r.region} (stock=${r.stock}, sell-through=${(r.sellThrough * 100).toFixed(1)}%)`
      );
    }
    // Always surface understock from the unfiltered chart regions when relevant
    const under = stockRes.records
      .map((rec) => {
        const region = rec.get("region") as string;
        const category = rec.get("category") as string;
        const stock = Number(rec.get("stock"));
        return { region, category, stock };
      })
      .filter((r) => r.stock < 250)
      .slice(0, 2);
    for (const r of under) {
      highlights.push(
        `${r.category} understocked in ${r.region} (stock=${r.stock})`
      );
    }

    trace.push({
      step: "4. Flag over/under/slow",
      detail: highlights.join("; ") || "No extreme flags in filtered set",
    });

    return {
      query: rawQuery,
      focus,
      rows,
      chart,
      highlights,
      trace,
    };
  } finally {
    await session.close();
  }
}
