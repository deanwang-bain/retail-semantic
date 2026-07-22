/**
 * Postgres + pgvector connection pool.
 * Stores embeddings for products, reviews, and concept descriptions.
 */
import { Pool, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://ontology:ontology-demo@localhost:5432/retail_semantic",
      max: 10,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function checkPostgresHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  pgvector?: boolean;
  error?: string;
}> {
  const start = Date.now();
  try {
    await query("SELECT 1 AS ok");
    const ext = await query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_extension WHERE extname = 'vector'
       ) AS exists`
    );
    return {
      ok: true,
      latencyMs: Date.now() - start,
      pgvector: ext.rows[0]?.exists ?? false,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
