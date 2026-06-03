import { NextRequest, NextResponse } from "next/server";
import { getPortfolioHistory } from "@/lib/alpaca";
import type { TimeRange } from "@/types/portfolio";

export const dynamic = "force-dynamic";

const VALID: TimeRange[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"];

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("range") ?? "1D";
    const range = (VALID.includes(raw as TimeRange) ? raw : "1D") as TimeRange;
    return NextResponse.json(await getPortfolioHistory(range));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
