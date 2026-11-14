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
  return file.data.map(([ticker, name, exchange]) => ({ ticker, name, exchange, nameLower: name.toLowerCase() }));
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
    if (e.ticker === upper) s = 0;
    else if (e.ticker.startsWith(upper)) s = 1 + e.ticker.length / 100;
    else if (e.nameLower.startsWith(lower)) s = 2;
    else if (lower.length >= 2 && e.nameLower.includes(` ${lower}`)) s = 3;
    if (s >= 0) scored.push({ e, s });
  }
  scored.sort((a, b) => a.s - b.s || a.e.ticker.length - b.e.ticker.length || a.e.ticker.localeCompare(b.e.ticker));
  return scored.slice(0, limit).map(({ e }) => ({
    identifier: e.ticker,
    name: e.name,
    exchange: e.exchange,
    type: typeFromName(e.name),
  }));
}
