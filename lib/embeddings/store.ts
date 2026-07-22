/**
 * pgvector helpers — upsert and similarity search over product/review/concept embeddings.
 */
import { query, toLiteral } from "./vector-sql";

export type EmbeddingEntityType = "product" | "review" | "concept";

export async function wipeEmbeddings(): Promise<void> {
  await query("DELETE FROM embeddings");
}

export async function upsertEmbedding(opts: {
  id: string;
  entityType: EmbeddingEntityType;
  entityId: string;
  content: string;
  embedding: number[];
}): Promise<void> {
  const lit = toLiteral(opts.embedding);
  await query(
    `INSERT INTO embeddings (id, entity_type, entity_id, content, embedding, updated_at)
     VALUES ($1, $2, $3, $4, $5::vector, NOW())
     ON CONFLICT (id) DO UPDATE SET
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding,
       updated_at = NOW()`,
    [opts.id, opts.entityType, opts.entityId, opts.content, lit]
  );
}

export async function similarEntities(opts: {
  embedding: number[];
  entityType?: EmbeddingEntityType;
  limit?: number;
}): Promise<
  Array<{
    entity_type: string;
    entity_id: string;
    content: string;
    distance: number;
  }>
> {
  const lit = toLiteral(opts.embedding);
  const limit = opts.limit ?? 10;
  if (opts.entityType) {
    const res = await query<{
      entity_type: string;
      entity_id: string;
      content: string;
      distance: number;
    }>(
      `SELECT entity_type, entity_id, content,
              (embedding <=> $1::vector) AS distance
       FROM embeddings
       WHERE entity_type = $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [lit, opts.entityType, limit]
    );
    return res.rows;
  }
  const res = await query<{
    entity_type: string;
    entity_id: string;
    content: string;
    distance: number;
  }>(
    `SELECT entity_type, entity_id, content,
            (embedding <=> $1::vector) AS distance
     FROM embeddings
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [lit, limit]
  );
  return res.rows;
}

export async function ensureIvfflatIndex(): Promise<void> {
  await query(`DROP INDEX IF EXISTS embeddings_embedding_idx`);
  await query(
    `CREATE INDEX embeddings_embedding_idx
     ON embeddings USING ivfflat (embedding vector_cosine_ops)
     WITH (lists = 50)`
  );
}
