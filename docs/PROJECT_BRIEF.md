You are acting as the business and product advisor for a small web product. Below is a technical and product brief written by the developer (an AI coding agent). Please review it and come back with: (1) product/positioning insights, (2) which roadmap items matter most for differentiation and why, (3) risks (legal, data licensing, privacy, trust), (4) questions the founder should answer before the next build cycle. Keep the founder's guiding principle in mind: **simplicity, very little text, and the most remarkable portfolio infographic on the web.**

---

# Portfolio Atlas — by Theta23 · Technical & Product Brief (Nov 2026)

## 1. Product in one paragraph
Portfolio Atlas turns a person's investment holdings into a distinctive, explorable, truthful infographic. The user enters what they hold (by hand, paste, or Excel/CSV upload), sees it as an "atlas" map where every holding is a shape sized exactly by its share, explores it, and downloads a polished image. Audience: everyday investors, especially younger people who find financial dashboards intimidating or dull. It is an informational visualization tool: no buy/sell/hold advice, no predictions, no risk scores, no suitability claims. "Portfolio Atlas" is a working name; the brand is Theta23.

## 2. Status
- **Live** on Vercel (free Hobby plan; fine for non-commercial testing — a commercial launch needs a paid plan).
- Source on GitHub, working branch `claude/portfolio-atlas-build-2ivmag`; every push redeploys.
- No accounts, no database, no analytics, no paid services.
- Tests: 98 automated unit tests + end-to-end browser tests of the full journey on desktop and a phone profile. All passing.

## 3. What a user can do today
1. Land on a short intro ("See your portfolio as a map.") → **Try the example** or **Enter my holdings**. No sign-up.
2. **Enter holdings**: ticker/identifier, name, current value, instrument type (stock, ETF, mutual fund, bond, cash, crypto, other), sector (11 generic sectors). One portfolio currency; values are never converted.
3. **Bulk input**: paste from a spreadsheet, or **upload Excel (.xlsx) / CSV**. Auto-detects ticker/name/value columns (English and Hebrew broker headings), skips "Total" rows, never mistakes cost basis or price for value, and reports every skipped row with a reason.
4. **Validation**: rejects negative values (shorts/liabilities unsupported in v1), currency symbols, non-numbers; invalid rows are excluded from totals and clearly flagged. Possible duplicates (same ticker AND same exchange) can be combined or kept separate; the same ticker on different exchanges is never merged.
5. **The Atlas** (core experience): a two-level treemap — regions = sectors (or instrument types), parcels = holdings. Area is exactly proportional to value. Color = category, texture = instrument type (funds hatched, cash dotted, crypto crosshatched, unknown speckled). A scale key shows the area of 1%. Click/tap/keyboard for exact values, zoom into a region, accessible table view, smooth layout transitions (respecting reduced-motion).
6. **Facts panel**: total, number of holdings, largest holding, top-3 concentration, sector composition, and a few neutral sentences such as "Your three largest positions account for 54.5% of the holdings you entered." All deterministic arithmetic.
7. **Detail card** per holding: share, value, type, sector, share within its group.
8. **Save & restore**: autosaves in the browser (same device/browser). Download a portfolio file (.json) for backup.
9. **Download image**: 2160×2700 PNG (Instagram-portrait ratio) with title, map, legend, "By Theta23", date, informational note. Default = percentages only; amounts optional with a warning.
10. **Editable image**: a second button downloads the same PNG with the portfolio data embedded inside the file. Uploading that image later restores the holdings for editing. (Contains the user's values, so it's labelled "keep it private".)

## 4. Key product rules (deliberate)
- Shows only the holdings entered — never implies total wealth.
- Funds/ETFs stay funds: never assigned a single business sector; their underlying holdings are not broken down (yet).
- Unknown securities stay visible, count in all totals, and appear as "Unclassified".
- Never fabricates company descriptions, sectors, logos or geographic exposure.
- Calculations vs. interpretations are kept separate; no LLM is used for numbers or text.
- Visual honesty: area = value; small gutters can make tiny holdings look slightly smaller, never larger; motion never suggests live market activity.

## 5. Architecture
- **Stack**: Next.js 16 (App Router) + React 19 + TypeScript. Plain CSS with design tokens. Self-hosted fonts (Inter, Fraunces). One small dependency for reading Excel zip files (fflate). No database, no Docker, no LLM.
- **Layers** (`src/lib/…`), each independently tested:
  - `portfolio/` — types, input validation, weight/concentration calculations, insights, duplicate detection, paste parsing, example data.
  - `layout/` — custom squarified treemap (written in-house so area accuracy is guaranteed and testable) and the two-level atlas layout.
  - `export/` — native canvas renderer for the PNG (redraws from the same layout; not an HTML screenshot) + PNG metadata embed/extract for editable images.
  - `persistence/` — validated portfolio file format, browser-local storage, spreadsheet import, unified "upload anything" entry point.
  - `market-data/` — provider interface; demo fixture list; OpenFIGI adapter; SEC ticker index searched in the browser; rate limiting and query validation for the server search route.
