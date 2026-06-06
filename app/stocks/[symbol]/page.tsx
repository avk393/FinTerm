import StockDetail from "@/components/StockDetail";

interface Props {
  params: Promise<{ symbol: string }>;
}

export default async function StockPage({ params }: Props) {
  const { symbol } = await params;
  return <StockDetail symbol={symbol} />;
}
