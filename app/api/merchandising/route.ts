import { NextResponse } from "next/server";
import { merchandisingQuery } from "@/lib/semantic/merchandising";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { query?: string };
  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }
  try {
    const result = await merchandisingQuery(body.query.trim());
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
