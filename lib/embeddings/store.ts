/**
 * In-process vector store (replaces Postgres + pgvector).
 */
import { getStore, type EmbeddingRec } from "@/lib/store/types";
import { cosineDistance } from "@/lib/embeddings";
import { ensureStore } from "@/lib/store/runtime";

export type EmbeddingEntityType = "product" | "review" | "concept";

export async function wipeEmbeddings(): Promise<void> {
  await ensureStore();
  getStore().embeddings.clear();
}

export async function upsertEmbedding(opts: {
  id: string;
  entityType: EmbeddingEntityType;
  entityId: string;
  content: string;
  embedding: number[];
}): Promise<void> {
  await ensureStore();
  const rec: EmbeddingRec = {
    id: opts.id,
    entityType: opts.entityType,
    entityId: opts.entityId,
    content: opts.content,
    embedding: opts.embedding,
  };
  getStore().embeddings.set(opts.id, rec);
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
  await ensureStore();
  const limit = opts.limit ?? 10;
  const rows: Array<{
    entity_type: string;
    entity_id: string;
    content: string;
    distance: number;
  }> = [];
  for (const emb of getStore().embeddings.values()) {
    if (opts.entityType && emb.entityType !== opts.entityType) continue;
    rows.push({
      entity_type: emb.entityType,
      entity_id: emb.entityId,
      content: emb.content,
      distance: cosineDistance(opts.embedding, emb.embedding),
    });
  }
  rows.sort((a, b) => a.distance - b.distance);
  return rows.slice(0, limit);
}
