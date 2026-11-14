import type { InstrumentType, Position, Sector } from "./types";

export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  stock: "Stock",
  etf: "ETF",
  mutual_fund: "Mutual fund",
  bond: "Bond",
  cash: "Cash",
  crypto: "Crypto",
  other: "Other",
  unknown: "Not specified",
};

export const SECTOR_LABELS: Record<Sector, string> = {
  technology: "Technology",
  communication: "Communication",
  consumer_discretionary: "Consumer Discretionary",
  consumer_staples: "Consumer Staples",
  health_care: "Health Care",
  financials: "Financials",
  industrials: "Industrials",
  energy: "Energy",
  materials: "Materials",
  utilities: "Utilities",
  real_estate: "Real Estate",
};

export function isFund(type: InstrumentType): boolean {
  return type === "etf" || type === "mutual_fund";
}

/** Only individual securities can carry a business sector. */
export function canHaveSector(type: InstrumentType): boolean {
  return type === "stock" || type === "other" || type === "unknown";
}

export type GroupMode = "sector" | "type";

export type GroupKey =
  | `sector:${Sector}`
  | "funds"
  | "bonds"
  | "cash"
  | "crypto"
  | "unclassified"
  | `type:${InstrumentType}`;

export type Texture = "none" | "hatch" | "dots" | "stipple" | "cross";

export interface GroupStyle {
  key: GroupKey;
  label: string;
  /** Short explanation shown in the legend/detail, if the group needs one. */
  note?: string;
  fill: string;
  texture: Texture;
}

/**
 * Fixed colour per category (colour follows the entity, never its rank).
 * Pastel "map" fills carry dark ink labels; every pair also differs by
 * position, label and legend, so colour is never the only channel.
 */
const SECTOR_FILLS: Record<Sector, string> = {
  technology: "#6E9BE6",
  communication: "#A88BE3",
  consumer_discretionary: "#F08C6E",
  consumer_staples: "#E3BC4E",
  health_care: "#6CC9A8",
  financials: "#3E9BA6",
  industrials: "#A3AE6A",
  energy: "#C98A4B",
  materials: "#E58FB4",
  utilities: "#79C7E3",
  real_estate: "#B98A7D",
};

const TYPE_FILLS: Record<InstrumentType, string> = {
  stock: "#6E9BE6",
  etf: "#E3BC4E",
  mutual_fund: "#F08C6E",
  bond: "#6CC9A8",
  cash: "#E4E0D6",
  crypto: "#A88BE3",
  other: "#B98A7D",
  unknown: "#EFEBE2",
};

export const TYPE_TEXTURE: Record<InstrumentType, Texture> = {
  stock: "none",
  etf: "hatch",
  mutual_fund: "hatch",
  bond: "none",
  cash: "dots",
  crypto: "cross",
  other: "none",
  unknown: "stipple",
};

export function groupKeyFor(p: Pick<Position, "type" | "sector">, mode: GroupMode): GroupKey {
  if (mode === "type") return `type:${p.type}`;
  if (isFund(p.type)) return "funds";
  if (p.type === "bond") return "bonds";
  if (p.type === "cash") return "cash";
  if (p.type === "crypto") return "crypto";
  return p.sector ? `sector:${p.sector}` : "unclassified";
}

export function groupStyle(key: GroupKey): GroupStyle {
  if (key.startsWith("sector:")) {
    const s = key.slice(7) as Sector;
    return { key, label: SECTOR_LABELS[s], fill: SECTOR_FILLS[s], texture: "none" };
  }
  if (key.startsWith("type:")) {
    const t = key.slice(5) as InstrumentType;
    return {
      key,
      label: t === "unknown" ? "Type not specified" : pluralType(t),
      fill: TYPE_FILLS[t],
      texture: TYPE_TEXTURE[t],
      note: isFund(t) ? "Underlying holdings are not broken down." : undefined,
    };
  }
  switch (key) {
    case "funds":
      return {
        key,
        label: "Funds & ETFs",
        note: "Funds are shown as funds. Their underlying holdings are not broken down.",
        fill: "#D8CFBC",
        texture: "hatch",
      };
    case "bonds":
      return { key, label: "Bonds", fill: "#B9C6CF", texture: "none" };
    case "cash":
      return { key, label: "Cash", fill: TYPE_FILLS.cash, texture: "dots" };
    case "crypto":
      return { key, label: "Crypto", fill: "#C9C2D6", texture: "cross" };
    default:
      return {
        key,
        label: "Unclassified",
        note: "No sector was entered or found for these holdings.",
        fill: TYPE_FILLS.unknown,
        texture: "stipple",
      };
  }
}

function pluralType(t: InstrumentType): string {
  switch (t) {
    case "stock":
      return "Stocks";
    case "etf":
      return "ETFs";
    case "mutual_fund":
      return "Mutual funds";
    case "bond":
      return "Bonds";
    case "cash":
      return "Cash";
    case "crypto":
      return "Crypto";
    case "other":
      return "Other";
    default:
      return "Type not specified";
  }
}

/** Descriptive "sector" text for a single position, never inventing a sector for funds. */
export function sectorDescription(p: Pick<Position, "type" | "sector">): string {
  if (isFund(p.type)) return "Fund — underlying sectors not broken down";
  if (p.type === "cash") return "Cash";
  if (p.type === "bond") return "Bond";
  if (p.type === "crypto") return "Crypto asset";
  return p.sector ? SECTOR_LABELS[p.sector] : "Unclassified";
}
