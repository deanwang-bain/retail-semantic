/**
 * Embedding provider abstraction.
 *
 * Priority:
 *   1. Voyage AI  (VOYAGE_API_KEY)
 *   2. OpenAI     (OPENAI_API_KEY)
 *   3. Local      (@xenova/transformers → Xenova/all-MiniLM-L6-v2, 384-dim)
 *
 * Always returns genuine vectors — never faked/canned embeddings.
 */
export type EmbeddingProviderName = "voyage" | "openai" | "local";

export function getEmbeddingProviderName(): EmbeddingProviderName {
  if (process.env.VOYAGE_API_KEY) return "voyage";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "local";
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const provider = getEmbeddingProviderName();
  if (provider === "voyage") return embedVoyage(texts);
  if (provider === "openai") return embedOpenAI(texts);
  return embedLocal(texts);
}

async function embedVoyage(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: process.env.VOYAGE_MODEL ?? "voyage-3-lite",
      input_type: "document",
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => truncateOrPad(d.embedding, 384));
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      dimensions: 384,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Lazy-loaded transformers.js pipeline (single shared instance). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localPipeline: any = null;

async function getLocalPipeline() {
  if (!localPipeline) {
    // Dynamic import keeps the heavy wasm/onnx out of the Next.js edge bundle path.
    const { pipeline } = await import("@xenova/transformers");
    localPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return localPipeline;
}

async function embedLocal(texts: string[]): Promise<number[][]> {
  const extractor = await getLocalPipeline();
  const out: number[][] = [];
  // Batch one-by-one to keep memory bounded during seed.
  for (const text of texts) {
    const result = await extractor(text, { pooling: "mean", normalize: true });
    out.push(Array.from(result.data as Float32Array));
  }
  return out;
}

function truncateOrPad(vec: number[], dim: number): number[] {
  if (vec.length === dim) return vec;
  if (vec.length > dim) return vec.slice(0, dim);
  return [...vec, ...Array(dim - vec.length).fill(0)];
}

/** Format a vector for pgvector literal insertion. */
export function toPgvectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
