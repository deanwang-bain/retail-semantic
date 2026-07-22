import { NextResponse } from "next/server";
import {
  fetchOntologyGraph,
  getGraphStats,
  getNodeDetails,
} from "@/lib/ontology/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "graph";

  try {
    if (view === "stats") {
      const stats = await getGraphStats();
      return NextResponse.json(stats);
    }
    if (view === "node") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }
      const details = await getNodeDetails(id);
      return NextResponse.json(details);
    }

    const typesParam = searchParams.get("types");
    const types = typesParam ? typesParam.split(",").filter(Boolean) : undefined;
    const search = searchParams.get("search") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? 180);
    const graph = await fetchOntologyGraph({ types, search, limit });
    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
