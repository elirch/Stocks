/** Formats a 0..1 weight as a percentage that never rounds a non-zero share to "0%". */
export function formatPercent(weight: number, digits = 1): string {
  if (!Number.isFinite(weight) || weight <= 0) return "0%";
  const pct = weight * 100;
  const min = 1 / 10 ** digits;
  if (pct < min) return `<${min.toFixed(digits)}%`;
  if (pct > 100 - min && pct < 100) return `>${(100 - min).toFixed(digits)}%`;
  return `${pct.toFixed(digits)}%`;
}

/**
 * Formats an amount in the portfolio currency. Whole amounts drop the
 * decimals; fractional amounts keep the currency's usual precision, so
 * nothing is silently rounded. `compact` (e.g. "$12.4K") is for tight labels.
 */
export function formatMoney(value: number, currency: string, compact = false): string {
  try {
    const opts: Intl.NumberFormatOptions = compact
      ? { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }
      : Number.isInteger(value)
        ? { style: "currency", currency, maximumFractionDigits: 0 }
        : { style: "currency", currency };
    return new Intl.NumberFormat("en-US", opts).format(value);
  } catch {
    return `${value.toLocaleString("en-US")} ${currency}`;
  }
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(d);
}
