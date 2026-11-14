#!/usr/bin/env node
/**
 * Builds public/data/us-securities.json from the SEC's public ticker list
 * (https://www.sec.gov/files/company_tickers_exchange.json — U.S. government
 * data). Run occasionally (e.g. monthly) and commit the output; the website
 * never calls the SEC at runtime.
 *
 * The SEC asks automated clients to identify themselves with a contact
 * address in the User-Agent. Provide it via an environment variable so it is
 * never stored in the repository:
 *
 *   SEC_USER_AGENT="PortfolioAtlas you@example.com" node scripts/build-securities.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UA = process.env.SEC_USER_AGENT;
if (!UA || !/@/.test(UA)) {
  console.error('Set SEC_USER_AGENT, e.g. SEC_USER_AGENT="PortfolioAtlas you@example.com"');
  process.exit(1);
}

const SOURCE = "https://www.sec.gov/files/company_tickers_exchange.json";
const res = await fetch(SOURCE, { headers: { "User-Agent": UA, Accept: "application/json" } });
if (!res.ok) {
  console.error(`SEC request failed: HTTP ${res.status}`);
  process.exit(1);
}
const body = await res.json();
const fields = body.fields;
const iName = fields.indexOf("name");
const iTicker = fields.indexOf("ticker");
const iExchange = fields.indexOf("exchange");
if (iName < 0 || iTicker < 0) {
  console.error("Unexpected SEC file format:", fields);
  process.exit(1);
}

const KEEP_UPPER = new Set(["ETF", "ADR", "REIT", "LLC", "LP", "PLC", "NV", "SA", "AG", "SE", "II", "III", "IV", "USA", "US", "UK"]);
function titleCase(name) {
  return name
    .split(/\s+/)
    .map((w) => {
      const bare = w.replace(/[^A-Za-z]/g, "");
      if (KEEP_UPPER.has(bare.toUpperCase()) || /\d/.test(w) || bare.length <= 1) return w;
      return w.charAt(0) + w.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bInc\b\.?/g, "Inc.")
    .replace(/\bCorp\b\.?/g, "Corp.")
    .replace(/\bCo\b(?!\.)/g, "Co.");
}

const EXCHANGES = new Map([
  ["Nasdaq", "NASDAQ"],
  ["NYSE", "NYSE"],
  ["CBOE", "Cboe"],
]);

const seen = new Set();
const rows = [];
for (const r of body.data) {
  const ticker = String(r[iTicker] ?? "").trim().toUpperCase();
  const name = String(r[iName] ?? "").trim();
  const exchangeRaw = iExchange >= 0 ? String(r[iExchange] ?? "") : "";
  // Listed securities only (skip OTC / no exchange) to keep suggestions relevant.
  const exchange = EXCHANGES.get(exchangeRaw);
  if (!ticker || !name || !exchange) continue;
  const key = `${ticker}@${exchange}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push([ticker, titleCase(name), exchange]);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));

const out = {
  source: "U.S. Securities and Exchange Commission — company_tickers_exchange.json",
  generatedAt: new Date().toISOString().slice(0, 10),
  fields: ["ticker", "name", "exchange"],
  data: rows,
};
const file = path.join(process.cwd(), "public", "data", "us-securities.json");
await mkdir(path.dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(out));
console.log(`Wrote ${rows.length} listed securities to ${path.relative(process.cwd(), file)}`);
