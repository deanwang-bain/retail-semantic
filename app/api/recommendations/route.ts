import { NextResponse } from "next/server";
import { recommendForCustomer } from "@/lib/semantic/recommend";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("customerId");
  if (!id) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }
  try {
    const result = await recommendForCustomer(id);
    if (!result) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
