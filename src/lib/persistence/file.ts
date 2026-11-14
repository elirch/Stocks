import { isValidCurrencyCode } from "../portfolio/currency";
import { INSTRUMENT_TYPES, SECTORS, type HoldingDraft, type InstrumentType, type PortfolioDraft, type Sector } from "../portfolio/types";
import { canHaveSector } from "../portfolio/taxonomy";
import { MAX_HOLDINGS, MAX_TEXT_LENGTH, parseValue } from "../portfolio/validate";

export const FILE_FORMAT = "portfolio-atlas";
export const FILE_VERSION = 1;
export const MAX_FILE_BYTES = 1_000_000;

/** The on-disk shape of a portfolio file. Values are stored as numbers. */
export interface PortfolioFileV1 {
  format: typeof FILE_FORMAT;
  version: 1;
  savedAt: string;
  currency: string;
  title: string;
  holdings: {
    identifier: string;
    exchange?: string;
    name: string;
    value: number;
    type: InstrumentType;
    sector: Sector | null;
  }[];
}

export function toFile(draft: PortfolioDraft, now = new Date()): PortfolioFileV1 {
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    savedAt: now.toISOString(),
    currency: draft.currency,
    title: draft.title,
    holdings: draft.holdings.flatMap((h) => {
      const v = parseValue(h.valueText);
      if (!v.ok) return [];
      return [
        {
          identifier: h.identifier.trim(),
          ...(h.exchange.trim() ? { exchange: h.exchange.trim() } : {}),
          name: h.name.trim(),
          value: v.value,
          type: h.type,
          sector: h.sector,
        },
      ];
    }),
  };
}

export type ImportResult =
  | { ok: true; draft: PortfolioDraft; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Validates an untrusted portfolio file. Everything is checked field by
 * field; unknown fields are ignored, nothing is executed or evaluated.
 */
export function parsePortfolioFile(text: string, makeId: () => string): ImportResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, errors: ["The file is larger than 1 MB, which is too big for a portfolio file."] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["This isn't a valid Portfolio Atlas file (it isn't readable JSON)."] };
  }
  if (!isObject(data) || data.format !== FILE_FORMAT) {
    return { ok: false, errors: ["This file wasn't created by Portfolio Atlas."] };
  }
  if (data.version !== FILE_VERSION) {
    return { ok: false, errors: [`Unsupported file version (${String(data.version)}). This app reads version ${FILE_VERSION}.`] };
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isValidCurrencyCode(data.currency)) errors.push("The file's currency is missing or isn't a valid 3-letter currency code.");
  if (!Array.isArray(data.holdings)) errors.push("The file has no list of holdings.");
  else if (data.holdings.length > MAX_HOLDINGS) errors.push(`The file has ${data.holdings.length} holdings; the limit is ${MAX_HOLDINGS}.`);
  if (errors.length) return { ok: false, errors };

  const holdings: HoldingDraft[] = [];
  (data.holdings as unknown[]).forEach((raw, i) => {
    const row = `Row ${i + 1}`;
    if (!isObject(raw)) {
      errors.push(`${row}: not a holding.`);
      return;
    }
    const identifier = str(raw.identifier);
    const name = str(raw.name);
    const exchange = str(raw.exchange);
    if (identifier === null || name === null || exchange === null) {
      errors.push(`${row}: identifier, name and exchange must be text.`);
      return;
    }
    if (typeof raw.value !== "number" || !Number.isFinite(raw.value)) {
      errors.push(`${row}: value must be a number.`);
      return;
    }
    if (raw.value < 0) {
      errors.push(`${row}: negative values (short positions or liabilities) aren't supported.`);
      return;
    }
    const valueCheck = parseValue(String(raw.value));
    if (!valueCheck.ok) {
      errors.push(`${row}: ${valueCheck.message}`);
      return;
    }
    const type: InstrumentType = (INSTRUMENT_TYPES as readonly unknown[]).includes(raw.type) ? (raw.type as InstrumentType) : "unknown";
    if (raw.type !== undefined && type === "unknown" && raw.type !== "unknown") warnings.push(`${row}: unknown instrument type was set to "Not specified".`);
    let sector: Sector | null = (SECTORS as readonly unknown[]).includes(raw.sector) ? (raw.sector as Sector) : null;
    if (raw.sector != null && sector === null) warnings.push(`${row}: unknown sector was set to Unclassified.`);
    if (sector && !canHaveSector(type)) {
      sector = null;
      warnings.push(`${row}: funds, bonds, cash and crypto don't carry a business sector, so it was removed.`);
    }
    holdings.push({
      id: makeId(),
      identifier: identifier.slice(0, MAX_TEXT_LENGTH),
      exchange: exchange.slice(0, MAX_TEXT_LENGTH),
      name: name.slice(0, MAX_TEXT_LENGTH),
      valueText: String(raw.value),
      type,
      sector,
      source: "manual",
    });
  });
  if (errors.length) return { ok: false, errors: errors.slice(0, 20) };

  const title = str(data.title);
  return {
    ok: true,
    warnings,
    draft: {
      currency: data.currency as string,
      title: (title ?? "My portfolio").slice(0, 60) || "My portfolio",
      holdings,
      dismissedDuplicates: [],
    },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Returns trimmed text, "" for undefined/null, or null for a non-string. */
function str(v: unknown): string | null {
  if (v === undefined || v === null) return "";
  return typeof v === "string" ? v.trim() : null;
}
