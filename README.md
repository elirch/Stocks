# Portfolio Atlas — by Theta23

Turn the investment holdings you enter into an explorable, truthful map — then download a polished image.

*Working name. All naming lives in [`src/lib/brand.ts`](src/lib/brand.ts).*

- **Enter holdings** by hand, by pasting from a spreadsheet, or (optionally) with security search.
- **See them as an atlas:** every holding is a rectangle whose area is exactly proportional to its current value, grouped into outlined regions by sector or instrument type.
- **Explore:** hover/tap/keyboard for precise values, zoom into a region, accessible table view.
- **Save locally** (browser storage) and as a portfolio file you keep.
- **Download a 2160 × 2700 PNG** — percentages only by default.

It is an informational visualization tool: no advice, ratings, predictions or suitability claims.

## Run it locally

Requires **Node.js 20.9 or newer** (22 recommended).

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm start            # http://localhost:3000
```

## Checks

```bash
npm run typecheck    # TypeScript
npm test             # unit tests (Vitest)
npm run build        # production build
npm run test:e2e     # end-to-end journey in Chromium, desktop + phone (needs a prior `npm run build`)
npm run verify       # typecheck + unit tests + build
```

The e2e suite needs Playwright's Chromium (`npx playwright install chromium` on a fresh machine).

## Configuration

Copy `.env.example` to `.env.local` if you want to change anything. Nothing is required.

| Variable | Default | Meaning |
|---|---|---|
| `MARKET_DATA_PROVIDER` | `fixture` in dev, `none` in production | `none` = manual entry only. `fixture` = small built-in **demo** list, labelled as such in the UI. `openfigi` = OpenFIGI search (see below). |
| `OPENFIGI_API_KEY` | empty | Optional, server-side only. |

Secrets are only read on the server (`src/lib/market-data/server.ts`); nothing provider-related is shipped to the browser.

## Architecture

```
src/lib/portfolio/     types, validation, calculations, insights, duplicates, paste parsing, example data
src/lib/layout/        squarified treemap + two-level atlas layout (area-exact)
src/lib/export/        canvas renderer for the PNG infographic (same layout as the app)
src/lib/persistence/   portfolio file format (validated import/export) + local browser storage
src/lib/market-data/   provider interface, demo fixture provider, OpenFIGI adapter, rate limiting
src/app/               Next.js App Router page + /api/securities/search
src/components/        React UI (editor, atlas map, panels, export dialog)
tests/unit/            Vitest
tests/e2e/             Playwright
```

### Numerical rules

- One currency per portfolio; values are never converted. Changing currency relabels, it doesn't convert.
- "Current holding value" = what the whole position is worth today, not cost basis.
- Negative values (shorts, loans, liabilities) are rejected with an explanation. Invalid rows are excluded from all totals and flagged.
- Weights = value / sum of valid values. Zero-value rows are listed but cannot be drawn.
- Funds/ETFs are never assigned a business sector; holdings without a sector are shown as **Unclassified** and still count in every total.
- Possible duplicates = same identifier **and** same exchange. The same ticker on different exchanges is never merged.
- Limit: 1,000 holdings per portfolio (documented performance limit).

### Visual encoding

- Area ∝ value (both levels of the treemap are exact). A 0.75 px gutter makes very small shapes slightly *smaller* than exact, never larger.
- Colour = the group (sector or type), fixed per category. Texture = instrument type (hatched fund, dotted cash, crosshatch crypto, speckled unknown).
- A scale key shows the area of 1%. Small holdings are reachable by keyboard, the legend zoom, and the table; a locator ring (outline only) marks a selected tiny shape.
- Motion runs only on user-initiated changes and respects `prefers-reduced-motion`.

## Market data

The app works fully without any data provider. Search is behind `MarketDataProvider` (`src/lib/market-data/types.ts`) and only receives the typed search text.

- **fixture** — ~30 well-known listings for development and demos. Clearly labelled "Demo data". Not a licensed data feed; off by default in production.
- **openfigi** — adapter for OpenFIGI's v3 search API. **Implemented and unit-tested with mocked HTTP; not verified against the live service** (the build environment could not reach openfigi.com). OpenFIGI provides identifiers, names, exchange codes and security types — **not business sectors**. Before enabling: read the current OpenFIGI terms of service and API docs, confirm the response shape, optionally get a free API key, then set `MARKET_DATA_PROVIDER=openfigi`.
- Commercial providers that offer sectors (e.g. FMP, Finnhub) generally require a paid display/redistribution licence for a public product. None is integrated.

## Deploy (Vercel — recommended)

1. Push this repository to GitHub (already done for the working branch).
2. In Vercel: **Add New → Project → Import** the repository. Framework is detected as Next.js; no build settings to change.
3. Optional environment variables: leave empty for manual-entry-only. Set `MARKET_DATA_PROVIDER=fixture` only for a demo deployment.
4. Deploy. Vercel's free Hobby plan is for non-commercial use; a commercial launch needs a Pro plan (check current terms).

Any Node host works too: `npm ci && npm run build && npm start` (port via `PORT`).

## Privacy

Holdings stay in the browser (localStorage) unless the user downloads a file. No accounts, no analytics, no server-side storage. Search requests carry only the typed identifier text; queries are not logged.

## Limitations (v1)

See [STATUS.md](STATUS.md).
