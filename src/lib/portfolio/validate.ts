import type { HoldingDraft } from "./types";

/** Practical upper bound for one position value (well above any real holding). */
export const MAX_VALUE = 1e15;
/** Documented performance limit for the number of holdings. */
export const MAX_HOLDINGS = 1000;
export const MAX_TEXT_LENGTH = 120;

export type ValueIssue =
  | "empty"
  | "not_a_number"
  | "negative"
  | "too_large";

export type ParsedValue = { ok: true; value: number } | { ok: false; issue: ValueIssue; message: string };

export const VALUE_MESSAGES: Record<ValueIssue, string> = {
  empty: "Enter the current value of this holding.",
  not_a_number: "Use digits only, e.g. 12500 or 12,500.50.",
  negative:
    "Negative values (short positions, loans, liabilities) aren't supported in this version. Enter long positions only.",
  too_large: "This value is too large to be a single holding.",
};

/**
 * Parses a user-typed amount. Accepts digits, a single decimal point and
 * comma/space/apostrophe thousands separators ("12,500.50", "12 500", "12'500").
 * Currency symbols and letters are rejected rather than guessed at, so that
 * a value typed in another currency is never silently accepted as-is.
 */
export function parseValue(text: string): ParsedValue {
  const raw = text.trim();
  if (raw === "") return fail("empty");
  const negative = /^[-−(]/.test(raw) || /\)$/.test(raw);
  const cleaned = raw.replace(/^[-−(]|\)$/g, "").replace(/[,\s'  _]/g, "");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(cleaned)) return fail("not_a_number");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return fail("not_a_number");
  if (negative && value !== 0) return fail("negative");
  if (value > MAX_VALUE) return fail("too_large");
  return { ok: true, value };
}

function fail(issue: ValueIssue): ParsedValue {
  return { ok: false, issue, message: VALUE_MESSAGES[issue] };
}

export type RowStatus =
  | { kind: "blank" }
  | { kind: "valid"; value: number }
  | { kind: "invalid"; issue: ValueIssue; message: string };

/** A row with no identifier, no name and no value is treated as an unused blank row. */
export function rowStatus(h: HoldingDraft): RowStatus {
  if (h.identifier.trim() === "" && h.name.trim() === "" && h.valueText.trim() === "") {
    return { kind: "blank" };
  }
  const parsed = parseValue(h.valueText);
  if (!parsed.ok) return { kind: "invalid", issue: parsed.issue, message: parsed.message };
  return { kind: "valid", value: parsed.value };
}

export function clampText(s: string): string {
  return s.slice(0, MAX_TEXT_LENGTH);
}
