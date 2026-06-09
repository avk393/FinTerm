import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function scoreToSignal(strength: number): string {
  if (strength <= -0.5) return "strong-bearish";
  if (strength <= -0.15) return "bearish";
  if (strength < 0.15) return "neutral";
  if (strength < 0.5) return "bullish";
  return "strong-bullish";
}

export async function GET(
  req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();
  const debug = new URL(req.url).searchParams.get("debug") === "true";

  try {
    if (debug) {
      const security = await sql`
        SELECT id, ticker, industry_id FROM securities WHERE ticker = ${symbol} LIMIT 1
      `;
      if (!security.length) {
        return NextResponse.json({ step: "securities", found: false, symbol });
      }

      const { industry_id } = security[0];

      const correlations = await sql`
        SELECT indicator_id, correlation FROM correlations WHERE industry_id = ${industry_id}
        ORDER BY ABS(correlation) DESC LIMIT 5
      `;
      if (!correlations.length) {
        return NextResponse.json({ step: "correlations", found: false, industry_id });
      }

      const indicatorIds = correlations.map((r) => r.indicator_id);

      const directions = await sql`
        SELECT indicator_id, direction FROM indicator_directions
        WHERE indicator_id = ANY(${indicatorIds})
      `;

      const indicators = await sql`
        SELECT id, name FROM indicators
        WHERE id = ANY(${indicatorIds})
      `;

      return NextResponse.json({
        step: "debug",
        security: security[0],
        correlations,
        directions,
        indicators,
        missing_directions: indicatorIds.filter(
          (id) => !directions.find((d) => d.indicator_id === id)
        ),
        missing_indicators: indicatorIds.filter(
          (id) => !indicators.find((i) => i.id === id)
        ),
      });
    }

    const rows = await sql`
      SELECT
        i.id AS indicator_id,
        i.name,
        c.correlation,
        d.direction,
        (c.correlation * d.direction) AS strength
      FROM correlations c
      JOIN indicators i ON i.id = c.indicator_id
      JOIN indicator_directions d ON d.indicator_id = c.indicator_id
      WHERE c.industry_id = (
        SELECT industry_id FROM securities WHERE ticker = ${symbol} LIMIT 1
      )
      ORDER BY ABS(c.correlation) DESC
      LIMIT 5
    `;

    const indicators = rows.map((row) => ({
      id: Number(row.indicator_id),
      name: row.name as string,
      signal: scoreToSignal(Number(row.strength)),
      correlation: Number(row.correlation),
      direction: Number(row.direction),
    }));

    return NextResponse.json({ indicators });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
