import { NextResponse } from "next/server";
import { semanticProductSearch } from "@/lib/semantic/search";
import { getLlmMode } from "@/lib/llm";
import { getEmbeddingProviderName } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { query?: string };
  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }
  try {
    const result = await semanticProductSearch(body.query.trim());
    return NextResponse.json({
      ...result,
      providers: { llm: getLlmMode(), embeddings: getEmbeddingProviderName() },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
