import { unzipSync, strFromU8 } from "fflate";
import { SECTOR_LABELS } from "../portfolio/taxonomy";
import { SECTORS, type HoldingDraft, type InstrumentType, type Sector } from "../portfolio/types";
import { MAX_TEXT_LENGTH, parseValue } from "../portfolio/validate";

/**
 * Spreadsheet import (.xlsx, .csv, .tsv). Reads the first sheet, finds the
 * identifier / name / value columns from the header row (English and Hebrew
 * broker headings), and turns rows into holdings. Nothing is guessed silently:
 * every skipped row is reported with a reason.
 */

export const MAX_SPREADSHEET_BYTES = 5_000_000;

export type Grid = string[][];

export interface SheetImport {
  holdings: HoldingDraft[];
  skipped: { row: number; reason: string }[];
  columns: { identifier?: string; name?: string; value: string; type?: string; sector?: string } | null;
}

// ---------- CSV ----------

export function parseCsv(text: string): Grid {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { "\t": count(firstLine, "\t"), ";": count(firstLine, ";"), ",": count(firstLine, ",") };
  const sep = counts["\t"] > 0 ? "\t" : counts[";"] > counts[","] ? ";" : ",";
  const rows: Grid = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

function count(s: string, ch: string) {
  return s.split(ch).length - 1;
}

// ---------- XLSX ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

function textOf(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]!)).join("");
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Reads the first worksheet of an .xlsx file into a grid of strings. */
export function readXlsx(bytes: Uint8Array): Grid {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name.startsWith("xl/") && f.name.endsWith(".xml") || f.name.endsWith(".rels") });
  } catch {
    throw new Error("This doesn't look like a valid Excel (.xlsx) file.");
  }
  const read = (name: string) => (files[name] ? strFromU8(files[name]!) : null);
  const workbook = read("xl/workbook.xml");
  if (!workbook) throw new Error("This doesn't look like a valid Excel (.xlsx) file.");

  // Resolve the first sheet's file through the workbook relationships.
  const firstSheetRid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const rels = read("xl/_rels/workbook.xml.rels") ?? "";
  let target = firstSheetRid
    ? new RegExp(`<Relationship\\b[^>]*Id="${firstSheetRid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ??
      new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstSheetRid}"`).exec(rels)?.[1]
    : undefined;
  target = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
  const sheet = read(target) ?? read("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("Couldn't find a worksheet in this file.");

  const shared = [...(read("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));

  const grid: Grid = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of rowMatch[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const body = c[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const t = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (t === "s" && v !== undefined) value = shared[Number(v)] ?? "";
      else if (t === "inlineStr") value = textOf(body);
      else if (v !== undefined) {
        // Numeric cells can be stored in exponent form (e.g. 1.5E+5).
        const n = Number(v);
        value = (t === undefined || t === "n") && Number.isFinite(n) ? String(n) : decodeXml(v);
      }
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push("");
      row[idx] = value.trim();
    }
    if (row.some((x) => x !== "")) grid.push(row);
  }
  return grid;
}

// ---------- Mapping ----------

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();

const ID_HEADERS = ["symbol", "ticker", "identifier", "isin", "security id", "code", "סימול", "מספר נייר", "מס נייר", "קוד"];
const NAME_HEADERS = ["name", "description", "security name", "security", "instrument", "holding", "company", "asset", "שם נייר", "שם", "נייר"];
const VALUE_HEADERS = [
  "current value", "market value", "position value", "total value", "value", "amount", "balance", "worth",
  "שווי נוכחי", "שווי שוק", "שווי",
];
const VALUE_EXCLUDE = ["cost", "basis", "purchase", "paid", "price", "gain", "loss", "change", "%", "percent", "quantity", "qty", "shares", "עלות", "שער", "רווח", "כמות", "שינוי"];
const TYPE_HEADERS = ["type", "asset class", "security type", "instrument type", "asset type", "סוג"];
const SECTOR_HEADERS = ["sector", "industry", "סקטור", "ענף"];

function findCol(header: string[], wanted: string[], exclude: string[] = [], taken: Set<number> = new Set()): number {
  const h = header.map(norm);
  for (const w of wanted) {
    const i = h.findIndex((x, idx) => !taken.has(idx) && (x === w) && !exclude.some((e) => x.includes(e)));
    if (i >= 0) return i;
  }
  for (const w of wanted) {
    const i = h.findIndex((x, idx) => !taken.has(idx) && x.includes(w) && !exclude.some((e) => x.includes(e)));
    if (i >= 0) return i;
  }
  return -1;
}

export function mapType(raw: string): InstrumentType {
  const s = norm(raw);
  if (!s) return "unknown";
  if (/\betf\b|exchange traded|קרן סל|תעודת סל/.test(s)) return "etf";
  if (/mutual|fund|קרן נאמנות|קרן/.test(s)) return "mutual_fund";
  if (/bond|fixed income|treasury|note|אג ח|אגח|אג"ח/.test(s)) return "bond";
  if (/cash|money market|deposit|מזומן|פיקדון/.test(s)) return "cash";
  if (/crypto|bitcoin|קריפטו/.test(s)) return "crypto";
  if (/stock|equity|share|common|adr|מניה|מניות/.test(s)) return "stock";
  return "other";
}

const SECTOR_ALIASES: Record<string, Sector> = {
  "information technology": "technology",
  tech: "technology",
  "communication services": "communication",
  telecommunications: "communication",
  healthcare: "health_care",
  "consumer cyclical": "consumer_discretionary",
  "consumer defensive": "consumer_staples",
  "basic materials": "materials",
  financial: "financials",
  "financial services": "financials",
};

export function mapSector(raw: string): Sector | null {
  const s = norm(raw);
  if (!s) return null;
  if (SECTOR_ALIASES[s]) return SECTOR_ALIASES[s]!;
  for (const id of SECTORS) if (norm(SECTOR_LABELS[id]) === s) return id;
  return null;
}

function cleanAmount(s: string): string {
  return s.replace(/^\s*(?:[$€£₪¥]|USD|EUR|GBP|ILS|NIS)\s*/i, "").replace(/\s*(?:[$€£₪¥]|USD|EUR|GBP|ILS|NIS|ש"ח|₪)\s*$/i, "");
}

/** Converts a grid (first row may be a header) into holdings. */
export function gridToHoldings(grid: Grid, makeId: () => string, limit: number): SheetImport {
  const skipped: SheetImport["skipped"] = [];
  if (!grid.length) return { holdings: [], skipped: [{ row: 1, reason: "The sheet is empty." }], columns: null };

  // Header = the first row within the first 10 that has a recognisable value column.
  let headerRow = -1;
  let cols = { id: -1, name: -1, value: -1, type: -1, sector: -1 };
  for (let r = 0; r < Math.min(10, grid.length); r++) {
    const row = grid[r]!;
    const value = findCol(row, VALUE_HEADERS, VALUE_EXCLUDE);
    if (value < 0) continue;
    const taken = new Set([value]);
    const id = findCol(row, ID_HEADERS, [], taken);
    if (id >= 0) taken.add(id);
    const name = findCol(row, NAME_HEADERS, [], taken);
    if (name >= 0) taken.add(name);
    const type = findCol(row, TYPE_HEADERS, [], taken);
    if (type >= 0) taken.add(type);
    const sector = findCol(row, SECTOR_HEADERS, [], taken);
    if (id >= 0 || name >= 0) {
      headerRow = r;
      cols = { id, name, value, type, sector };
      break;
    }
  }
  if (headerRow < 0) {
    // No header: identifier, optional name, value in the last column.
    const width = Math.max(...grid.map((r) => r.length));
    if (width < 2) return { holdings: [], skipped: [{ row: 1, reason: "Need at least an identifier column and a value column." }], columns: null };
    cols = { id: 0, name: width >= 3 ? 1 : -1, value: width - 1, type: -1, sector: -1 };
  }

  const header = headerRow >= 0 ? grid[headerRow]! : null;
  const holdings: HoldingDraft[] = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r]!;
    const at = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const identifier = at(cols.id).slice(0, MAX_TEXT_LENGTH);
    const name = at(cols.name).slice(0, MAX_TEXT_LENGTH);
    const rawValue = at(cols.value);
    if (!identifier && !name && !rawValue) continue;
    if (/^(grand )?totals?\b|^סה"?כ|^סך הכל/i.test(identifier || name)) {
      skipped.push({ row: r + 1, reason: "Looks like a total row, so it was left out." });
      continue;
    }
    if (!identifier && !name) {
      skipped.push({ row: r + 1, reason: "No identifier or name." });
      continue;
    }
    const parsed = parseValue(cleanAmount(rawValue));
    if (!parsed.ok) {
      skipped.push({ row: r + 1, reason: `${identifier || name}: ${parsed.message}` });
      continue;
    }
    if (holdings.length >= limit) {
      skipped.push({ row: r + 1, reason: "Holding limit reached." });
      continue;
    }
    let type = cols.type >= 0 ? mapType(at(cols.type)) : "unknown";
    if (type === "unknown" && /^cash$/i.test(identifier || name)) type = "cash";
    const sector = cols.sector >= 0 && (type === "stock" || type === "other" || type === "unknown") ? mapSector(at(cols.sector)) : null;
    holdings.push({ id: makeId(), identifier, exchange: "", name, valueText: String(parsed.value), type, sector, source: "manual" });
  }

  return {
    holdings,
    skipped,
    columns: header
      ? {
          identifier: cols.id >= 0 ? header[cols.id] : undefined,
          name: cols.name >= 0 ? header[cols.name] : undefined,
          value: header[cols.value] ?? "",
          type: cols.type >= 0 ? header[cols.type] : undefined,
          sector: cols.sector >= 0 ? header[cols.sector] : undefined,
        }
      : null,
  };
}

export function readSpreadsheet(fileName: string, bytes: Uint8Array): Grid {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) return readXlsx(bytes);
  if (lower.endsWith(".xls")) throw new Error("Old .xls files aren't supported. In Excel choose Save As → .xlsx or .csv.");
  return parseCsv(new TextDecoder().decode(bytes).replace(/^﻿/, ""));
}
