import { NextResponse } from "next/server";
import { getStockBars } from "@/lib/alpaca";
import type { TimeRange } from "@/types/portfolio";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const url = new URL(_req.url);
  const range = (url.searchParams.get("range") ?? "1D") as TimeRange;
  try {
    return NextResponse.json(await getStockBars(symbol, range));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
