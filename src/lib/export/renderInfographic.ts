import { insetRect, layoutAtlas } from "../layout/atlas";
import type { Rect } from "../layout/treemap";
import { formatDate, formatMoney, formatPercent } from "../format/format";
import type { Group } from "../portfolio/calc";
import type { Insights } from "../portfolio/insights";
import { TYPE_TEXTURE, type GroupMode, type Texture } from "../portfolio/taxonomy";

/**
 * Renders the shareable infographic onto a 2D canvas. Uses the same atlas
 * layout as the app, so proportions in the image match the app exactly.
 * Drawn natively (not an HTML screenshot) for crisp, reliable output.
 */

export const EXPORT_W = 1080;
export const EXPORT_H = 1350;

export interface ExportOptions {
  title: string;
  currency: string;
  groups: Group[];
  mode: GroupMode;
  insights: Insights;
  showAmounts: boolean;
  date: Date;
  brand: string;
  product: string;
}

const INK = "#15171C";
const INK_2 = "#4A4D55";
const PAPER = "#F6F2EA";
const SERIF = '"Fraunces Variable", Georgia, serif';
const SANS = '"Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif';

type Ctx = CanvasRenderingContext2D;

function makePattern(ctx: Ctx, texture: Texture, scale: number): CanvasPattern | null {
  if (texture === "none" || typeof document === "undefined") return null;
  const size = { hatch: 8, dots: 9, cross: 10, stipple: 11 }[texture];
  const c = document.createElement("canvas");
  c.width = c.height = size * scale;
  const p = c.getContext("2d");
  if (!p) return null;
  p.scale(scale, scale);
  p.strokeStyle = INK;
  p.fillStyle = INK;
  if (texture === "hatch" || texture === "cross") {
    p.globalAlpha = texture === "hatch" ? 0.28 : 0.22;
    p.lineWidth = texture === "hatch" ? 1.6 : 1.2;
    p.beginPath();
    // Diagonal lines that tile seamlessly.
    for (const o of [-size, 0, size]) {
      p.moveTo(o, size);
      p.lineTo(o + size, 0);
      if (texture === "cross") {
        p.moveTo(o, 0);
        p.lineTo(o + size, size);
      }
    }
    p.stroke();
  } else if (texture === "dots") {
    p.globalAlpha = 0.32;
    for (const [x, y] of [
      [2.2, 2.2],
      [6.7, 6.7],
    ] as const) {
      p.beginPath();
      p.arc(x, y, 1.4, 0, Math.PI * 2);
      p.fill();
    }
  } else {
    p.globalAlpha = 0.35;
    for (const [x, y, r] of [
      [2, 3, 0.9],
      [8, 1.5, 0.7],
      [5.5, 7.5, 0.9],
      [9.5, 9, 0.6],
    ] as const) {
      p.beginPath();
      p.arc(x, y, r, 0, Math.PI * 2);
      p.fill();
    }
  }
  const pattern = ctx.createPattern(c, "repeat");
  pattern?.setTransform(new DOMMatrix().scale(1 / scale));
  return pattern;
}

function roundRect(ctx: Ctx, r: Rect, radius: number) {
  const rr = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rr);
}

function fit(ctx: Ctx, text: string, maxW: number): string | null {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo >= 3 ? `${text.slice(0, lo).trimEnd()}…` : null;
}

