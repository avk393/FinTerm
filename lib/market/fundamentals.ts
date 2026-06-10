export interface Fundamentals {
  pe_ratio: number
  revenue_growth: number   // decimal, e.g. 0.12 = 12% YoY
  has_gov_contracts: boolean
  sector: string
  [key: string]: number | boolean | string
}

// TODO: wire to a real market-data source (e.g. Alpaca, Financial Modeling Prep, or Polygon.io).
// The fields here must match the `field` values used in thesis_beliefs.signals JSON.
export async function getFundamentals(_ticker: string): Promise<Fundamentals> {
  return {
    pe_ratio: 0,
    revenue_growth: 0,
    has_gov_contracts: false,
    sector: '',
  }
}
