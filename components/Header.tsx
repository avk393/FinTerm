"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ticker = query.trim().toUpperCase();
    if (!ticker || searching) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/securities/${encodeURIComponent(ticker)}`);
      const data = (await res.json()) as { found?: boolean };
      if (res.ok && data.found) {
        router.push(`/stocks/${ticker}`);
      } else {
        router.push(`/stocks/${ticker}/unavailable`);
      }
    } catch {
      router.push(`/stocks/${ticker}/unavailable`);
    } finally {
      setSearching(false);
    }
  }

  return (
    <header className="flex items-center gap-6 px-8 py-4">
      {/* Logo mark */}
      <div className="shrink-0 text-rh-green">
        <svg width="26" height="30" viewBox="0 0 26 30" fill="currentColor">
          <path d="M3 28V6c0-2 1.5-3.5 3.5-3.5 4 0 7 2 10 6l1.5 2-3 2.2c-1.8-2.6-3.6-4-5.8-4-1 0-1.7.6-1.7 1.8V28H3z" />
          <circle cx="18.5" cy="20" r="2.5" />
        </svg>
      </div>

      {/* Search */}
      <form
        onSubmit={handleSubmit}
        className="flex max-w-xl flex-1 items-center gap-3 rounded-lg bg-rh-elevated px-4 py-2.5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-rh-muted">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full bg-transparent text-sm uppercase text-rh-text placeholder:normal-case placeholder:text-rh-muted focus:outline-none"
        />
      </form>
    </header>
  );
}
