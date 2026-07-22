# Retail Ontology & Semantic Layer Demo

Full-stack demo showing why an **ontology** + **semantic layer** beats a flat relational schema for retail.

## Quick start

```bash
# 1. Databases (Neo4j + Postgres/pgvector)
docker compose up -d

# 2. App
cp .env.example .env   # works with no API keys
npm install
npm run seed           # after Phase 2
npm run dev
```

Open http://localhost:3000 — the Overview page health panel should show Neo4j and Postgres as **ok**.

### Without Docker

If Docker is unavailable, install Neo4j Community 5.x and Postgres 16 + pgvector locally, then set `NEO4J_*` / `DATABASE_URL` in `.env` to match.

## Optional API keys

The app runs fully offline:

| Key | Effect when present |
|-----|---------------------|
| `VOYAGE_API_KEY` or `OPENAI_API_KEY` | Hosted embeddings |
| `ANTHROPIC_API_KEY` | Claude for NL parse + ingest extraction |

Otherwise: local `@xenova/transformers` embeddings + rule-based parser.

## Build phases

1. ✅ Scaffold + health check
2. Ontology schema, seed, Explorer
3. Embedding / LLM providers
4. UC1 Semantic search
5. UC2 / UC3 / UC4
6. Ingest & Watch
7. Overview polish + guided demo script
