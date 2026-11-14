import { describe, expect, it } from "vitest";
import { buildEntries, searchIndex } from "@/lib/market-data/localIndex";

const entries = buildEntries({
  fields: ["ticker", "name", "exchange"],
  data: [
    ["A", "Agilent Technologies Inc.", "NYSE"],
    ["AA", "Alcoa Corp.", "NYSE"],
    ["AAPL", "Apple Inc.", "NASDAQ"],
    ["APLE", "Apple Hospitality REIT Inc.", "NYSE"],
    ["BRK-B", "Berkshire Hathaway Inc.", "NYSE"],
    ["SPY", "SPDR S&P 500 ETF Trust", "NYSE"],
    ["MSFT", "Microsoft Corp.", "NASDAQ"],
  ],
});

describe("local SEC index search", () => {
  it("ranks exact ticker, then ticker prefix, then name", () => {
    expect(searchIndex(entries, "a").map((r) => r.identifier).slice(0, 3)).toEqual(["A", "AA", "AAPL"]);
    expect(searchIndex(entries, "apple").map((r) => r.identifier)).toEqual(["AAPL", "APLE"]);
    expect(searchIndex(entries, "aapl")[0]!.identifier).toBe("AAPL");
  });

  it("matches words inside names and dotted share classes", () => {
    expect(searchIndex(entries, "hathaway")[0]!.identifier).toBe("BRK-B");
    expect(searchIndex(entries, "brk.b")[0]!.identifier).toBe("BRK-B");
  });

  it("marks ETFs only when the name says so, and never invents a sector", () => {
    const spy = searchIndex(entries, "SPY")[0]!;
    expect(spy.type).toBe("etf");
    expect(searchIndex(entries, "MSFT")[0]!.type).toBeUndefined();
    expect(searchIndex(entries, "a").every((r) => r.sector === undefined)).toBe(true);
  });

  it("limits results and ignores empty queries", () => {
    expect(searchIndex(entries, "")).toEqual([]);
    expect(searchIndex(entries, "a", 2)).toHaveLength(2);
  });
});
