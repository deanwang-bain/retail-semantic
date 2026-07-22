# Retail Ontology & Semantic Layer Demo

A full-stack, runnable demo that shows why an **ontology** + **semantic layer** is more powerful than a flat relational schema for retail.

Three tangible beats for a non-technical executive audience:

1. **The ontology** — an explorable knowledge graph (products, customers, orders, reviews, stores, and *concepts*).
2. **Fuzzy / natural-language querying** — messy human language resolves against the ontology into precise structured results.
3. **A living semantic layer** — ingesting unstructured text grows Concept / synonym / Signal nodes so queries that failed before now succeed.

## Quick start

```bash
docker compose up -d          # Neo4j + Postgres/pgvector
cp .env.example .env          # works with ZERO API keys
npm install
npm run seed                  # idempotent wipe + reload (~1–2 min first time for local model)
npm run dev
```

Open http://localhost:3000 — header badge should read **AI: simulated** and **DB: connected**.

### Optional API keys

| Variable | Effect |
|----------|--------|
| `VOYAGE_API_KEY` or `OPENAI_API_KEY` | Hosted embeddings (else `@xenova/transformers` / MiniLM-L6-v2, 384-dim) |
| `ANTHROPIC_API_KEY` | Claude for NL parse + ingest extraction (else rule-based parser) |

Fallbacks are **real** logic (real local embeddings, real synonym learning) — never canned answers.

---

## Guided demo script (~5 minutes)

Use the in-app **Guided Demo** page, or follow this:

1. **Overview** — “Relational schemas store rows. Ontologies store meaning. The `Concept → MAPS_TO → Attribute` edges *are* the semantic layer.”
2. **Ontology Explorer** — Filter to Concept + Attribute + Product. Click `warm` → follow `MAPS_TO` → products with `warmth=high|medium`.
3. **UC1** — Search `warm jacket for a rainy commute`. Open **Resolution trace**. Concepts → attributes → Cypher + pgvector.
4. **UC1 gap** — Search `windbreaker for the rain`. Weak/unmapped — we never seeded that word.
5. **UC2** — Open `CUST-001`. Note baseline churn risk + size_issue signal.
6. **UC3** — Ask `where is outerwear overstocked?` TH/MY overstock; PH understock.
7. **UC4** — Recommend for a Loyal customer; every card has a one-line **why** from the path.
8. **Ingest climax A** — Load **Product review** → Run → Apply. Watch `Concept:windbreaker` pulse with `SYNONYM_OF → jacket`. Click **Re-run UC1** — same query now returns rain jackets.
9. **Ingest climax B** — Load **Customer email** → Apply. Jump to UC2 for `CUST-001`: churn risk jumped; `intent_to_churn` is cited.
10. **Reset ontology** — clean seed for the next audience.

---

## Architecture

```
/app                  Next.js App Router pages + API routes
/components           UI, force-graph, resolution-trace
/lib/ontology         Neo4j driver + Cypher helpers
/lib/semantic         UC1–UC4 resolution logic
/lib/embeddings       voyage | openai | local transformers.js
/lib/llm              Claude | rule-based parser
/lib/ingest           extract → resolve → novelty → propose → apply
/scripts/seed.ts      idempotent Neo4j + pgvector seed
docker-compose.yml    neo4j:5 + pgvector/pg16
```

**Teaching point:** fuzzy language enters through Concepts; structured precision comes out through Attributes. Ingestion grows the middle layer (`SYNONYM_OF`, new `MAPS_TO`, `Signal` nodes).

## Acceptance checks

- [x] Runs with no API keys (local embeddings + rule parser)
- [x] UC1–UC4 return graph/vector-backed answers with resolution traces
- [x] Ontology Explorer renders Concept→Attribute→Product
- [x] Ingesting the review teaches `windbreaker → jacket`; UC1 then succeeds
- [x] Ingesting the cancellation email raises `CUST-001` churn_risk with a cited Signal
- [x] Reset reloads the clean seed
