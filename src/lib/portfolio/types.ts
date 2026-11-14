/**
 * Core domain types. These are deliberately UI-agnostic so that validation,
 * calculation, layout and export can be tested in isolation.
 */

export const INSTRUMENT_TYPES = [
  "stock",
  "etf",
  "mutual_fund",
  "bond",
  "cash",
  "crypto",
  "other",
  "unknown",
] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

/**
 * Business sectors for individual companies. These are generic sector names
 * used for grouping; they are not an official classification standard.
 */
export const SECTORS = [
  "technology",
  "communication",
  "consumer_discretionary",
  "consumer_staples",
  "health_care",
  "financials",
  "industrials",
  "energy",
  "materials",
  "utilities",
  "real_estate",
] as const;
export type Sector = (typeof SECTORS)[number];

/** Where a holding's descriptive metadata came from. */
export type MetadataSource = "manual" | "fixture" | "provider";

/**
 * A holding as edited by the user. `valueText` is the raw text typed by the
 * user; it is only turned into a number by validation.
 */
export interface HoldingDraft {
  id: string;
  /** Ticker, ISIN or any identifier the user recognises. May be empty. */
  identifier: string;
  /** Exchange / market code if known (e.g. "XNAS"). Used for duplicate detection. */
  exchange: string;
  name: string;
  valueText: string;
  type: InstrumentType;
  /** Only meaningful for individual securities; funds/cash never carry a sector. */
  sector: Sector | null;
  source: MetadataSource;
}

export interface PortfolioDraft {
  /** ISO 4217 currency code. All values are entered in this currency. */
  currency: string;
  title: string;
  holdings: HoldingDraft[];
  /** Pairs of holding ids the user has confirmed are NOT duplicates. */
  dismissedDuplicates: string[];
  /** True for the built-in example so the UI can label it. */
  isExample?: boolean;
}

/** A holding that passed validation and is included in calculations. */
export interface Position {
  id: string;
  identifier: string;
  exchange: string;
  name: string;
  /** Display label: name, falling back to identifier, falling back to "Unnamed holding". */
  label: string;
  value: number;
  /** value / total. 0..1 */
  weight: number;
  type: InstrumentType;
  sector: Sector | null;
  source: MetadataSource;
  /** 1-based rank by value, descending. */
  rank: number;
}
