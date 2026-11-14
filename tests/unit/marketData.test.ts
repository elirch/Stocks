import { describe, expect, it, vi } from "vitest";
import { FIXTURE_SECURITIES, searchFixtures } from "@/lib/market-data/fixtureProvider";
import { createOpenFigiProvider, mapFigiRecords } from "@/lib/market-data/openfigiProvider";
import { createRateLimiter, validateQuery } from "@/lib/market-data/rateLimit";

describe("fixture provider", () => {
  it("finds by ticker and name", () => {
    expect(searchFixtures("aapl")[0]!.identifier).toBe("AAPL");
    expect(searchFixtures("vanguard").length).toBeGreaterThan(1);
  });

  it("never gives funds a business sector", () => {
    for (const s of FIXTURE_SECURITIES) if (s.type === "etf" || s.type === "mutual_fund") expect(s.sector).toBeUndefined();
  });

  it("returns the same ticker on different exchanges as separate results", () => {
    const shel = searchFixtures("SHEL");
    expect(new Set(shel.map((s) => s.exchange)).size).toBe(2);
  });
});

describe("OpenFIGI adapter (mocked HTTP — not the live service)", () => {
  it("sends only the query text and maps records without inventing sectors", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            { figi: "BBG1", name: "APPLE INC", ticker: "AAPL", exchCode: "US", securityType: "Common Stock", securityType2: "Common Stock", marketSector: "Equity" },
            { figi: "BBG2", name: "SPDR S&P 500", ticker: "SPY", exchCode: "US", securityType: "ETP", securityType2: "Mutual Fund", marketSector: "Equity" },
            { figi: "BBG3", name: "APPLE INC", ticker: "AAPL", exchCode: "US" },
          ],
        }),
        { status: 200 },
      ),
    );
    const p = createOpenFigiProvider(undefined, fetchMock as unknown as typeof fetch);
    const res = await p.search("apple");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ query: "apple" });
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ identifier: "AAPL", type: "stock" });
    expect(res[1]).toMatchObject({ identifier: "SPY", type: "etf" });
    expect(res.every((r) => r.sector === undefined)).toBe(true);
  });

  it("surfaces rate limiting as a friendly error", async () => {
    const p = createOpenFigiProvider("k", (async () => new Response("", { status: 429 })) as unknown as typeof fetch);
    await expect(p.search("x")).rejects.toThrow(/busy/);
  });

  it("skips records without ticker or name", () => {
    expect(mapFigiRecords([{ name: "X" }, { ticker: "Y" }])).toHaveLength(0);
  });
});

describe("request guards", () => {
  it("validates search queries", () => {
    expect(validateQuery("AAPL")).toBe("AAPL");
    expect(validateQuery(" Berkshire Hathaway B ")).toBe("Berkshire Hathaway B");
    expect(validateQuery("")).toBeNull();
    expect(validateQuery("<script>")).toBeNull();
    expect(validateQuery("x".repeat(41))).toBeNull();
    expect(validateQuery(null)).toBeNull();
  });

  it("rate-limits per key per window", () => {
    const check = createRateLimiter(2, 1000);
    expect(check("ip", 0).allowed).toBe(true);
    expect(check("ip", 1).allowed).toBe(true);
    expect(check("ip", 2).allowed).toBe(false);
    expect(check("other", 2).allowed).toBe(true);
    expect(check("ip", 1001).allowed).toBe(true);
  });
});
