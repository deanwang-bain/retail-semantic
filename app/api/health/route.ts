import { NextResponse } from "next/server";
import { checkNeo4jHealth } from "@/lib/ontology/neo4j";
import { checkPostgresHealth } from "@/lib/db/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const [neo4j, postgres] = await Promise.all([
    checkNeo4jHealth(),
    checkPostgresHealth(),
  ]);

  const ok = neo4j.ok && postgres.ok;

  return NextResponse.json(
    {
      ok,
      neo4j,
      postgres,
      ai: {
        embeddings: process.env.VOYAGE_API_KEY
          ? "voyage"
          : process.env.OPENAI_API_KEY
            ? "openai"
            : "local",
        llm: process.env.ANTHROPIC_API_KEY ? "claude" : "simulated",
      },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
