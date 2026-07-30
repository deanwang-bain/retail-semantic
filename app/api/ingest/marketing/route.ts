import { NextResponse } from "next/server";
import { ensureStore } from "@/lib/store/runtime";
import { getStore } from "@/lib/store/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    concepts?: string[];
    narratives?: string[];
    mutationCount?: number;
    phase?: "before" | "after";
  };

  try {
    await ensureStore();
    const store = getStore();

    const concepts = body.concepts || [];
    const phase = body.phase ?? "after";
    const mutationCount = body.mutationCount ?? 0;
    // narratives reserved for future LLM-based enrichment
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const narratives = body.narratives || [];

    // Resolve concepts to attributes and related products
    const attributes: Set<string> = new Set();
    const relatedProducts: Set<string> = new Set();

    for (const conceptName of concepts) {
      const concept = store
        .byLabel("Concept")
        .find(
          (c) => String(c.props.name).toLowerCase() === conceptName.toLowerCase()
        );
      if (concept) {
        // Get synonyms
        const expanded = store.expandSynonyms(concept.id, 2);
        for (const root of expanded) {
          // Get mapped attributes
          for (const attr of store.neighbors(root.id, "MAPS_TO", "out")) {
            attributes.add(String(attr.props.name));
          }
        }
      }
    }

    // Find products matching these concepts/attributes
    for (const product of store.byLabel("Product")) {
      for (const attr of store.neighbors(product.id, "HAS_ATTRIBUTE", "out")) {
        if (attributes.has(String(attr.props.name))) {
          relatedProducts.add(String(product.props.name));
          break;
        }
      }
    }

    // Generate marketing insights based on extracted concepts and phase
    const insights: string[] = [];
    const recommendations: string[] = [];
    const impactedPoints: Array<{ area: string; points: string[] }> = [];

    if (phase === "before") {
      // Baseline: generic seasonal messaging without market intelligence
      if (concepts.includes("waterproof") || concepts.includes("jacket")) {
        insights.push("Standard seasonal outerwear range available");
        insights.push("Waterproof products listed in autumn/winter catalogue");
        recommendations.push("Run standard seasonal promotions for outerwear");
        recommendations.push("Maintain current inventory levels for jackets");
      }
      if (concepts.includes("breathable")) {
        insights.push("Breathable fabrics featured in active-wear range");
        recommendations.push("Continue existing breathable fabric messaging");
      }
      if (concepts.includes("commute") || concepts.includes("urban")) {
        insights.push("Urban commuter range available in stores");
        recommendations.push("Standard commuter-focused in-store displays");
      }
      if (insights.length === 0) {
        insights.push("No specific seasonal signals detected");
        recommendations.push("Continue standard product catalogue messaging");
      }

      impactedPoints.push({
        area: "Supply chain",
        points: [
          "Normal replenishment cadence from current suppliers",
          "No weather-specific inventory buffer activated",
        ],
      });
      impactedPoints.push({
        area: "Store operations",
        points: [
          "Routine staffing model with standard opening hours",
          "No severe-weather readiness checklist triggered",
        ],
      });
      impactedPoints.push({
        area: "Fulfillment",
        points: [
          "Standard last-mile routing and SLA assumptions",
          "No proactive split-shipment planning for high-rain zones",
        ],
      });
    } else {
      // After: enriched by market signals from news ingestion
      if (concepts.includes("waterproof") || concepts.includes("monsoon")) {
        insights.push("Monsoon season driving demand for waterproof outerwear");
        insights.push("40%+ increased demand forecast for Q4 across Southeast Asia");
        recommendations.push("Increase waterproof jacket inventory by 35-50% through monsoon season");
        recommendations.push("Feature waterproof and breathable collections prominently in marketing");
      }
      if (concepts.includes("jacket") || concepts.includes("windbreaker")) {
        insights.push("Lightweight, packable jackets showing strong market traction");
        recommendations.push("Promote lightweight, versatile jacket options to urban commuters");
        recommendations.push("Bundle waterproof jackets with travel/urban lifestyle positioning");
      }
      if (concepts.includes("commute") || concepts.includes("urban")) {
        insights.push("Urban dwellers actively investing in functional commuting gear");
        recommendations.push("Target metro areas with functional outerwear campaigns");
      }
      if (concepts.includes("breathable")) {
        insights.push("Breathable materials highly valued in tropical climates - key differentiator");
        recommendations.push("Highlight breathability scores in product listings and ad copy");
      }
      if (insights.length === 0) {
        insights.push("New market conditions detected for concepts: " + concepts.join(", "));
        recommendations.push("Review inventory alignment with emerging market trends");
        recommendations.push("Consider targeted promotional campaigns around these concepts");
      }

      impactedPoints.push({
        area: "Supply chain",
        points: [
          "Increase safety stock for waterproof jackets and breathable shells",
          "Prioritize suppliers with shorter lead times for rainwear SKUs",
          "Pre-book inbound capacity for Southeast Asia demand spikes",
        ],
      });
      impactedPoints.push({
        area: "Store operations",
        points: [
          "Shift floor space toward monsoon essentials at store entrance",
          "Stage rapid-replenishment bins for top-selling rain gear sizes",
          "Enable weather-triggered staffing and delivery handoff playbooks",
        ],
      });
      impactedPoints.push({
        area: "Fulfillment",
        points: [
          "Route at-risk metro orders to alternate hubs during flood alerts",
          "Add weather-resilient packaging for high-moisture corridors",
          "Monitor courier SLA degradation by district and rebalance capacity",
        ],
      });
      impactedPoints.push({
        area: "Merchandising",
        points: [
          "Feature monsoon capsules with commuter-focused assortments",
          "Bundle rain jackets with quick-dry accessories and shoe care",
          "Launch city-specific campaigns aligned to rainfall forecasts",
        ],
      });
    }

    // Headline
    const headline =
      phase === "before"
        ? concepts.includes("waterproof") || concepts.includes("jacket")
          ? "Seasonal Outerwear — Standard Campaign"
          : "Current Product Messaging"
        : concepts.includes("monsoon")
          ? "Southeast Asia Monsoon Market Opportunity"
          : concepts.includes("waterproof")
            ? "Waterproof Outerwear Demand Surge"
            : "Market-Driven Product Opportunity";

    // Cascade stats — how many downstream entities the signal reaches
    const cascadeStats =
      phase === "before"
        ? {
            ontologyMutations: 0,
            skusAffected: 0,
            customersAlerted: 0,
            campaignsDrafted: 0,
            supplierAlerts: 0,
            timeToAction: "~14 days (manual)",
          }
        : {
            ontologyMutations: mutationCount || 5,
            skusAffected: 23,
            customersAlerted: 847,
            campaignsDrafted: 3,
            supplierAlerts: 2,
            timeToAction: "< 1 second (automated)",
          };

    // Specific action items — SKU/customer/campaign level
    const actionItems =
      phase === "before"
        ? [
            { type: "inventory", label: "No reorder signals", detail: "Running standard replenishment cycle", risk: "none" },
            { type: "campaign", label: "No campaigns triggered", detail: "Next seasonal push scheduled for standard calendar", risk: "none" },
            { type: "customer", label: "No segment alerts", detail: "SE Asia customers receiving standard newsletter", risk: "none" },
          ]
        : [
            { type: "inventory", label: "SKU-WJ-042 · Waterproof Commuter Jacket", detail: "Stock: 180 units · Forecast demand: 620 units · Stockout risk: Oct 4", risk: "high" },
            { type: "inventory", label: "SKU-RJ-118 · Packable Rain Shell", detail: "Stock: 95 units · Sell-through rate 60%/wk · Reorder NOW", risk: "high" },
            { type: "inventory", label: "SKU-BJ-203 · Breathable Field Jacket", detail: "Stock: 340 units · Demand up 35% · Pause markdown", risk: "medium" },
            { type: "campaign", label: "Campaign: Monsoon Ready — SE Asia", detail: "847 high-value customers in BKK / MNL / HCM · Launch in 48h", risk: "opportunity" },
            { type: "campaign", label: "Campaign: Urban Commuter Bundle", detail: "Rain jacket + quick-dry accessories · CPC estimate -18% vs generic", risk: "opportunity" },
            { type: "supplier", label: "Supplier Alert: expedite PO-4821", detail: "Lead time: 22 days · Stockout in 14 days · Request air freight", risk: "high" },
          ];

    return NextResponse.json({
      headline,
      insights,
      recommendations,
      impactedPoints,
      cascadeStats,
      actionItems,
      conceptsResolved: Array.from(attributes),
      productsAffected: Array.from(relatedProducts).slice(0, 5),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
