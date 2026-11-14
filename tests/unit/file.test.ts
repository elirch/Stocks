import { describe, expect, it } from "vitest";
import { parsePortfolioFile, toFile } from "@/lib/persistence/file";
import { deserializeDraft, serializeDraft } from "@/lib/persistence/local";
import { parsePastedHoldings } from "@/lib/portfolio/paste";
import { h, portfolio, testId } from "./fixtures";

const valid = (holdings: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: "portfolio-atlas", version: 1, currency: "EUR", title: "T", holdings, ...extra });

describe("portfolio file import/export", () => {
  it("round-trips a portfolio", () => {
    const d = portfolio(
      [h("VTI", "1000", { type: "etf" }), h("AAPL", "12,500.5", { sector: "technology", exchange: "NASDAQ" }), h("CASH", "40", { type: "cash" })],
      "ILS",
    );
    const res = parsePortfolioFile(JSON.stringify(toFile(d)), testId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.currency).toBe("ILS");
    expect(res.draft.holdings.map((x) => [x.identifier, x.valueText, x.type, x.sector, x.exchange])).toEqual([
      ["VTI", "1000", "etf", null, ""],
      ["AAPL", "12500.5", "stock", "technology", "NASDAQ"],
      ["CASH", "40", "cash", null, ""],
    ]);
  });

  it("export never includes rows with invalid values", () => {
    const f = toFile(portfolio([h("A", "100"), h("B", "nope")]));
    expect(f.holdings).toHaveLength(1);
  });

  it.each([
    ["not json", "{oops"],
    ["wrong format", JSON.stringify({ format: "other", version: 1 })],
    ["wrong version", JSON.stringify({ format: "portfolio-atlas", version: 99 })],
    ["bad currency", valid([], { currency: "XX" })],
    ["holdings not array", valid({})],
    ["negative value", valid([{ identifier: "A", name: "", value: -5, type: "stock", sector: null }])],
    ["string value", valid([{ identifier: "A", name: "", value: "5", type: "stock", sector: null }])],
    ["non-finite", valid([{ identifier: "A", name: "", value: 1e400, type: "stock", sector: null }])],
    ["identifier not text", valid([{ identifier: { x: 1 }, name: "", value: 5 }])],
    ["too many holdings", valid(Array.from({ length: 1001 }, () => ({ identifier: "A", name: "", value: 1 })))],
  ])("rejects %s", (_label, text) => {
    expect(parsePortfolioFile(text, testId).ok).toBe(false);
  });

  it("rejects oversized files", () => {
    expect(parsePortfolioFile("x".repeat(1_000_001), testId).ok).toBe(false);
  });

  it("downgrades unknown types/sectors with warnings and strips sectors from funds", () => {
    const res = parsePortfolioFile(
      valid([
        { identifier: "A", name: "", value: 5, type: "warrant", sector: "space" },
        { identifier: "QQQ", name: "", value: 5, type: "etf", sector: "technology" },
      ]),
      testId,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.draft.holdings[0]!.type).toBe("unknown");
    expect(res.draft.holdings[0]!.sector).toBeNull();
    expect(res.draft.holdings[1]!.sector).toBeNull();
    expect(res.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("ignores prototype-pollution style keys", () => {
    const res = parsePortfolioFile(
      '{"format":"portfolio-atlas","version":1,"currency":"USD","holdings":[],"__proto__":{"polluted":true}}',
      testId,
    );
    expect(res.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("local draft storage", () => {
  it("keeps unfinished rows exactly as typed", () => {
    const d = portfolio([h("A", "12,5"), h("", "")]);
    const back = deserializeDraft(serializeDraft(d), testId)!;
    expect(back.holdings.map((x) => x.valueText)).toEqual(["12,5", ""]);
  });

  it("rejects corrupted storage", () => {
    expect(deserializeDraft("garbage", testId)).toBeNull();
    expect(deserializeDraft(JSON.stringify({ v: 1, currency: "nope", holdings: [] }), testId)).toBeNull();
  });
});

describe("paste parsing", () => {
  it("parses tabs, commas and semicolons; skips header row", () => {
    const res = parsePastedHoldings("Ticker,Value\nAAPL, 12000\nVTI\tVanguard Total\t25,000\nCASH;4000", testId, 100);
    expect(res.holdings.map((x) => [x.identifier, x.name, x.valueText, x.type])).toEqual([
      ["AAPL", "", "12000", "unknown"],
      ["VTI", "Vanguard Total", "25000", "unknown"],
      ["CASH", "", "4000", "cash"],
    ]);
    expect(res.skipped).toHaveLength(0);
  });

  it("skips ambiguous comma thousands instead of guessing", () => {
    const res = parsePastedHoldings("AAPL, 12,000", testId, 100);
    expect(res.holdings).toHaveLength(0);
    expect(res.skipped[0]!.reason).toMatch(/Ambiguous/);
    const quoted = parsePastedHoldings('AAPL, "12,000"', testId, 100);
    expect(quoted.holdings[0]!.valueText).toBe("12000");
  });

  it("reports negative and invalid lines", () => {
    const res = parsePastedHoldings("A, -5\nB, abc\nC", testId, 100);
    expect(res.holdings).toHaveLength(0);
    expect(res.skipped).toHaveLength(3);
  });

  it("respects the limit", () => {
    const res = parsePastedHoldings("A,1\nB,2\nC,3", testId, 2);
    expect(res.holdings).toHaveLength(2);
    expect(res.skipped).toHaveLength(1);
  });
});
