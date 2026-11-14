import { describe, expect, it } from "vitest";
import { isValidCurrencyCode } from "@/lib/portfolio/currency";
import { summarize } from "@/lib/portfolio/calc";
import { parseValue } from "@/lib/portfolio/validate";
import { formatMoney, formatPercent } from "@/lib/format/format";
import { h, portfolio } from "./fixtures";

describe("parseValue", () => {
  it.each([
    ["12500", 12500],
    ["12,500.50", 12500.5],
    ["12 500", 12500],
    ["12'500", 12500],
    [" 0.75 ", 0.75],
    [".5", 0.5],
    ["0", 0],
  ])("accepts %j", (input, expected) => {
    const r = parseValue(input);
    expect(r.ok && r.value).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "not_a_number"],
    ["12.5.3", "not_a_number"],
    ["1e5", "not_a_number"],
    ["NaN", "not_a_number"],
    ["Infinity", "not_a_number"],
    ["$500", "not_a_number"],
    ["500 EUR", "not_a_number"],
    ["-500", "negative"],
    ["(500)", "negative"],
    ["−500", "negative"],
    ["9999999999999999", "too_large"],
  ])("rejects %j as %s", (input, issue) => {
    const r = parseValue(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue).toBe(issue);
  });

  it("explains that shorts and liabilities aren't supported", () => {
    const r = parseValue("-100");
    expect(!r.ok && r.message).toMatch(/short positions/i);
  });
});

describe("currency assumptions", () => {
  it("validates ISO currency codes", () => {
    expect(isValidCurrencyCode("USD")).toBe(true);
    expect(isValidCurrencyCode("ILS")).toBe(true);
    expect(isValidCurrencyCode("usd")).toBe(false);
    expect(isValidCurrencyCode("US")).toBe(false);
    expect(isValidCurrencyCode(42)).toBe(false);
  });

  it("does not convert: changing currency relabels but keeps every number", () => {
    const holdings = [h("A", "1000"), h("B", "3000")];
    const usd = summarize(portfolio(holdings, "USD"));
    const eur = summarize(portfolio(holdings, "EUR"));
    expect(eur.total).toBe(usd.total);
    expect(eur.positions.map((p) => p.weight)).toEqual(usd.positions.map((p) => p.weight));
    expect(eur.currency).toBe("EUR");
  });

  it("rejects values typed with a currency symbol rather than guessing", () => {
    const s = summarize(portfolio([h("A", "€1000"), h("B", "1000")]));
    expect(s.total).toBe(1000);
    expect(s.excluded).toHaveLength(1);
  });

  it("formats money in the portfolio currency", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(12345, "EUR")).toBe("€12,345");
  });
});

describe("formatPercent", () => {
  it("never shows a non-zero share as 0%", () => {
    expect(formatPercent(0.0004)).toBe("<0.1%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.1234)).toBe("12.3%");
    expect(formatPercent(1)).toBe("100.0%");
  });
});
