import type { Group } from "../portfolio/calc";
import type { GroupKey } from "../portfolio/taxonomy";
import type { Position } from "../portfolio/types";
import { squarify, type Rect } from "./treemap";

export interface AtlasTile {
  id: string;
  groupKey: GroupKey;
  rect: Rect;
  position: Position;
}

export interface AtlasRegion {
  key: GroupKey;
  rect: Rect;
  group: Group;
}

export interface AtlasLayout {
  width: number;
  height: number;
  regions: AtlasRegion[];
  tiles: AtlasTile[];
  /** Pixel area that represents 100% of the shown value. */
  areaPerWhole: number;
}

/**
 * Two-level atlas: regions (groups) first, then holdings inside each region.
 * Because both levels are area-exact, each tile's area is exactly its share
 * of the value shown (whole portfolio, or the focused region when zoomed).
 */
export function layoutAtlas(groups: Group[], width: number, height: number): AtlasLayout {
  const frame: Rect = { x: 0, y: 0, w: width, h: height };
  const regionRects = squarify(
    groups.map((g) => g.value),
    frame,
  );
  const regions: AtlasRegion[] = [];
  const tiles: AtlasTile[] = [];
  groups.forEach((g, gi) => {
    const rr = regionRects[gi]!;
    regions.push({ key: g.key, rect: rr, group: g });
    const sorted = [...g.positions].sort((a, b) => b.value - a.value || a.rank - b.rank);
    const rects = squarify(
      sorted.map((p) => p.value),
      rr,
    );
    sorted.forEach((p, i) => tiles.push({ id: p.id, groupKey: g.key, rect: rects[i]!, position: p }));
  });
  return { width, height, regions, tiles, areaPerWhole: width * height };
}

/** Side length (px) of a square representing `share` of the shown whole. */
export function scaleSquareSide(layout: AtlasLayout, share: number): number {
  return Math.sqrt(layout.areaPerWhole * share);
}

/** Choose a friendly reference share for the scale key so the square is visible but modest. */
export function pickScaleShare(layout: AtlasLayout): number {
  for (const s of [0.01, 0.02, 0.05, 0.1]) {
    if (scaleSquareSide(layout, s) >= 14) return s;
  }
  return 0.1;
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}

/**
 * Visual inset applied when drawing. Gutters only ever make a drawn shape
 * smaller than its exact area, never larger.
 */
export function insetRect(r: Rect, by: number): Rect {
  const dx = Math.min(by, r.w / 2);
  const dy = Math.min(by, r.h / 2);
  return { x: r.x + dx, y: r.y + dy, w: Math.max(0, r.w - 2 * dx), h: Math.max(0, r.h - 2 * dy) };
}
