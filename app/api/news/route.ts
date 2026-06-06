import { NextResponse } from "next/server";
import { getPositions } from "@/lib/alpaca";
import { getPortfolioNews } from "@/lib/perplexity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const positions = await getPositions();
    const symbols = positions.map((p) => p.symbol);
    const articles = await getPortfolioNews(symbols);
    return NextResponse.json(articles);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
