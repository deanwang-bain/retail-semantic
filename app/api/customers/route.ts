import { NextResponse } from "next/server";
import { getCustomer360, listCustomers } from "@/lib/semantic/customer360";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const atRisk = searchParams.get("atRisk") === "1";
  try {
    if (id) {
      const profile = await getCustomer360(id);
      if (!profile) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      return NextResponse.json(profile);
    }
    const customers = await listCustomers({ atRiskOnly: atRisk });
    return NextResponse.json({ customers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