export function drawInfographic(ctx: Ctx, o: ExportOptions, scale: number) {
  const W = EXPORT_W;
  const H = EXPORT_H;
  const M = 64;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Header
  ctx.fillStyle = INK_2;
  ctx.font = `600 15px ${SANS}`;
  ctx.letterSpacing = "3px";
  ctx.fillText(o.product.toUpperCase(), M, M + 14);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = INK;
  ctx.font = `600 58px ${SERIF}`;
  ctx.fillText(fit(ctx, o.title || "My portfolio", W - 2 * M) ?? "My portfolio", M, M + 82);
  ctx.font = `400 21px ${SANS}`;
  ctx.fillStyle = INK_2;
  const subtitle = [
    `${o.insights.holdingCount} ${o.insights.holdingCount === 1 ? "holding" : "holdings"}`,
    o.showAmounts ? `Total ${formatMoney(o.insights.total, o.currency)}` : `Values in ${o.currency}, shown as shares`,
    o.insights.largest ? `Largest ${formatPercent(o.insights.largest.weight)}` : null,
    o.insights.topN >= 3 ? `Top 3 ${formatPercent(o.insights.topNWeight)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillText(fit(ctx, subtitle, W - 2 * M) ?? "", M, M + 122);

  // Map
  const mapTop = 222;
  const mapH = 700;
  const mapW = W - 2 * M;
  const layout = layoutAtlas(o.groups, mapW, mapH);
  ctx.save();
  ctx.translate(M, mapTop);
  const patterns = new Map<Texture, CanvasPattern | null>();
  const pat = (t: Texture) => {
    if (!patterns.has(t)) patterns.set(t, makePattern(ctx, t, scale));
    return patterns.get(t) ?? null;
  };
  const fillOf = new Map(o.groups.map((g) => [g.key, g.style.fill]));
  for (const t of layout.tiles) {
    const d = insetRect(t.rect, 0.75);
    if (d.w <= 0 || d.h <= 0) continue;
    roundRect(ctx, d, 3);
    ctx.fillStyle = fillOf.get(t.groupKey) ?? "#ddd";
    ctx.fill();
    const p = pat(TYPE_TEXTURE[t.position.type]);
    if (p) {
      ctx.fillStyle = p;
      ctx.fill();
    }
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  for (const r of layout.regions) ctx.strokeRect(r.rect.x + 0.8, r.rect.y + 0.8, r.rect.w - 1.6, r.rect.h - 1.6);

  // Tile labels
  for (const t of layout.tiles) {
    const r = t.rect;
    if (r.w < 40 || r.h < 22) continue;
    const size = Math.max(12, Math.min(26, Math.sqrt(r.w * r.h) / 7));
    const pad = Math.max(6, size * 0.5);
    const maxW = r.w - pad * 2;
    const pctText = o.showAmounts
      ? `${formatPercent(t.position.weight)} · ${formatMoney(t.position.value, o.currency, true)}`
      : formatPercent(t.position.weight);
    ctx.fillStyle = INK;
    ctx.font = `600 ${size}px ${SANS}`;
    const name = r.h >= size * 2.7 ? fit(ctx, t.position.label, maxW) : null;
    const pSize = name ? size * 0.8 : Math.min(size, 15);
    ctx.font = `500 ${pSize}px ${SANS}`;
    let pLine = ctx.measureText(pctText).width <= maxW ? pctText : formatPercent(t.position.weight);
    if (ctx.measureText(pLine).width > maxW) pLine = "";
    if (!pLine) continue;
    const bottom = r.y + r.h - pad;
    if (name) {
      ctx.font = `600 ${size}px ${SANS}`;
      ctx.fillText(name, r.x + pad, bottom - pSize * 1.3);
    }
    ctx.font = `500 ${pSize}px ${SANS}`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(pLine, r.x + pad, bottom);
    ctx.globalAlpha = 1;
  }

  // Region chips
  for (const rg of layout.regions) {
    const r = rg.rect;
    if (r.w < 110 || r.h < 56) continue;
    ctx.font = `700 13px ${SANS}`;
    ctx.letterSpacing = "1.2px";
    const label = fit(ctx, rg.group.style.label.toUpperCase(), r.w - 90) ?? "";
    const pct = formatPercent(rg.group.weight);
    const lw = ctx.measureText(label).width;
    ctx.letterSpacing = "0px";
    ctx.font = `600 13px ${SANS}`;
    const pw = ctx.measureText(pct).width;
    const cw = lw + pw + 30;
    roundRect(ctx, { x: r.x + 8, y: r.y + 8, w: cw, h: 26 }, 13);
    ctx.fillStyle = "rgba(246,242,234,0.94)";
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `700 13px ${SANS}`;
    ctx.letterSpacing = "1.2px";
    ctx.fillText(label, r.x + 19, r.y + 26);
    ctx.letterSpacing = "0px";
    ctx.font = `600 13px ${SANS}`;
    ctx.fillStyle = INK_2;
    ctx.fillText(pct, r.x + 19 + lw + 8, r.y + 26);
  }
  ctx.restore();

  // Legend (two columns)
  const legendTop = mapTop + mapH + 36;
  ctx.fillStyle = INK_2;
  ctx.font = `600 13px ${SANS}`;
  ctx.letterSpacing = "2px";
  ctx.fillText(o.mode === "sector" ? "BY SECTOR" : "BY INSTRUMENT TYPE", M, legendTop);
  ctx.letterSpacing = "0px";
  const colW = (W - 2 * M - 40) / 2;
  const rowsPerCol = Math.ceil(Math.min(o.groups.length, 16) / 2);
  const rowH = Math.min(30, 236 / Math.max(rowsPerCol, 1));
  o.groups.slice(0, 16).forEach((g, i) => {
    const col = i < rowsPerCol ? 0 : 1;
    const row = col === 0 ? i : i - rowsPerCol;
    const x = M + col * (colW + 40);
    const y = legendTop + 18 + row * rowH;
    const sw = { x, y: y + 2, w: 18, h: 18 };
    roundRect(ctx, sw, 3);
    ctx.fillStyle = g.style.fill;
    ctx.fill();
    const p = pat(g.style.texture);
    if (p) {
      ctx.fillStyle = p;
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(21,23,28,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `500 18px ${SANS}`;
    ctx.fillStyle = INK;
    const right = o.showAmounts
      ? `${formatPercent(g.weight)}  ${formatMoney(g.value, o.currency, true)}`
      : formatPercent(g.weight);
    ctx.font = `600 18px ${SANS}`;
    const rw = ctx.measureText(right).width;
    ctx.fillText(right, x + colW - rw, y + 17);
    ctx.font = `500 18px ${SANS}`;
    ctx.fillText(fit(ctx, g.style.label, colW - rw - 44) ?? "", x + 30, y + 17);
  });
  if (o.groups.length > 16) {
    ctx.font = `400 15px ${SANS}`;
    ctx.fillStyle = INK_2;
    ctx.fillText(`+ ${o.groups.length - 16} more groups`, M, legendTop + 18 + rowsPerCol * rowH + 14);
  }

  // Footer
  const footY = H - M + 4;
  ctx.strokeStyle = "rgba(21,23,28,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, footY - 44);
  ctx.lineTo(W - M, footY - 44);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `600 22px ${SERIF}`;
  ctx.fillText(o.brand, M, footY - 8);
  ctx.font = `400 14px ${SANS}`;
  ctx.fillStyle = INK_2;
  const note = `Created ${formatDate(o.date)}. Informational only, not investment advice. Area = share of the holdings entered, not total wealth.`;
  const brandW = 170;
  const lines = wrap(ctx, note, W - 2 * M - brandW);
  lines.slice(0, 2).forEach((l, i) => {
    const lw = ctx.measureText(l).width;
    ctx.fillText(l, W - M - lw, footY - 24 + i * 19 - (lines.length > 1 ? 0 : -16));
  });
  ctx.restore();
}

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function ensureFontsLoaded(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`600 20px "Fraunces Variable"`),
    document.fonts.load(`400 20px "Inter Variable"`),
    document.fonts.load(`600 20px "Inter Variable"`),
    document.fonts.load(`700 20px "Inter Variable"`),
  ]).catch(() => undefined);
}

export async function renderInfographicCanvas(o: ExportOptions, scale = 2): Promise<HTMLCanvasElement> {
  await ensureFontsLoaded();
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_W * scale;
  canvas.height = EXPORT_H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  drawInfographic(ctx, o, scale);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"),
  );
}

export function exportFileName(title: string, date: Date): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "portfolio";
  return `${slug}-atlas-${date.toISOString().slice(0, 10)}.png`;
}
