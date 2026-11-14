import "server-only";
import { fixtureProvider } from "./fixtureProvider";
import { createOpenFigiProvider } from "./openfigiProvider";
import type { MarketDataProvider, ProviderInfo } from "./types";

const NONE_INFO: ProviderInfo = { id: "none", enabled: false, label: "Manual entry only", isDemo: false };
const SEC_INFO: ProviderInfo = {
  id: "sec",
  enabled: true,
  label: "U.S. listings",
  attribution: "Ticker list: U.S. SEC public data. U.S.-listed companies only — type anything else by hand.",
  isDemo: false,
};

/** Set at build time (next.config.ts) when public/data/us-securities.json exists. */
const SEC_INDEX_AVAILABLE = process.env.SEC_INDEX_AVAILABLE === "1";

function providerId(): string {
  const explicit = process.env.MARKET_DATA_PROVIDER?.trim().toLowerCase();
  if (explicit) return explicit;
  if (SEC_INDEX_AVAILABLE) return "sec";
  return process.env.NODE_ENV === "production" ? "none" : "fixture";
}

/**
 * Selects the provider from server-side configuration. Secrets are read here
 * and never reach the client bundle.
 */
export function getProvider(): MarketDataProvider | null {
  const id = providerId();
  if (id === "fixture") return fixtureProvider;
  if (id === "openfigi") return createOpenFigiProvider(process.env.OPENFIGI_API_KEY || undefined);
  return null;
}

export function getProviderInfo(): ProviderInfo {
  // The SEC list is searched in the browser; there is no server-side provider for it.
  if (providerId() === "sec") return SEC_INDEX_AVAILABLE ? SEC_INFO : NONE_INFO;
  return getProvider()?.info ?? NONE_INFO;
}
