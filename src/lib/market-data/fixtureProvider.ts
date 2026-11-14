import type { MarketDataProvider, SecurityMatch } from "./types";

/**
 * DEMONSTRATION DATA. A small, hand-entered list of widely known listings
 * used to develop and test the search experience without a commercial data
 * licence. It is labelled "Demo data" wherever it appears in the UI and is
 * not a substitute for a licensed data provider. Sectors are generic labels
 * for well-known companies; funds deliberately carry no sector.
 */
export const FIXTURE_SECURITIES: SecurityMatch[] = [
  { identifier: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "stock", sector: "technology" },
  { identifier: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", type: "stock", sector: "technology" },
  { identifier: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "stock", sector: "technology" },
  { identifier: "GOOGL", name: "Alphabet Inc. Class A", exchange: "NASDAQ", type: "stock", sector: "communication" },
  { identifier: "META", name: "Meta Platforms, Inc.", exchange: "NASDAQ", type: "stock", sector: "communication" },
  { identifier: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", type: "stock", sector: "consumer_discretionary" },
  { identifier: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", type: "stock", sector: "consumer_discretionary" },
  { identifier: "COST", name: "Costco Wholesale Corporation", exchange: "NASDAQ", type: "stock", sector: "consumer_staples" },
  { identifier: "KO", name: "The Coca-Cola Company", exchange: "NYSE", type: "stock", sector: "consumer_staples" },
  { identifier: "JNJ", name: "Johnson & Johnson", exchange: "NYSE", type: "stock", sector: "health_care" },
  { identifier: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", type: "stock", sector: "financials" },
  { identifier: "V", name: "Visa Inc.", exchange: "NYSE", type: "stock", sector: "financials" },
  { identifier: "CAT", name: "Caterpillar Inc.", exchange: "NYSE", type: "stock", sector: "industrials" },
  { identifier: "XOM", name: "Exxon Mobil Corporation", exchange: "NYSE", type: "stock", sector: "energy" },
  { identifier: "LIN", name: "Linde plc", exchange: "NASDAQ", type: "stock", sector: "materials" },
  { identifier: "NEE", name: "NextEra Energy, Inc.", exchange: "NYSE", type: "stock", sector: "utilities" },
  { identifier: "O", name: "Realty Income Corporation", exchange: "NYSE", type: "stock", sector: "real_estate" },
  { identifier: "DIS", name: "The Walt Disney Company", exchange: "NYSE", type: "stock", sector: "communication" },
  { identifier: "SHEL", name: "Shell plc", exchange: "LSE", type: "stock", sector: "energy" },
  { identifier: "SHEL", name: "Shell plc (ADR)", exchange: "NYSE", type: "stock", sector: "energy" },
  { identifier: "TEVA", name: "Teva Pharmaceutical Industries", exchange: "TASE", type: "stock", sector: "health_care" },
  { identifier: "TEVA", name: "Teva Pharmaceutical Industries (ADR)", exchange: "NYSE", type: "stock", sector: "health_care" },
  { identifier: "VTI", name: "Vanguard Total Stock Market ETF", exchange: "NYSE Arca", type: "etf" },
  { identifier: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE Arca", type: "etf" },
  { identifier: "VXUS", name: "Vanguard Total International Stock ETF", exchange: "NASDAQ", type: "etf" },
  { identifier: "BND", name: "Vanguard Total Bond Market ETF", exchange: "NASDAQ", type: "etf" },
  { identifier: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", type: "etf" },
  { identifier: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", type: "etf" },
  { identifier: "VWRA", name: "Vanguard FTSE All-World UCITS ETF (Acc)", exchange: "LSE", type: "etf" },
  { identifier: "BTC", name: "Bitcoin", type: "crypto" },
  { identifier: "ETH", name: "Ether", type: "crypto" },
];

export function searchFixtures(query: string, limit = 8): SecurityMatch[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const scored = FIXTURE_SECURITIES.map((s) => {
    const id = s.identifier.toUpperCase();
    const name = s.name.toUpperCase();
    const score = id === q ? 0 : id.startsWith(q) ? 1 : name.startsWith(q) ? 2 : name.includes(q) ? 3 : -1;
    return { s, score };
  }).filter((x) => x.score >= 0);
  scored.sort((a, b) => a.score - b.score || a.s.identifier.localeCompare(b.s.identifier));
  return scored.slice(0, limit).map((x) => x.s);
}

export const fixtureProvider: MarketDataProvider = {
  info: { id: "fixture", enabled: true, label: "Demo data", isDemo: true },
  async search(query) {
    return searchFixtures(query);
  },
};
