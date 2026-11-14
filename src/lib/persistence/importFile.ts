import { extractText, isPng } from "../export/pngMeta";
import type { HoldingDraft, PortfolioDraft } from "../portfolio/types";
import { parsePortfolioFile } from "./file";
import { MAX_SPREADSHEET_BYTES, gridToHoldings, readSpreadsheet, type SheetImport } from "./spreadsheet";

export type ImportOutcome =
  | { kind: "portfolio"; draft: PortfolioDraft; warnings: string[]; from: "file" | "image" }
  | { kind: "holdings"; holdings: HoldingDraft[]; skipped: SheetImport["skipped"]; columns: SheetImport["columns"] }
  | { kind: "error"; errors: string[] };

/**
 * One entry point for every upload: a portfolio file (.json), an editable
 * Atlas image (.png), or a spreadsheet (.xlsx / .csv / .tsv / .txt).
 */
export function importAnyFile(name: string, bytes: Uint8Array, makeId: () => string, room: number): ImportOutcome {
  const lower = name.toLowerCase();
  if (bytes.length > MAX_SPREADSHEET_BYTES) return { kind: "error", errors: ["That file is larger than 5 MB."] };

  if (isPng(bytes) || lower.endsWith(".png")) {
    const text = extractText(bytes);
    if (!text) {
      return {
        kind: "error",
        errors: ["This image has no saved holdings. Only images downloaded as “Editable copy” can be opened."],
      };
    }
    const res = parsePortfolioFile(text, makeId);
    return res.ok ? { kind: "portfolio", draft: res.draft, warnings: res.warnings, from: "image" } : { kind: "error", errors: res.errors };
  }

  if (lower.endsWith(".json")) {
    const res = parsePortfolioFile(new TextDecoder().decode(bytes), makeId);
    return res.ok ? { kind: "portfolio", draft: res.draft, warnings: res.warnings, from: "file" } : { kind: "error", errors: res.errors };
  }

  if (/\.(xlsx|xls|csv|tsv|txt)$/.test(lower)) {
    try {
      const sheet = gridToHoldings(readSpreadsheet(lower, bytes), makeId, room);
      if (!sheet.holdings.length) {
        return {
          kind: "error",
          errors: [
            "No holdings found. The sheet needs a column with a ticker or name, and a column with the current value.",
            ...sheet.skipped.slice(0, 5).map((s) => `Row ${s.row}: ${s.reason}`),
          ],
        };
      }
      return { kind: "holdings", holdings: sheet.holdings, skipped: sheet.skipped, columns: sheet.columns };
    } catch (e) {
      return { kind: "error", errors: [(e as Error).message] };
    }
  }

  return { kind: "error", errors: ["Use an Excel (.xlsx) or CSV file, a saved portfolio (.json), or an editable Atlas image (.png)."] };
}
