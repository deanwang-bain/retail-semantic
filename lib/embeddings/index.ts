/**
 * Portable local embeddings (384-dim) — no Docker, no model download.
 *
 * Uses a deterministic hashing trick over tokens (same space for seed + runtime).
 * Optional Voyage / OpenAI keys upgrade quality when present.
 */
export type EmbeddingProviderName = "voyage" | "openai" | "local";

export const EMBED_DIM = 384;

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
  return texts.map(embedLocal);
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
    .map((d) => truncateOrPad(d.embedding, EMBED_DIM));
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
      dimensions: EMBED_DIM,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Genuine vector — hashed n-grams, L2-normalised. Not canned per query. */
export function embedLocal(text: string): number[] {
  const vec = new Float64Array(EMBED_DIM);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    vec[0] = 1;
    return Array.from(vec);
  }
  for (const tok of tokens) {
    // unigram + character trigrams for fuzzy overlap
    accumulate(vec, tok, 1);
    for (let i = 0; i < tok.length - 2; i++) {
      accumulate(vec, tok.slice(i, i + 3), 0.35);
    }
  }
  // bigrams
  for (let i = 0; i < tokens.length - 1; i++) {
    accumulate(vec, `${tokens[i]}_${tokens[i + 1]}`, 0.6);
  }
  return l2normalize(vec);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function accumulate(vec: Float64Array, token: string, weight: number) {
  let h1 = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h1 ^= token.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
  }
  let h2 = 0x811c9dc5 ^ token.length;
  for (let i = token.length - 1; i >= 0; i--) {
    h2 = Math.imul(h2 ^ token.charCodeAt(i), 0x01000193);
  }
  const i1 = Math.abs(h1) % EMBED_DIM;
  const i2 = Math.abs(h2) % EMBED_DIM;
  vec[i1] += weight;
  vec[i2] -= weight * 0.5;
}

function l2normalize(vec: Float64Array): number[] {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Array<number>(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

function truncateOrPad(vec: number[], dim: number): number[] {
  if (vec.length === dim) return vec;
  if (vec.length > dim) return vec.slice(0, dim);
  return [...vec, ...Array(dim - vec.length).fill(0)];
}

export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // vectors are L2-normalised → cosine similarity = dot; distance = 1 - sim
  return 1 - dot;
}
