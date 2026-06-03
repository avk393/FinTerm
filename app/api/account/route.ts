import { NextResponse } from "next/server";
import { getAccount } from "@/lib/alpaca";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getAccount());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
