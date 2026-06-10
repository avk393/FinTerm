import { NextResponse } from 'next/server'
import { generateAnalysis } from '@/knowledge_table/analysis/engine'
import { getFundamentals } from '@/lib/market/fundamentals'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params
    const symbol = ticker.toUpperCase()

    const fundamentals = await getFundamentals(symbol)
    const { sector, ...fundamentalFields } = fundamentals

    const result = await generateAnalysis(
      symbol,
      fundamentalFields as Record<string, number | boolean>,
      sector as string,
    )

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
