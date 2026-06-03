// Pure formatting utilities. No side effects.

export function formatCurrency(n: number, opts?: { sign?: boolean }): string {
  const sign = opts?.sign && n > 0 ? "+" : n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(frac: number, opts?: { sign?: boolean }): string {
  const pct = frac * 100;
  const sign = opts?.sign ? (pct > 0 ? "+" : pct < 0 ? "-" : "") : "";
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

export function formatQty(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
