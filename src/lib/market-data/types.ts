import type { InstrumentType, Sector } from "../portfolio/types";

/**
 * Provider-neutral security metadata. Every field other than `identifier`
 * and `name` is optional: providers differ in coverage, and missing data
 * must stay missing rather than be guessed.
 */
export interface SecurityMatch {
  identifier: string;
  name: string;
  /** Exchange/market code as reported by the provider. */
  exchange?: string;
  type?: InstrumentType;
  /** Only set when the provider supplies a business sector for an individual company. */
  sector?: Sector;
  /** Provider-specific stable id (e.g. a FIGI), for display/debugging only. */
  providerId?: string;
}

export interface ProviderInfo {
  id: "none" | "fixture" | "openfigi";
  enabled: boolean;
  /** Short label shown next to search results. */
  label: string;
  /** Attribution text required or appropriate for the provider. */
  attribution?: string;
  /** True when results come from a built-in demonstration dataset. */
  isDemo: boolean;
}

export interface MarketDataProvider {
  info: ProviderInfo;
  /** Search by free text. Receives ONLY the query string — never values or portfolios. */
  search(query: string, signal?: AbortSignal): Promise<SecurityMatch[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
