import type { HoldingDraft } from "./types";
import { MAX_TEXT_LENGTH, parseValue } from "./validate";

export interface PasteResult {
  holdings: HoldingDraft[];
  skipped: { line: number; text: string; reason: string }[];
}

/**
 * Parses pasted rows from a spreadsheet or text. Each line needs an
 * identifier and a value; a name in between is optional:
 *   AAPL, 12000
 *   AAPL	Apple Inc.	12,000
 *   "MSFT";"Microsoft";8500.50
 * Tabs, semicolons or commas separate columns. The value is the LAST column.
 * When commas separate columns, values must not contain comma thousands
 * separators unless quoted — ambiguous lines are skipped, not guessed.
 */
export function parsePastedHoldings(text: string, makeId: () => string, limit: number): PasteResult {
  const holdings: HoldingDraft[] = [];
  const skipped: PasteResult["skipped"] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    if (holdings.length >= limit) {
      skipped.push({ line: idx + 1, text: line, reason: "Holding limit reached." });
      return;
    }
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cells = splitCells(line, sep);
    if (cells.length < 2) {
      skipped.push({ line: idx + 1, text: line, reason: "Needs an identifier and a value." });
      return;
    }
    const valueCell = cells[cells.length - 1]!;
    const prevCell = cells[cells.length - 2] ?? "";
    if (sep === "," && /^\d{3}(\.\d+)?$/.test(valueCell) && /^\d{1,3}$/.test(prevCell)) {
      skipped.push({
        line: idx + 1,
        text: line,
        reason: "Ambiguous comma in the value. Remove thousands separators or put the value in quotes.",
      });
      return;
    }
    const parsed = parseValue(valueCell.replace(/^[$€£₪¥]/, ""));
    if (!parsed.ok) {
      // Header rows such as "Ticker, Value" are skipped quietly.
      if (idx === 0 && /[a-z]/i.test(valueCell)) return;
      skipped.push({ line: idx + 1, text: line, reason: parsed.message });
      return;
    }
    const identifier = cells[0]!.slice(0, MAX_TEXT_LENGTH);
    const name = cells.length >= 3 ? cells.slice(1, -1).join(" ").slice(0, MAX_TEXT_LENGTH) : "";
    const isCash = /^cash$/i.test(identifier);
    holdings.push({
      id: makeId(),
      identifier,
      exchange: "",
      name,
      valueText: String(parsed.value),
      type: isCash ? "cash" : "unknown",
      sector: null,
      source: "manual",
    });
  });
  return { holdings, skipped };
}

function splitCells(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter((c, i, arr) => c !== "" || i === arr.length - 1);
}
