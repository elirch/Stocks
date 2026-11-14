# Project status — Portfolio Atlas (by Theta23)

_Last updated: 2026-11-14_

## Done (implemented and tested)

- Landing/intro, "How it works" and "Privacy" sections, legal footer (no advice, not a licensed institution).
- Holdings editor: identifier, name, current value, type, sector; add/remove rows; paste-from-spreadsheet; per-row validation messages; single currency selector with "no conversion" notice; 1,000-holding limit.
- Duplicate detection (same identifier + exchange) with "Combine" / "Keep separate"; same ticker on different exchanges is never merged.
- Calculations: totals, weights, rank, top-3 concentration, sector/type grouping, Unclassified and fund handling, small-holding summary. Template-based neutral observations.
- Atlas map (SVG): area-exact two-level squarified treemap, region chips that zoom, legend zoom, hover tooltip, tap/click selection, keyboard navigation (arrows/Home/End/Enter/Escape) with live announcements, scale key, locator ring for tiny shapes, layout transitions (reduced-motion aware).
- Detail card, stat row, legend with composition bars, accessible table view.
- Local autosave (browser), restore on reload, "Clear all"; example portfolio clearly labelled and never auto-saved.
- Portfolio file (.json) export/import with strict validation.
- PNG export (canvas, 2160×2700), percentages-only default, optional amounts with warning, title, date, branding, informational note; live preview.
- Market-data provider interface; demo fixture provider; OpenFIGI adapter (mock-tested only); rate-limited, validated `/api/securities/search`.
- Tests: 83 unit tests (Vitest) + e2e journey on desktop and Pixel 7 (Playwright). Typecheck and production build pass.

## Added 2026-11-14 (session 2)

- Live at the owner's Vercel deployment (deployed by the owner from this branch).
- "Download editable copy": the PNG carries the portfolio in an iTXt chunk; uploading it restores the holdings for editing.
- One "Upload" path for Excel (.xlsx), CSV/TSV, saved .json and editable PNGs. Header detection (English + Hebrew broker headings), total rows skipped, cost/price columns never used as value.
- SEC type-ahead implemented (browser-side search over a static list); waiting for the data file.
- A row without a value is shown as unfinished (grey), not as an error.
- OpenFIGI verified live: works, but results are too noisy for type-ahead (e.g. municipal bonds for "apple"). Kept as an option, not enabled.

## Not done / limitations

- Deployed by the owner on Vercel; deploys follow pushes to the production branch.
- OpenFIGI terms must be re-read before public use. No provider supplies business sectors; users set them manually.
- Clicking buttons before the page finishes loading (first ~second on slow phones) does nothing.
- Light theme only (deliberate "paper atlas" style).
- No fund look-through, overlap detection, live prices, history or multi-currency.
- Rate limiter is per-instance memory (fine for low traffic).
- Sector palette has 11 hues; colours are always backed by labels, legend and table rather than relied on alone.

## Decisions

- Next.js 16 + TypeScript, no database, no Docker, no LLM.
- Treemap written in-house for exact, testable areas; export redraws natively on canvas instead of screenshotting HTML.
- Production default: manual entry only (`MARKET_DATA_PROVIDER=none`).
- Fonts self-hosted via @fontsource (Inter, Fraunces) so the PNG export uses the same fonts.

## Exact next step

Owner runs `scripts/build-securities.mjs` once with their SEC_USER_AGENT (the type-ahead code is done and tested; only the data file is missing), then commit `public/data/us-securities.json`. Then: the "story" infographic (multi-slide export) and snapshots over time.
