import { describe, expect, it } from "vitest";
import { dismissGroup, findDuplicates, mergeDuplicates } from "@/lib/portfolio/duplicates";
import { h } from "./fixtures";

describe("duplicates", () => {
  it("flags same identifier + same exchange (case-insensitive)", () => {
    const rows = [h("aapl", "100"), h("AAPL ", "50"), h("MSFT", "10")];
    const { groups } = findDuplicates(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.ids).toEqual([rows[0]!.id, rows[1]!.id]);
  });

  it("never treats the same ticker on different exchanges as a duplicate", () => {
    const rows = [h("SHEL", "100", { exchange: "LSE" }), h("SHEL", "50", { exchange: "NYSE" })];
    const res = findDuplicates(rows);
    expect(res.groups).toHaveLength(0);
    expect(res.sameTickerDifferentExchange[0]!.identifier).toBe("SHEL");
    expect(mergeDuplicates(rows, rows.map((r) => r.id))).toBeNull();
  });

  it("ignores rows without an identifier", () => {
    expect(findDuplicates([h("", "1", { name: "x" }), h("", "2", { name: "x" })]).groups).toHaveLength(0);
  });

  it("merges by adding values into the first row", () => {
    const rows = [h("VTI", "100.10", { type: "etf" }), h("X", "1"), h("vti", "0.20", { name: "Vanguard" })];
    const merged = mergeDuplicates(rows, [rows[0]!.id, rows[2]!.id])!;
    expect(merged).toHaveLength(2);
    expect(merged[0]!.valueText).toBe("100.3");
    expect(merged[0]!.name).toBe("Vanguard");
  });

  it("refuses to merge when a value is invalid", () => {
    const rows = [h("A", "100"), h("A", "oops")];
    expect(mergeDuplicates(rows, rows.map((r) => r.id))).toBeNull();
  });

  it("'keep separate' dismisses the pair", () => {
    const rows = [h("A", "1"), h("A", "2")];
    const dismissed = dismissGroup([], rows.map((r) => r.id));
    expect(findDuplicates(rows, dismissed).groups).toHaveLength(0);
    // A third copy re-opens the question.
    const rows3 = [...rows, h("A", "3")];
    expect(findDuplicates(rows3, dismissed).groups).toHaveLength(1);
  });
});
