import { groupKeyFor, groupStyle, type GroupKey, type GroupMode, type GroupStyle } from "./taxonomy";
import type { HoldingDraft, PortfolioDraft, Position } from "./types";
import { rowStatus, type ValueIssue } from "./validate";

export interface ExcludedRow {
  id: string;
  label: string;
  issue: ValueIssue;
  message: string;
}

export interface PortfolioSummary {
  currency: string;
  /** Sum of all valid values. */
  total: number;
  /** All valid positions (including zero-value ones), sorted by value desc. */
  positions: Position[];
  /** Positions with value > 0 — the ones that can be drawn. */
  drawable: Position[];
  /** Rows with an invalid value; excluded from every calculation. */
  excluded: ExcludedRow[];
  /** Number of untouched blank rows (ignored). */
  blankCount: number;
}

export function holdingLabel(h: Pick<HoldingDraft, "name" | "identifier">): string {
  const name = h.name.trim();
  if (name) return name;
  const id = h.identifier.trim();
  return id || "Unnamed holding";
}

/**
 * Turns the editable draft into validated positions with weights. Weights are
 * computed only from valid rows; invalid rows are reported, never guessed at.
 */
export function summarize(draft: PortfolioDraft): PortfolioSummary {
  const valid: Omit<Position, "weight" | "rank">[] = [];
  const excluded: ExcludedRow[] = [];
  let blankCount = 0;

  for (const h of draft.holdings) {
    const status = rowStatus(h);
    if (status.kind === "blank") {
      blankCount++;
      continue;
    }
    if (status.kind === "invalid") {
      excluded.push({ id: h.id, label: holdingLabel(h), issue: status.issue, message: status.message });
      continue;
    }
    valid.push({
      id: h.id,
      identifier: h.identifier.trim(),
      exchange: h.exchange.trim(),
      name: h.name.trim(),
      label: holdingLabel(h),
      value: status.value,
      type: h.type,
      sector: h.sector,
      source: h.source,
    });
  }

  // Kahan-free but order-stable sum; magnitudes are bounded by MAX_VALUE.
  const total = valid.reduce((acc, p) => acc + p.value, 0);
  // Stable sort: by value desc, then label, then id for determinism.
  const sorted = [...valid].sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
  );
  const positions: Position[] = sorted.map((p, i) => ({
    ...p,
    weight: total > 0 ? p.value / total : 0,
    rank: i + 1,
  }));

  return {
    currency: draft.currency,
    total,
    positions,
    drawable: positions.filter((p) => p.value > 0),
    excluded,
    blankCount,
  };
}

export interface Group {
  key: GroupKey;
  style: GroupStyle;
  value: number;
  weight: number;
  positions: Position[];
}

/** Groups drawable positions; groups are ordered by value desc, then label. */
export function groupPositions(positions: Position[], mode: GroupMode): Group[] {
  const map = new Map<GroupKey, Position[]>();
  for (const p of positions) {
    const key = groupKeyFor(p, mode);
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  }
  const total = positions.reduce((a, p) => a + p.value, 0);
  const groups: Group[] = [...map.entries()].map(([key, list]) => {
    const value = list.reduce((a, p) => a + p.value, 0);
    return { key, style: groupStyle(key), value, weight: total > 0 ? value / total : 0, positions: list };
  });
  groups.sort((a, b) => b.value - a.value || a.style.label.localeCompare(b.style.label));
  return groups;
}

/** Sum of the weights of the N largest positions. */
export function topNConcentration(positions: Position[], n: number): number {
  return positions
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
    .reduce((a, p) => a + p.weight, 0);
}
