/**
 * Build data/snapshot.json — embedded ontology + embeddings.
 * No Docker / Neo4j / Postgres required.
 *
 * Run: npm run seed
 */
import "dotenv/config";
import { OntologyStore, nodeId, type Snapshot } from "../lib/store/types";
import { writeSnapshot } from "../lib/store/runtime";
import { embed, getEmbeddingProviderName } from "../lib/embeddings";
import {
  REGIONS,
  CATEGORIES,
  ATTRIBUTES,
  CONCEPTS,
  PRODUCTS,
  CUSTOMERS,
  STORES,
  DEMO_CHURN_CUSTOMER_ID,
  buildOrders,
  buildReviews,
  buildInventory,
} from "./seed-data";

async function main() {
  console.log("Building embedded ontology snapshot…");
  console.log(`  Embedding provider: ${getEmbeddingProviderName()}`);
  const store = new OntologyStore();

  for (const name of REGIONS) {
    store.upsertNode({
      id: nodeId("Region", name),
      label: "Region",
      props: { name },
    });
  }

  for (const cat of CATEGORIES) {
    store.upsertNode({
      id: nodeId("Category", cat.name),
      label: "Category",
      props: { name: cat.name },
    });
  }
  for (const cat of CATEGORIES) {
    if (cat.parent) {
      store.mergeEdge(
        "SUBCATEGORY_OF",
        nodeId("Category", cat.name),
        nodeId("Category", cat.parent)
      );
    }
  }

  for (const attr of ATTRIBUTES) {
    const uid = `${attr.name}=${attr.value}`;
    store.upsertNode({
      id: nodeId("Attribute", uid),
      label: "Attribute",
      props: { uid, name: attr.name, value: attr.value },
    });
  }

  for (const concept of CONCEPTS) {
    const cid = nodeId("Concept", concept.name);
    store.upsertNode({
      id: cid,
      label: "Concept",
      props: { name: concept.name, description: concept.description },
    });
    for (const m of concept.mapsTo) {
      store.mergeEdge(
        "MAPS_TO",
        cid,
        nodeId("Attribute", `${m.name}=${m.value}`)
      );
    }
    for (const target of concept.synonymsOf ?? []) {
      store.mergeEdge("SYNONYM_OF", cid, nodeId("Concept", target));
    }
  }

  for (const p of PRODUCTS) {
    const pid = nodeId("Product", p.sku);
    store.upsertNode({
      id: pid,
      label: "Product",
      props: {
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        season: p.season,
        color: p.color,
        size: p.size,
        description: p.description,
      },
    });
    store.mergeEdge("IN_CATEGORY", pid, nodeId("Category", p.category));
    for (const attr of p.attributes) {
      store.mergeEdge(
        "HAS_ATTRIBUTE",
        pid,
        nodeId("Attribute", `${attr.name}=${attr.value}`)
      );
    }
  }

  for (const s of STORES) {
    const sid = nodeId("Store", s.id);
    store.upsertNode({
      id: sid,
      label: "Store",
      props: { id: s.id, name: s.name },
    });
    store.mergeEdge("IN_REGION", sid, nodeId("Region", s.region));
  }

  for (const row of buildInventory()) {
    store.mergeEdge(
      "STOCKED_AT",
      nodeId("Product", row.sku),
      nodeId("Store", row.storeId),
      { qty: row.qty }
    );
  }

  for (const c of CUSTOMERS) {
    store.upsertNode({
      id: nodeId("Customer", c.id),
      label: "Customer",
      props: { ...c },
    });
  }

  for (const order of buildOrders()) {
    const oid = nodeId("Order", order.id);
    store.upsertNode({
      id: oid,
      label: "Order",
      props: {
        id: order.id,
        date: order.date,
        total: order.total,
        channel: order.channel,
      },
    });
    store.mergeEdge("PLACED", nodeId("Customer", order.customerId), oid);
    for (const sku of order.productSkus) {
      store.mergeEdge("CONTAINS", oid, nodeId("Product", sku));
    }
  }

  for (const review of buildReviews()) {
    const rid = nodeId("Review", review.id);
    store.upsertNode({
      id: rid,
      label: "Review",
      props: {
        id: review.id,
        rating: review.rating,
        text: review.text,
        sentiment: review.sentiment,
        created_at: review.created_at,
      },
    });
    store.mergeEdge("WROTE", nodeId("Customer", review.customerId), rid);
    store.mergeEdge("ABOUT", rid, nodeId("Product", review.productSku));
    for (const concept of review.concepts) {
      const cid = nodeId("Concept", concept);
      if (store.get(cid)) store.mergeEdge("MENTIONS", rid, cid);
    }
  }

  // Seed signal for demo churn customer
  {
    const sid = nodeId("Signal", "SIG-SEED-001");
    store.upsertNode({
      id: sid,
      label: "Signal",
      props: {
        id: "SIG-SEED-001",
        type: "size_issue",
        value: "review mentioned sizing",
        source: "review",
        created_at: "2025-06-01",
      },
    });
    store.mergeEdge("EXPRESSED", nodeId("Customer", DEMO_CHURN_CUSTOMER_ID), sid);
    store.mergeEdge("REGARDS", sid, nodeId("Product", "SKU-0004"));
  }

  // Embeddings
  const batches: Array<{
    id: string;
    entityType: "product" | "review" | "concept";
    entityId: string;
    content: string;
  }> = [];
  for (const p of PRODUCTS) {
    batches.push({
      id: `product:${p.sku}`,
      entityType: "product",
      entityId: p.sku,
      content: `${p.name}. ${p.description}`,
    });
  }
  for (const c of CONCEPTS) {
    batches.push({
      id: `concept:${c.name}`,
      entityType: "concept",
      entityId: c.name,
      content: `${c.name}. ${c.description}`,
    });
  }
  for (const r of buildReviews()) {
    batches.push({
      id: `review:${r.id}`,
      entityType: "review",
      entityId: r.id,
      content: r.text,
    });
  }

  const CHUNK = 32;
  for (let i = 0; i < batches.length; i += CHUNK) {
    const slice = batches.slice(i, i + CHUNK);
    const vectors = await embed(slice.map((s) => s.content));
    for (let j = 0; j < slice.length; j++) {
      store.embeddings.set(slice[j].id, {
        ...slice[j],
        embedding: vectors[j],
      });
    }
    process.stdout.write(
      `  embeddings ${Math.min(i + CHUNK, batches.length)}/${batches.length}\r`
    );
  }
  console.log(`\n  Upserted ${batches.length} embeddings`);

  const snap: Snapshot = store.toSnapshot();
  writeSnapshot(snap);
  const counts = store.counts();
  console.log("  Node counts:", counts.nodesByType);
  console.log(
    `Wrote data/snapshot.json (${counts.totalNodes} nodes, ${counts.totalEdges} edges)`
  );
  console.log("Done. Intentional gap remains: Concept 'windbreaker' is NOT mapped.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
