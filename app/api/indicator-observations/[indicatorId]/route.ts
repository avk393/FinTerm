import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { indicatorId: string } }
) {
  const indicatorId = parseInt(params.indicatorId, 10);
  if (isNaN(indicatorId)) {
    return NextResponse.json({ error: "Invalid indicatorId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  try {
    const rows =
      start && end
        ? await sql`
            SELECT observation_date, value
            FROM indicator_observations
            WHERE indicator_id = ${indicatorId}
              AND observation_date >= ${start}::date
              AND observation_date <= ${end}::date
            ORDER BY observation_date ASC
          `
        : await sql`
            SELECT observation_date, value
            FROM indicator_observations
            WHERE indicator_id = ${indicatorId}
            ORDER BY observation_date ASC
          `;

    const points = rows.map((r) => ({
      t: new Date(r.observation_date as string).getTime(),
      v: Number(r.value),
    }));

    return NextResponse.json({ points });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
