import { NextResponse } from "next/server";
import {
  applyIngest,
  proposeIngest,
  PRESET_INPUTS,
  type IngestProposal,
} from "@/lib/ingest/pipeline";
import { resetStore } from "@/lib/store/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ presets: PRESET_INPUTS });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: "propose" | "apply" | "reset";
    text?: string;
    source?: "email" | "review" | "support";
    customerId?: string;
    productSku?: string;
    rating?: number;
    proposal?: IngestProposal;
  };

  try {
    if (body.action === "reset") {
      const counts = await resetStore();
      return NextResponse.json({
        ok: true,
        message: `Ontology reset to clean snapshot (${counts.nodes} nodes / ${counts.edges} edges)`,
      });
    }
    if (body.action === "propose") {
      if (!body.text || !body.source) {
        return NextResponse.json(
          { error: "text and source required" },
          { status: 400 }
        );
      }
      const proposal = await proposeIngest({
        text: body.text,
        source: body.source,
        customerId: body.customerId,
        productSku: body.productSku,
        rating: body.rating,
      });
      return NextResponse.json(proposal);
    }
    if (body.action === "apply") {
      if (!body.proposal) {
        return NextResponse.json({ error: "proposal required" }, { status: 400 });
      }
      const result = await applyIngest(body.proposal);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
