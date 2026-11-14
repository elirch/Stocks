import { isValidCurrencyCode } from "../portfolio/currency";
import { canHaveSector } from "../portfolio/taxonomy";
import { INSTRUMENT_TYPES, SECTORS, type HoldingDraft, type InstrumentType, type PortfolioDraft, type Sector } from "../portfolio/types";
import { MAX_HOLDINGS, MAX_TEXT_LENGTH } from "../portfolio/validate";

/**
 * Browser-local persistence. Stored only in this browser's localStorage on
 * this device; never sent anywhere. Unlike the portfolio file, the local copy
 * keeps rows exactly as typed (including unfinished values) so work in
 * progress isn't lost. Everything read back is re-validated.
 */
const KEY = "portfolio-atlas:draft:v1";

interface StoredDraft {
  v: 1;
  currency: string;
  title: string;
  holdings: Omit<HoldingDraft, "id">[];
  dismissedDuplicates: string[];
}

export function serializeDraft(draft: PortfolioDraft): string {
  const stored: StoredDraft = {
    v: 1,
    currency: draft.currency,
    title: draft.title,
    holdings: draft.holdings.map(({ id: _id, ...rest }) => rest),
    dismissedDuplicates: [],
  };
  return JSON.stringify(stored);
}

export function deserializeDraft(raw: string, makeId: () => string): PortfolioDraft | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.v !== 1 || !isValidCurrencyCode(d.currency) || !Array.isArray(d.holdings)) return null;
  const holdings: HoldingDraft[] = [];
  for (const r of d.holdings.slice(0, MAX_HOLDINGS)) {
    if (typeof r !== "object" || r === null) continue;
    const h = r as Record<string, unknown>;
    const s = (v: unknown, max = MAX_TEXT_LENGTH) => (typeof v === "string" ? v.slice(0, max) : "");
    const type: InstrumentType = (INSTRUMENT_TYPES as readonly unknown[]).includes(h.type) ? (h.type as InstrumentType) : "unknown";
    const sector: Sector | null =
      (SECTORS as readonly unknown[]).includes(h.sector) && canHaveSector(type) ? (h.sector as Sector) : null;
    holdings.push({
      id: makeId(),
      identifier: s(h.identifier),
      exchange: s(h.exchange),
      name: s(h.name),
      valueText: s(h.valueText, 40),
      type,
      sector,
      source: h.source === "fixture" || h.source === "provider" ? h.source : "manual",
    });
  }
  return {
    currency: d.currency as string,
    title: typeof d.title === "string" ? d.title.slice(0, 60) : "My portfolio",
    holdings,
    dismissedDuplicates: [],
  };
}

export function saveLocal(draft: PortfolioDraft): boolean {
  try {
    localStorage.setItem(KEY, serializeDraft(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(makeId: () => string): PortfolioDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? deserializeDraft(raw, makeId) : null;
  } catch {
    return null;
  }
}

export function hasLocal(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
