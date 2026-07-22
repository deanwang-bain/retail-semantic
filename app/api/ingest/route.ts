import { NextResponse } from "next/server";
import {
  applyIngest,
  proposeIngest,
  PRESET_INPUTS,
  type IngestProposal,
} from "@/lib/ingest/pipeline";
import { spawn } from "child_process";
import path from "path";

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
      await runSeed();
      return NextResponse.json({ ok: true, message: "Ontology reset to clean seed" });
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

function runSeed(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["tsx", path.join(process.cwd(), "scripts/seed.ts")],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `seed exited ${code}`));
    });
  });
}
