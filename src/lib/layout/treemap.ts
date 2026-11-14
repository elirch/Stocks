/**
 * Squarified treemap (Bruls, Huizing & van Wijk, 2000), written from scratch
 * so its behaviour is fully deterministic and testable.
 *
 * Guarantee: every output rectangle's area equals value / sum × rect area
 * (up to floating-point error). No padding is subtracted inside the layout;
 * any visual gutters are applied at render time and documented there.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function worst(rowMin: number, rowMax: number, rowSum: number, side: number): number {
  const s2 = side * side;
  const sum2 = rowSum * rowSum;
  return Math.max((s2 * rowMax) / sum2, sum2 / (s2 * rowMin));
}

/**
 * Lays out `values` (must be > 0) inside `rect`. Returns one rectangle per
 * value, in input order. For best aspect ratios pass values sorted descending.
 */
export function squarify(values: readonly number[], rect: Rect): Rect[] {
  const n = values.length;
  const out: Rect[] = new Array(n);
  if (n === 0) return out;
  const sum = values.reduce((a, v) => a + v, 0);
  if (!(sum > 0) || rect.w <= 0 || rect.h <= 0) {
    for (let i = 0; i < n; i++) out[i] = { x: rect.x, y: rect.y, w: 0, h: 0 };
    return out;
  }
  const scale = (rect.w * rect.h) / sum;
  const areas = values.map((v) => Math.max(0, v) * scale);

  let { x, y, w, h } = rect;
  let i = 0;
  while (i < n) {
    const side = Math.min(w, h);
    let rowSum = 0;
    let rowMin = Infinity;
    let rowMax = 0;
    let best = Infinity;
    let j = i;
    while (j < n) {
      const a = areas[j]!;
      const nSum = rowSum + a;
      const nMin = Math.min(rowMin, a);
      const nMax = Math.max(rowMax, a);
      const ratio = worst(nMin, nMax, nSum, side);
      if (j > i && ratio > best) break;
      rowSum = nSum;
      rowMin = nMin;
      rowMax = nMax;
      best = ratio;
      j++;
    }
    const isLast = j >= n;
    if (w >= h) {
      // Row becomes a column on the left edge.
      const colW = isLast ? w : rowSum / h;
      let cum = 0;
      for (let k = i; k < j; k++) {
        const y0 = y + (cum / rowSum) * h;
        cum += areas[k]!;
        const y1 = k === j - 1 ? y + h : y + (cum / rowSum) * h;
        out[k] = { x, y: y0, w: colW, h: y1 - y0 };
      }
      x += colW;
      w -= colW;
    } else {
      const rowH = isLast ? h : rowSum / w;
      let cum = 0;
      for (let k = i; k < j; k++) {
        const x0 = x + (cum / rowSum) * w;
        cum += areas[k]!;
        const x1 = k === j - 1 ? x + w : x + (cum / rowSum) * w;
        out[k] = { x: x0, y, w: x1 - x0, h: rowH };
      }
      y += rowH;
      h -= rowH;
    }
    i = j;
  }
  return out;
}
