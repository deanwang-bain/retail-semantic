# Retail Ontology & Semantic Layer Demo · v2 (embedded)

Docker-free version optimised for **Vercel** and one-command local runs.

The ontology graph + vector index live **in-process**, loaded from a committed
`data/snapshot.json`. No Neo4j, no Postgres, no `docker compose`.

## Quick start (local)

```bash
git checkout cursor/vercel-embedded-8f81
cp .env.example .env
npm install
npm run seed          # regenerates data/snapshot.json (already committed)
npm run dev
```

Open http://localhost:3000 — badge should read **Store: embedded**.

## Deploy on Vercel

1. Import this GitHub repo in Vercel
2. Set the production branch to `cursor/vercel-embedded-8f81` (or merge to `main`)
3. Deploy — no storage integrations required
4. Optional env vars: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` / `OPENAI_API_KEY`

That's it. The snapshot ships with the repo.

### Note on ingest mutations

Ingest updates the **in-memory** store for the current serverless instance.
**Reset ontology** reloads the clean snapshot. On Vercel, cold starts also
reload from snapshot (demo-friendly; not a multi-region write store).

## Architecture (v2)

| Concern | v1 (Docker) | **v2 (this branch)** |
|---------|-------------|----------------------|
| Graph | Neo4j | In-process `OntologyStore` |
| Vectors | Postgres + pgvector | In-process cosine search |
| Seed | Live DB wipe/reload | Writes `data/snapshot.json` |
| Local embeddings | transformers.js MiniLM | Deterministic 384-dim hash embedder |
| Deploy | Needs Docker hosts | `vercel` / any Node host |

Optional Voyage/OpenAI embeddings and Claude NL parsing still work when keys are set.

## Guided demo

Same 5-minute script as v1 — see in-app **Guided Demo** or below:

1. Overview → explain Concept → MAPS_TO → Attribute
2. Ontology Explorer → click `warm`
3. UC1 `warm jacket for a rainy commute`
4. UC1 `windbreaker for the rain` (unmapped / weak)
5. UC2 `CUST-001` baseline churn
6. UC3 outerwear overstock in SEA
7. UC4 recommend for a customer
8. Ingest review → learn `windbreaker` → re-run UC1
9. Ingest cancellation email → UC2 churn jumps
10. Reset ontology

## Regenerating the snapshot

```bash
npm run seed
```

Commit the updated `data/snapshot.json` if product/seed data changed.
