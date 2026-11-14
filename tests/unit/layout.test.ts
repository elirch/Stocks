import { describe, expect, it } from "vitest";
import { layoutAtlas, insetRect } from "@/lib/layout/atlas";
import { squarify } from "@/lib/layout/treemap";
import { groupPositions, summarize } from "@/lib/portfolio/calc";
import { synthetic } from "./fixtures";

const area = (r: { w: number; h: number }) => r.w * r.h;

describe("squarify", () => {
  it("gives every rectangle an area proportional to its value", () => {
    const values = [500, 300, 120, 50, 20, 7, 2, 1];
    const rects = squarify(values, { x: 0, y: 0, w: 800, h: 500 });
    const sum = values.reduce((a, v) => a + v, 0);
    values.forEach((v, i) => expect(area(rects[i]!)).toBeCloseTo((v / sum) * 800 * 500, 6));
  });

  it("tiles the frame without overlap or overflow", () => {
    const rects = squarify([9, 7, 5, 3, 2, 1, 1], { x: 10, y: 20, w: 300, h: 200 });
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(r.y).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(310 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(220 + 1e-9);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ox <= 1e-6 || oy <= 1e-6).toBe(true);
      }
    expect(rects.reduce((a, r) => a + area(r), 0)).toBeCloseTo(300 * 200, 6);
  });

  it("handles empty and degenerate inputs", () => {
    expect(squarify([], { x: 0, y: 0, w: 10, h: 10 })).toHaveLength(0);
    expect(squarify([1, 2], { x: 0, y: 0, w: 0, h: 10 }).every((r) => r.w === 0)).toBe(true);
  });

  it("keeps extreme size differences exact", () => {
    const rects = squarify([1e9, 1], { x: 0, y: 0, w: 1000, h: 1000 });
    expect(area(rects[1]!)).toBeCloseTo(1e6 / (1e9 + 1), 9);
  });
});

describe("atlas layout", () => {
  it("each tile's area equals its weight × frame area (two-level exactness)", () => {
    const s = summarize(synthetic.mixed());
    const layout = layoutAtlas(groupPositions(s.drawable, "sector"), 900, 560);
    for (const t of layout.tiles) expect(area(t.rect) / (900 * 560)).toBeCloseTo(t.position.weight, 9);
    expect(layout.tiles).toHaveLength(s.drawable.length);
  });

  it("lays out 300 holdings", () => {
    const s = summarize(synthetic.manySmall());
    const layout = layoutAtlas(groupPositions(s.drawable, "sector"), 900, 560);
    expect(layout.tiles).toHaveLength(300);
  });

  it("visual insets only shrink shapes", () => {
    const r = { x: 0, y: 0, w: 1.2, h: 30 };
    const d = insetRect(r, 0.75);
    expect(area(d)).toBeLessThanOrEqual(area(r));
    expect(d.w).toBeGreaterThanOrEqual(0);
  });
});
