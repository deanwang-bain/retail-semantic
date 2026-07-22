/**
 * Idempotent seed: wipe Neo4j + pgvector, reload ontology + embeddings.
 * Run: npm run seed
 */
import "dotenv/config";
import { getNeo4jDriver, closeNeo4j } from "../lib/ontology/neo4j";
import { closePool } from "../lib/db/postgres";
import { embed, getEmbeddingProviderName } from "../lib/embeddings";
import {
  wipeEmbeddings,
  upsertEmbedding,
  ensureIvfflatIndex,
} from "../lib/embeddings/store";
import {
  REGIONS,
  CATEGORIES,
  ATTRIBUTES,
  CONCEPTS,
  PRODUCTS,
  CUSTOMERS,
  STORES,
  buildOrders,
  buildReviews,
  buildInventory,
} from "./seed-data";

async function wipeNeo4j() {
  const session = getNeo4jDriver().session();
  try {
    await session.run("MATCH (n) DETACH DELETE n");
    console.log("  Neo4j wiped");
  } finally {
    await session.close();
  }
}

async function createConstraints() {
  const session = getNeo4jDriver().session();
  const stmts = [
    "CREATE CONSTRAINT product_sku IF NOT EXISTS FOR (p:Product) REQUIRE p.sku IS UNIQUE",
    "CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE",
    "CREATE CONSTRAINT concept_name IF NOT EXISTS FOR (c:Concept) REQUIRE c.name IS UNIQUE",
    "CREATE CONSTRAINT customer_id IF NOT EXISTS FOR (c:Customer) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT order_id IF NOT EXISTS FOR (o:Order) REQUIRE o.id IS UNIQUE",
    "CREATE CONSTRAINT review_id IF NOT EXISTS FOR (r:Review) REQUIRE r.id IS UNIQUE",
    "CREATE CONSTRAINT store_id IF NOT EXISTS FOR (s:Store) REQUIRE s.id IS UNIQUE",
    "CREATE CONSTRAINT region_name IF NOT EXISTS FOR (r:Region) REQUIRE r.name IS UNIQUE",
    "CREATE CONSTRAINT attribute_key IF NOT EXISTS FOR (a:Attribute) REQUIRE (a.name, a.value) IS NODE KEY",
  ];
  try {
    for (const s of stmts) {
      try {
        await session.run(s);
      } catch {
        // NODE KEY may need enterprise; fall back to composite uniqueness via merge-only
        if (s.includes("NODE KEY")) {
          await session.run(
            "CREATE CONSTRAINT attribute_uid IF NOT EXISTS FOR (a:Attribute) REQUIRE a.uid IS UNIQUE"
          );
        }
      }
    }
  } finally {
    await session.close();
  }
}

