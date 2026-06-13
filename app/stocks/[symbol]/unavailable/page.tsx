import Link from "next/link";

interface Props {
  params: Promise<{ symbol: string }>;
}

export default async function UnavailablePage({ params }: Props) {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();

  return (
    <div className="min-h-screen bg-rh-bg">
      <header className="border-b border-rh-border px-8 py-4">
        <Link href="/" className="text-sm text-rh-muted hover:text-rh-text transition-colors">
          ← Back
        </Link>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col items-center justify-center gap-4 px-8 py-32 text-center">
        <h1 className="text-2xl font-bold">{ticker}</h1>
        <p className="text-lg text-rh-muted">
          Analysis for {ticker} is not available yet.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-lg bg-rh-elevated px-4 py-2 text-sm font-medium text-rh-text hover:bg-rh-border transition-colors"
        >
          Return to portfolio
        </Link>
      </main>
    </div>
  );
}
