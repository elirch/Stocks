import { parseValue } from "./validate";
import type { HoldingDraft } from "./types";

export interface DuplicateGroup {
  /** Stable key: normalised identifier + exchange. */
  key: string;
  ids: string[];
}

export interface SameTickerNote {
  identifier: string;
  exchanges: string[];
}

function norm(s: string): string {
  return s.trim().toUpperCase();
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Finds rows that are *possibly* the same security: same identifier AND same
 * exchange (an empty exchange only matches another empty exchange). Rows that
 * share a ticker on different exchanges are different securities and are never
 * flagged for merging — they are reported separately as an informational note.
 * Cash rows are compared the same way. Pairs the user dismissed are skipped.
 */
export function findDuplicates(
  holdings: HoldingDraft[],
  dismissed: readonly string[] = [],
): { groups: DuplicateGroup[]; sameTickerDifferentExchange: SameTickerNote[] } {
  const dismissedSet = new Set(dismissed);
  const byKey = new Map<string, string[]>();
  const exchangesById = new Map<string, Set<string>>();

  for (const h of holdings) {
    const id = norm(h.identifier);
    if (!id) continue;
    const key = `${id}@${norm(h.exchange)}`;
    byKey.set(key, [...(byKey.get(key) ?? []), h.id]);
    const ex = exchangesById.get(id) ?? new Set<string>();
    ex.add(norm(h.exchange));
    exchangesById.set(id, ex);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, ids] of byKey) {
    if (ids.length < 2) continue;
    // Keep the group only if at least one pair in it is not dismissed.
    const open = ids.some((a, i) => ids.slice(i + 1).some((b) => !dismissedSet.has(pairKey(a, b))));
    if (open) groups.push({ key, ids });
  }

  const sameTickerDifferentExchange: SameTickerNote[] = [];
  for (const [identifier, ex] of exchangesById) {
    if (ex.size > 1) sameTickerDifferentExchange.push({ identifier, exchanges: [...ex].map((e) => e || "unspecified") });
  }
  return { groups, sameTickerDifferentExchange };
}

/**
 * Merges duplicate rows into the first one by adding their values. Only call
 * for rows found by `findDuplicates` (same identifier and exchange). Returns
 * null if any value is invalid, so nothing is silently dropped.
 */
export function mergeDuplicates(holdings: HoldingDraft[], ids: string[]): HoldingDraft[] | null {
  const rows = ids.map((id) => holdings.find((h) => h.id === id)).filter((h): h is HoldingDraft => !!h);
  if (rows.length < 2) return null;
  const first = rows[0]!;
  const key = (h: HoldingDraft) => `${norm(h.identifier)}@${norm(h.exchange)}`;
  if (rows.some((r) => key(r) !== key(first))) return null;
  let sum = 0;
  for (const r of rows) {
    const p = parseValue(r.valueText);
    if (!p.ok) return null;
    sum += p.value;
  }
  const merged: HoldingDraft = {
    ...first,
    name: first.name || rows.find((r) => r.name)?.name || "",
    sector: first.sector ?? rows.find((r) => r.sector)?.sector ?? null,
    valueText: String(Number(sum.toFixed(8))),
  };
  const drop = new Set(rows.slice(1).map((r) => r.id));
  return holdings.filter((h) => !drop.has(h.id)).map((h) => (h.id === first.id ? merged : h));
}

export function dismissGroup(dismissed: string[], ids: string[]): string[] {
  const out = new Set(dismissed);
  ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => out.add(pairKey(a, b))));
  return [...out];
}
