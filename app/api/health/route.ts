import { NextResponse } from "next/server";
import { ensureStore } from "@/lib/store/runtime";
import { getStore } from "@/lib/store/types";
import { getLlmMode } from "@/lib/llm";
import { getEmbeddingProviderName } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    await ensureStore();
    const counts = getStore().counts();
    return NextResponse.json({
      ok: true,
      store: {
        ok: true,
        kind: "embedded",
        latencyMs: Date.now() - start,
        nodes: counts.totalNodes,
        edges: counts.totalEdges,
        embeddings: getStore().embeddings.size,
      },
      ai: {
        embeddings: getEmbeddingProviderName(),
        llm: getLlmMode() === "live" ? "claude" : "simulated",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        store: {
          ok: false,
          kind: "embedded",
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        },
        ai: {
          embeddings: getEmbeddingProviderName(),
          llm: getLlmMode() === "live" ? "claude" : "simulated",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
