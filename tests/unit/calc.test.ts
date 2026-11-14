import { describe, expect, it } from "vitest";
import { groupPositions, summarize, topNConcentration } from "@/lib/portfolio/calc";
import { computeInsights } from "@/lib/portfolio/insights";
import { formatPercent } from "@/lib/format/format";
import { h, portfolio, synthetic } from "./fixtures";

describe("summarize / weights", () => {
  it("computes weights that sum to 1 from valid rows only", () => {
    const s = summarize(portfolio([h("A", "600"), h("B", "300"), h("C", "100"), h("BAD", "12abc")]));
    expect(s.total).toBe(1000);
    expect(s.positions.map((p) => p.weight)).toEqual([0.6, 0.3, 0.1]);
    expect(s.excluded).toHaveLength(1);
    expect(s.excluded[0]!.issue).toBe("not_a_number");
  });

  it("ranks by value descending, deterministically", () => {
    const s = summarize(portfolio([h("B", "100"), h("A", "100"), h("C", "500")]));
    expect(s.positions.map((p) => p.identifier)).toEqual(["C", "A", "B"]);
    expect(s.positions.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it("handles a single holding", () => {
    const s = summarize(synthetic.single());
    expect(s.positions[0]!.weight).toBe(1);
    const i = computeInsights(s);
    expect(i.topN).toBe(1);
    expect(i.observations[0]!.text).toContain("100%");
  });

  it("handles empty input and blank rows", () => {
    const s = summarize(portfolio([h("", ""), h("", "")]));
    expect(s.total).toBe(0);
    expect(s.positions).toHaveLength(0);
    expect(s.blankCount).toBe(2);
    expect(computeInsights(s).largest).toBeNull();
  });

  it("handles a zero total without dividing by zero", () => {
    const s = summarize(portfolio([h("A", "0"), h("B", "0")]));
    expect(s.total).toBe(0);
    expect(s.positions.every((p) => p.weight === 0)).toBe(true);
    expect(s.drawable).toHaveLength(0);
  });

  it("keeps zero-value holdings listed but not drawable", () => {
    const s = summarize(portfolio([h("A", "100"), h("Z", "0")]));
    expect(s.positions).toHaveLength(2);
    expect(s.drawable.map((p) => p.identifier)).toEqual(["A"]);
  });

  it("keeps very small positions with their exact (tiny) weight", () => {
    const s = summarize(synthetic.concentrated());
    const tiny = s.positions.find((p) => p.identifier === "TINY3")!;
    expect(tiny.weight).toBeCloseTo(0.5 / 990055.5, 12);
    expect(formatPercent(tiny.weight)).toBe("<0.1%");
  });

  it("handles many small holdings", () => {
    const s = summarize(synthetic.manySmall());
    expect(s.positions).toHaveLength(300);
    expect(s.positions.reduce((a, p) => a + p.weight, 0)).toBeCloseTo(1, 10);
  });

  it("labels unnamed holdings sensibly", () => {
    const s = summarize(portfolio([h("", "10", { name: "" }), h("XYZ", "5")]));
    expect(s.positions[0]!.label).toBe("Unnamed holding");
    expect(s.positions[1]!.label).toBe("XYZ");
  });
});

describe("concentration", () => {
  it("top-3 concentration sums the three largest weights", () => {
    const s = summarize(portfolio([h("A", "40"), h("B", "30"), h("C", "20"), h("D", "10")]));
    expect(topNConcentration(s.positions, 3)).toBeCloseTo(0.9, 12);
    const i = computeInsights(s);
    expect(i.topNWeight).toBeCloseTo(0.9, 12);
    expect(i.observations.find((o) => o.id === "top3")!.text).toBe(
      "Your three largest positions account for 90.0% of the holdings you entered.",
    );
  });

  it("highly concentrated portfolio", () => {
    const i = computeInsights(summarize(synthetic.concentrated()));
    expect(i.largest!.identifier).toBe("BIG");
    expect(i.largest!.weight).toBeGreaterThan(0.999);
    expect(formatPercent(i.largest!.weight)).toBe(">99.9%");
  });
});

describe("groups: unclassified, funds, cash", () => {
  it("keeps unknown securities in totals and groups them as Unclassified", () => {
    const s = summarize(synthetic.mixed());
    const groups = groupPositions(s.drawable, "sector");
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("unclassified");
    expect(keys).toContain("funds");
    expect(keys).toContain("cash");
    expect(keys).toContain("crypto");
    expect(keys).toContain("sector:technology");
    expect(groups.reduce((a, g) => a + g.value, 0)).toBe(s.total);
    const unc = groups.find((g) => g.key === "unclassified")!;
    expect(unc.positions.map((p) => p.label)).toEqual(["Private co."]);
  });

  it("never assigns a business sector group to a fund, even if one was set", () => {
    const s = summarize(portfolio([h("QQQ", "100", { type: "etf", sector: "technology" })]));
    const groups = groupPositions(s.drawable, "sector");
    expect(groups.map((g) => g.key)).toEqual(["funds"]);
  });

  it("groups by type when asked", () => {
    const groups = groupPositions(summarize(synthetic.mixed()).drawable, "type");
    expect(groups.map((g) => g.key).sort()).toEqual(["type:cash", "type:crypto", "type:etf", "type:stock"].sort());
  });

  it("reports fund and unclassified shares as neutral observations", () => {
    const i = computeInsights(summarize(synthetic.mixed()));
    expect(i.fundWeight).toBeCloseTo(20500 / 36800, 12);
    expect(i.unclassifiedCount).toBe(1);
    const text = i.observations.map((o) => o.text).join(" ");
    expect(text).not.toMatch(/\b(should|buy|sell|risky|safe|good|bad|recommend)\b/i);
  });
});
