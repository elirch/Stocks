import "server-only";
import { fixtureProvider } from "./fixtureProvider";
import { createOpenFigiProvider } from "./openfigiProvider";
import type { MarketDataProvider, ProviderInfo } from "./types";

const NONE_INFO: ProviderInfo = { id: "none", enabled: false, label: "Manual entry only", isDemo: false };

/**
 * Selects the provider from server-side configuration. Secrets are read here
 * and never reach the client bundle.
 */
export function getProvider(): MarketDataProvider | null {
  const fallback = process.env.NODE_ENV === "production" ? "none" : "fixture";
  const id = (process.env.MARKET_DATA_PROVIDER || fallback).trim().toLowerCase();
  if (id === "fixture") return fixtureProvider;
  if (id === "openfigi") return createOpenFigiProvider(process.env.OPENFIGI_API_KEY || undefined);
  return null;
}

export function getProviderInfo(): ProviderInfo {
  return getProvider()?.info ?? NONE_INFO;
}
