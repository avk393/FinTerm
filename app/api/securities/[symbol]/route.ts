import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();

  try {
    const rows = await sql`
      SELECT ticker FROM securities WHERE ticker = ${ticker} LIMIT 1
    `;
    return NextResponse.json({ ticker, found: rows.length > 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