async function seedGraph() {
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    // Regions
    for (const name of REGIONS) {
      await session.run(`MERGE (r:Region {name: $name})`, { name });
    }

    // Categories + hierarchy
    for (const cat of CATEGORIES) {
      await session.run(`MERGE (c:Category {name: $name})`, { name: cat.name });
    }
    for (const cat of CATEGORIES) {
      if (cat.parent) {
        await session.run(
          `MATCH (child:Category {name: $name}), (parent:Category {name: $parent})
           MERGE (child)-[:SUBCATEGORY_OF]->(parent)`,
          { name: cat.name, parent: cat.parent }
        );
      }
    }

    // Attributes
    for (const attr of ATTRIBUTES) {
      const uid = `${attr.name}=${attr.value}`;
      await session.run(
        `MERGE (a:Attribute {uid: $uid})
         SET a.name = $name, a.value = $value`,
        { uid, name: attr.name, value: attr.value }
      );
    }

    // Concepts + MAPS_TO + SYNONYM_OF
    // Teaching point: these edges ARE the semantic layer.
    for (const concept of CONCEPTS) {
      await session.run(
        `MERGE (c:Concept {name: $name})
         SET c.description = $description`,
        { name: concept.name, description: concept.description }
      );
      for (const m of concept.mapsTo) {
        await session.run(
          `MATCH (c:Concept {name: $cname}), (a:Attribute {uid: $uid})
           MERGE (c)-[:MAPS_TO]->(a)`,
          { cname: concept.name, uid: `${m.name}=${m.value}` }
        );
      }
      for (const target of concept.synonymsOf ?? []) {
        await session.run(
          `MATCH (c:Concept {name: $name}), (t:Concept {name: $target})
           MERGE (c)-[:SYNONYM_OF]->(t)`,
          { name: concept.name, target }
        );
      }
    }

    // Products
    for (const product of PRODUCTS) {
      await session.run(
        `MERGE (p:Product {sku: $sku})
         SET p.name = $name, p.brand = $brand, p.price = $price,
             p.currency = $currency, p.season = $season, p.color = $color,
             p.size = $size, p.description = $description`,
        product
      );
      await session.run(
        `MATCH (p:Product {sku: $sku}), (c:Category {name: $category})
         MERGE (p)-[:IN_CATEGORY]->(c)`,
        { sku: product.sku, category: product.category }
      );
      for (const attr of product.attributes) {
        await session.run(
          `MATCH (p:Product {sku: $sku}), (a:Attribute {uid: $uid})
           MERGE (p)-[:HAS_ATTRIBUTE]->(a)`,
          { sku: product.sku, uid: `${attr.name}=${attr.value}` }
        );
      }
    }

    // Stores
    for (const store of STORES) {
      await session.run(
        `MERGE (s:Store {id: $id})
         SET s.name = $name
         WITH s
         MATCH (r:Region {name: $region})
         MERGE (s)-[:IN_REGION]->(r)`,
        store
      );
    }

    // Inventory STOCKED_AT
    const inventory = buildInventory();
    for (const row of inventory) {
      await session.run(
        `MATCH (p:Product {sku: $sku}), (s:Store {id: $storeId})
         MERGE (p)-[r:STOCKED_AT]->(s)
         SET r.qty = $qty`,
        row
      );
    }

    // Customers
    for (const customer of CUSTOMERS) {
      await session.run(
        `MERGE (c:Customer {id: $id})
         SET c.name = $name, c.segment = $segment,
             c.lifetime_value = $lifetime_value, c.join_date = $join_date,
             c.churn_risk = $churn_risk, c.region = $region`,
        customer
      );
    }

    // Orders
    const orders = buildOrders();
    for (const order of orders) {
      await session.run(
        `MATCH (c:Customer {id: $customerId})
         MERGE (o:Order {id: $id})
         SET o.date = $date, o.total = $total, o.channel = $channel
         MERGE (c)-[:PLACED]->(o)`,
        order
      );
      for (const sku of order.productSkus) {
        await session.run(
          `MATCH (o:Order {id: $id}), (p:Product {sku: $sku})
           MERGE (o)-[:CONTAINS]->(p)`,
          { id: order.id, sku }
        );
      }
    }

    // Reviews
    const reviews = buildReviews();
    for (const review of reviews) {
      await session.run(
        `MATCH (c:Customer {id: $customerId}), (p:Product {sku: $productSku})
         MERGE (r:Review {id: $id})
         SET r.rating = $rating, r.text = $text, r.sentiment = $sentiment,
             r.created_at = $created_at
         MERGE (c)-[:WROTE]->(r)
         MERGE (r)-[:ABOUT]->(p)`,
        review
      );
      for (const concept of review.concepts) {
        await session.run(
          `MATCH (r:Review {id: $id}), (c:Concept {name: $concept})
           MERGE (r)-[:MENTIONS]->(c)`,
          { id: review.id, concept }
        );
      }
    }

    // Seed a couple of prior signals for at-risk customers (ingest will add more)
    await session.run(
      `MATCH (c:Customer {id: 'CUST-001'})
       MERGE (s:Signal {id: 'SIG-SEED-001'})
       SET s.type = 'size_issue', s.value = 'review mentioned sizing',
           s.source = 'review', s.created_at = '2025-06-01'
       MERGE (c)-[:EXPRESSED]->(s)
       WITH s
       MATCH (p:Product {sku: 'SKU-0004'})
       MERGE (s)-[:REGARDS]->(p)`
    );

    const counts = await session.run(`
      MATCH (n)
      WITH labels(n)[0] AS label, count(*) AS c
      RETURN label, c ORDER BY label
    `);
    console.log("  Node counts:");
    for (const rec of counts.records) {
      console.log(`    ${rec.get("label")}: ${rec.get("c")}`);
    }
  } finally {
    await session.close();
  }
}

async function seedEmbeddings() {
  console.log(`  Embedding provider: ${getEmbeddingProviderName()}`);
  await wipeEmbeddings();

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
  const reviews = buildReviews();
  for (const r of reviews) {
    batches.push({
      id: `review:${r.id}`,
      entityType: "review",
      entityId: r.id,
      content: r.text,
    });
  }

  const CHUNK = 8;
  for (let i = 0; i < batches.length; i += CHUNK) {
    const slice = batches.slice(i, i + CHUNK);
    const vectors = await embed(slice.map((s) => s.content));
    for (let j = 0; j < slice.length; j++) {
      await upsertEmbedding({ ...slice[j], embedding: vectors[j] });
    }
    process.stdout.write(
      `  embeddings ${Math.min(i + CHUNK, batches.length)}/${batches.length}\r`
    );
  }
  console.log(`\n  Upserted ${batches.length} embeddings`);
  try {
    await ensureIvfflatIndex();
    console.log("  IVFFlat index rebuilt");
  } catch (err) {
    console.warn("  IVFFlat index skipped:", err);
  }
}

async function main() {
  console.log("Seeding retail ontology…");
  await wipeNeo4j();
  await createConstraints();
  await seedGraph();
  await seedEmbeddings();
  console.log("Done. Intentional gap remains: Concept 'windbreaker' is NOT mapped.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeNeo4j();
    await closePool();
  });