- **UI** (`src/components/`): holdings editor, atlas map (SVG), panels, export dialog.
- **Server**: one optional API route (`/api/securities/search`) with input validation and rate limiting. Secrets only on the server.
- **Privacy**: holdings never leave the browser unless the user downloads a file. Type-ahead (when enabled) searches a downloaded list locally, so even typed tickers aren't sent.

## 6. Market data — findings
- **Type-ahead**: built and tested; awaiting a one-time data download from the SEC's public ticker list (U.S. government data, free). The SEC requires a contact e-mail in the download request; the founder needs to set it in the dev environment. Covers U.S.-listed companies only; no sectors; ETF coverage limited.
- **OpenFIGI** (Bloomberg's free identifier service): integrated and verified live, but results are too noisy for type-ahead (e.g., "apple" returns municipal bonds first). Useful later for identifier lookup, not for suggestions.
- **Commercial providers** with sectors/profiles (e.g. FMP, Finnhub): self-serve plans appear to be personal-use only; public display likely requires an enterprise/display licence. Not integrated.
- **Israeli securities (TASE)**: no good free source identified; manual entry for now. Needs research if the audience is Israeli.

## 7. Known limitations / technical debt
1. No accounts → data is per device/browser (mitigated by file and editable-image export).
2. Sectors are manual unless a licensed data source is added.
3. No fund look-through (what ETFs contain) and no overlap detection (e.g., Apple held directly and via an S&P 500 fund).
4. Single currency per portfolio; no FX conversion.
5. Buttons do nothing during the first ~second before the page finishes loading on slow phones.
6. Light theme only (intentional "paper atlas" style).
7. In-memory rate limiter (fine at low traffic; needs a shared store at scale).
8. The 11-color sector palette exceeds what is distinguishable for color-blind users on color alone; mitigated with labels, legend, textures and table — a dedicated review would help.
9. No product analytics at all (by design) → no usage data; feedback must come from user interviews or privacy-safe aggregate analytics.

## 8. Where the architecture should improve next
- **Accounts & sync (planned)**: optional sign-in with end-to-end-encrypted or minimal server storage, keeping "your data stays private" as a differentiator. Requires a database, auth, a privacy policy and security review.
- **Data layer**: a cached securities catalogue (SEC + other exchanges) refreshed by a scheduled job instead of a manual script; a licensed provider for sectors if the business case supports it.
- **Fund look-through**: needs licensed or issuer-published holdings data; design the data model now (fund → constituents → weights → as-of date).
- **Snapshots over time**: local history of portfolio snapshots (no market data needed) enabling animated "how my map changed".
- **Rendering**: the atlas is SVG today; a canvas/WebGL path may be needed for richer motion or for very large portfolios (current documented limit: 1,000 holdings).
- **Privacy-safe analytics**: aggregate, non-financial events only (e.g., "image downloaded"), to learn what users value.

## 9. Proposed roadmap (developer's view, in priority order)
1. **The portfolio story**: a multi-slide export (carousel) and an in-app guided tour: whole map → top holdings → sector spread → "what isn't visible here" (funds not broken down, unclassified). One fact per slide, very little text. Cheap, distinctive, shareable.
2. **Your map over time**: save monthly snapshots locally; animate the map morphing between them. Creates a reason to return. No data licence needed.
3. **Look inside your funds**: show ETFs as "transparent" regions with their underlying exposure and overlap with direct holdings. The most meaningful insight and the strongest moat, but blocked on data licensing.
4. **A unique visual language**: full cartographic styling (map typography, contour lines, poster/print version) so the image becomes an object people want to keep.
Before building: put the live link in front of ~5 target users and observe where they get stuck and what makes them say "wow".

## 10. Questions for the advisor
- Who exactly is the first audience (country, age, platform: Instagram/TikTok/WhatsApp)? This affects data coverage (U.S. vs. Israeli securities), image formats and language.
- What is the first business model to test (free + premium export themes? print posters? B2B for advisers/brokers?) — and which features does it require?
- Is "privacy-first, no account" a selling point to keep even after accounts are added?
- How much data-licensing cost is acceptable for sectors and fund look-through?
- What would make the infographic shareable enough to spread organically?
