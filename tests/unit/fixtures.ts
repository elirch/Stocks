import type { HoldingDraft, InstrumentType, PortfolioDraft, Sector } from "@/lib/portfolio/types";

let n = 0;
export const testId = () => `t${++n}`;

export function h(
  identifier: string,
  valueText: string,
  opts: Partial<{ name: string; type: InstrumentType; sector: Sector | null; exchange: string }> = {},
): HoldingDraft {
  return {
    id: testId(),
    identifier,
    exchange: opts.exchange ?? "",
    name: opts.name ?? "",
    valueText,
    type: opts.type ?? "stock",
    sector: opts.sector ?? null,
    source: "manual",
  };
}

export function portfolio(holdings: HoldingDraft[], currency = "USD"): PortfolioDraft {
  return { currency, title: "Test", holdings, dismissedDuplicates: [] };
}

/** Synthetic portfolios used across tests (never real people's data). */
export const synthetic = {
  single: () => portfolio([h("ONE", "5000", { sector: "technology" })]),
  manySmall: () =>
    portfolio(Array.from({ length: 300 }, (_, i) => h(`S${i}`, String(10 + (i % 7)), { sector: i % 2 ? "energy" : null }))),
  concentrated: () =>
    portfolio([h("BIG", "990000", { sector: "financials" }), h("TINY1", "50"), h("TINY2", "5"), h("TINY3", "0.5")]),
  mixed: () =>
    portfolio([
      h("VTI", "18000", { type: "etf" }),
      h("AAPL", "9000", { sector: "technology" }),
      h("CASH", "6000", { type: "cash" }),
      h("", "500", { name: "Private co." }),
      h("BND", "2500", { type: "etf" }),
      h("BTC", "800", { type: "crypto" }),
    ]),
};
