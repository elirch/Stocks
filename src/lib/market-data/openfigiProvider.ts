import type { InstrumentType } from "../portfolio/types";
import { ProviderError, type MarketDataProvider, type SecurityMatch } from "./types";

/**
 * OpenFIGI search adapter (https://www.openfigi.com/api).
 *
 * STATUS: implemented against the publicly documented v3 `/search` endpoint
 * but NOT verified against the live service from the development
 * environment (network access was blocked). Before enabling it publicly:
 *   1. Re-read the current OpenFIGI API documentation and Terms of Service.
 *   2. Confirm the request/response shape below still matches.
 *   3. Optionally obtain a free API key (raises rate limits).
 *
 * OpenFIGI returns identifiers, names, exchange codes and security types.
 * It does NOT return business sectors, so sectors stay Unclassified unless
 * the user supplies them. `marketSector` (e.g. "Equity") is an asset-class
 * label, not a business sector, and is deliberately not mapped to one.
 */
const ENDPOINT = "https://api.openfigi.com/v3/search";

interface FigiRecord {
  figi?: string;
  name?: string;
  ticker?: string;
  exchCode?: string;
  securityType?: string;
  securityType2?: string;
  marketSector?: string;
}

export function mapFigiType(r: FigiRecord): InstrumentType | undefined {
  const t2 = (r.securityType2 ?? "").toLowerCase();
  const t = (r.securityType ?? "").toLowerCase();
  if (t.includes("etp") || t.includes("etf") || t2 === "etp") return "etf";
  if (t2.includes("mutual fund") || t.includes("fund")) return "mutual_fund";
  if (t2 === "common stock" || t2 === "depositary receipt" || t.includes("common stock")) return "stock";
  if ((r.marketSector ?? "").toLowerCase() === "corp" || (r.marketSector ?? "").toLowerCase() === "govt") return "bond";
  return undefined;
}

export function mapFigiRecords(records: FigiRecord[], limit = 8): SecurityMatch[] {
  const seen = new Set<string>();
  const out: SecurityMatch[] = [];
  for (const r of records) {
    if (!r.ticker || !r.name) continue;
    const key = `${r.ticker}@${r.exchCode ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      identifier: r.ticker,
      name: r.name,
      exchange: r.exchCode,
      type: mapFigiType(r),
      providerId: r.figi,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function createOpenFigiProvider(apiKey?: string, fetchImpl: typeof fetch = fetch): MarketDataProvider {
  return {
    info: {
      id: "openfigi",
      enabled: true,
      label: "OpenFIGI",
      attribution: "Security identifiers via OpenFIGI.",
      isDemo: false,
    },
    async search(query, signal) {
      const res = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { "X-OPENFIGI-APIKEY": apiKey } : {}) },
        body: JSON.stringify({ query }),
        signal,
      });
      if (res.status === 429) throw new ProviderError("Search is busy. Try again in a minute.", 429);
      if (!res.ok) throw new ProviderError("Security search is temporarily unavailable.", 502);
      const body = (await res.json()) as { data?: FigiRecord[] };
      return mapFigiRecords(Array.isArray(body.data) ? body.data : []);
    },
  };
}
