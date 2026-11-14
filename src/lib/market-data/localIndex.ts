import type { SecurityMatch } from "./types";

/**
 * Client-side type-ahead over the static SEC ticker list
 * (public/data/us-securities.json). The list is downloaded once and searched
 * in the browser, so what the user types never leaves the device.
 */

export interface IndexFile {
  fields: string[];
  data: [ticker: string, name: string, exchange: string][];
}

export interface Entry {
  ticker: string;
  name: string;
  exchange: string;
  nameLower: string;
  /** Position in the source list (largest companies first). */
  rank: number;
}

let loading: Promise<Entry[]> | null = null;

export function loadIndex(url = "/data/us-securities.json"): Promise<Entry[]> {
  if (!loading) {
    loading = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("index unavailable");
        return r.json() as Promise<IndexFile>;
      })
      .then(buildEntries)
      .catch((e) => {
        loading = null; // allow a retry later
        throw e;
      });
  }
  return loading;
}

export function buildEntries(file: IndexFile): Entry[] {
  return file.data.map(([ticker, name, exchange], rank) => ({ ticker, name, exchange, nameLower: name.toLowerCase(), rank }));
}

/** Only the name can tell us a security is an ETF; otherwise the type is left for the user. */
function typeFromName(name: string): SecurityMatch["type"] {
  return /\bETF\b|\bETN\b/i.test(name) ? "etf" : undefined;
}

export function searchIndex(entries: Entry[], query: string, limit = 8): SecurityMatch[] {
  const q = query.trim();
  if (!q) return [];
  const upper = q.toUpperCase().replace(/[.\s]/g, "-");
  const lower = q.toLowerCase();
  const scored: { e: Entry; s: number }[] = [];
  for (const e of entries) {
    let s = -1;
    if (e.ticker === upper) s = 0; // exact ticker always first
    else if (e.ticker.startsWith(upper) || e.nameLower.startsWith(lower)) s = 1;
    else if (lower.length >= 2 && e.nameLower.includes(` ${lower}`)) s = 2;
    if (s >= 0) scored.push({ e, s });
  }
  // Within a tier, larger companies (earlier in the SEC list) come first.
  scored.sort((a, b) => a.s - b.s || a.e.rank - b.e.rank);
  return scored.slice(0, limit).map(({ e }) => ({
    identifier: e.ticker,
    name: e.name,
    exchange: e.exchange,
    type: typeFromName(e.name),
  }));
}
