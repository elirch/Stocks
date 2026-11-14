import type { HoldingDraft, InstrumentType, PortfolioDraft, Sector } from "./types";

type Row = [identifier: string, name: string, value: number, type: InstrumentType, sector: Sector | null];

/**
 * A fictional example portfolio. Amounts are invented for demonstration and
 * do not describe any real person's holdings. Sectors are entered by hand,
 * exactly as a user would, and funds deliberately carry no sector.
 */
const ROWS: Row[] = [
  ["VTI", "Vanguard Total Stock Market ETF", 18400, "etf", null],
  ["AAPL", "Apple", 9200, "stock", "technology"],
  ["MSFT", "Microsoft", 7600, "stock", "technology"],
  ["CASH", "Savings cash", 6000, "cash", null],
  ["VXUS", "Vanguard Total International Stock ETF", 5800, "etf", null],
  ["JNJ", "Johnson & Johnson", 3100, "stock", "health_care"],
  ["JPM", "JPMorgan Chase", 2900, "stock", "financials"],
  ["BND", "Vanguard Total Bond Market ETF", 2700, "etf", null],
  ["NVDA", "NVIDIA", 2500, "stock", "technology"],
  ["COST", "Costco", 1650, "stock", "consumer_staples"],
  ["NEE", "NextEra Energy", 1200, "stock", "utilities"],
  ["XOM", "Exxon Mobil", 950, "stock", "energy"],
  ["BTC", "Bitcoin", 800, "crypto", null],
  ["CAT", "Caterpillar", 640, "stock", "industrials"],
  ["", "Employer stock plan (unlisted)", 520, "stock", null],
  ["O", "Realty Income", 310, "stock", "real_estate"],
  ["LIN", "Linde", 180, "stock", "materials"],
  ["DIS", "Disney", 90, "stock", "communication"],
];

export function examplePortfolio(makeId: () => string): PortfolioDraft {
  const holdings: HoldingDraft[] = ROWS.map(([identifier, name, value, type, sector]) => ({
    id: makeId(),
    identifier,
    exchange: "",
    name,
    valueText: String(value),
    type,
    sector,
    source: "manual",
  }));
  return { currency: "USD", title: "Example portfolio", holdings, dismissedDuplicates: [], isExample: true };
}

export function emptyPortfolio(makeId: () => string, currency = "USD"): PortfolioDraft {
  return { currency, title: "My portfolio", holdings: [blankHolding(makeId)], dismissedDuplicates: [] };
}

export function blankHolding(makeId: () => string): HoldingDraft {
  return { id: makeId(), identifier: "", exchange: "", name: "", valueText: "", type: "unknown", sector: null, source: "manual" };
}
