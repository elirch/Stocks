"use client";

import { useMemo, useRef, useState } from "react";
import type { ProviderInfo } from "@/lib/market-data/types";
import { holdingLabel } from "@/lib/portfolio/calc";
import { COMMON_CURRENCIES, currencyName } from "@/lib/portfolio/currency";
import { findDuplicates } from "@/lib/portfolio/duplicates";
import { makeId } from "@/lib/portfolio/ids";
import { parsePastedHoldings } from "@/lib/portfolio/paste";
import { INSTRUMENT_LABELS, SECTOR_LABELS, canHaveSector } from "@/lib/portfolio/taxonomy";
import { INSTRUMENT_TYPES, SECTORS, type HoldingDraft, type InstrumentType, type PortfolioDraft, type Sector } from "@/lib/portfolio/types";
import { MAX_HOLDINGS, rowStatus } from "@/lib/portfolio/validate";
import { IdentifierInput } from "./IdentifierInput";
import type { PortfolioDispatch } from "./usePortfolio";

interface Props {
  draft: PortfolioDraft;
  dispatch: PortfolioDispatch;
  provider: ProviderInfo;
}

const TYPE_ORDER: InstrumentType[] = ["stock", "etf", "mutual_fund", "bond", "cash", "crypto", "other", "unknown"];

export function HoldingsEditor({ draft, dispatch, provider }: Props) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [currencyNote, setCurrencyNote] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const dupes = useMemo(() => findDuplicates(draft.holdings, draft.dismissedDuplicates), [draft.holdings, draft.dismissedDuplicates]);
  const dupeIds = useMemo(() => new Set(dupes.groups.flatMap((g) => g.ids)), [dupes]);
  const currencies = COMMON_CURRENCIES.includes(draft.currency as (typeof COMMON_CURRENCIES)[number])
    ? COMMON_CURRENCIES
    : [draft.currency, ...COMMON_CURRENCIES];
  const atLimit = draft.holdings.length >= MAX_HOLDINGS;

  function addRow() {
    dispatch({ type: "add" });
    // Focus the new row's identifier field once it renders.
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLInputElement>("li.row:last-child input.input")?.focus();
    });
  }

  return (
    <section className="editor" aria-labelledby="editor-title">
      <div className="editor-head">
        <h2 id="editor-title" className="panel-title">Your holdings</h2>
        <div className="editor-currency">
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            className="select"
            value={draft.currency}
            onChange={(e) => {
              dispatch({ type: "setCurrency", currency: e.target.value });
              setCurrencyNote(true);
            }}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c} — {currencyName(c)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="hint">
        Enter every value in <strong>{draft.currency}</strong>. <strong>Current holding value</strong> means what the whole
        position is worth today — not what you paid for it. Values are never converted between currencies.
      </p>
      {currencyNote && (
        <p className="notice" role="status">
          Currency changed to {draft.currency}. Your numbers were relabelled, not converted — check they are in {draft.currency}.
          <button type="button" className="link-btn" onClick={() => setCurrencyNote(false)}>
            OK
          </button>
        </p>
      )}

      {dupes.groups.length > 0 && (
        <div className="notice warn" role="status">
          <strong>Possible duplicates.</strong> These rows have the same identifier and exchange:
          <ul>
            {dupes.groups.map((g) => (
              <li key={g.key}>
                {g.ids
                  .map((id) => draft.holdings.find((h) => h.id === id))
                  .filter(Boolean)
                  .map((h) => holdingLabel(h!))
                  .join(" + ")}
                <span className="notice-actions">
                  <button type="button" className="btn small" onClick={() => dispatch({ type: "merge", ids: g.ids })}>
                    Combine into one row
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => dispatch({ type: "keepBoth", ids: g.ids })}>
                    Keep separate
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dupes.sameTickerDifferentExchange.length > 0 && (
        <p className="notice subtle">
          Same identifier on different exchanges ({dupes.sameTickerDifferentExchange.map((n) => n.identifier).join(", ")}) is treated
          as separate securities.
        </p>
      )}

      <ol className="rows" ref={listRef}>
        {draft.holdings.map((h, i) => (
          <HoldingRow
            key={h.id}
            index={i}
            holding={h}
            dispatch={dispatch}
            provider={provider}
            duplicate={dupeIds.has(h.id)}
          />
        ))}
      </ol>

      <div className="editor-actions">
        <button type="button" className="btn" onClick={addRow} disabled={atLimit}>
          + Add holding
        </button>
        <button type="button" className="btn ghost" onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen}>
          Paste a list
        </button>
        <span className="row-count">
          {draft.holdings.length} {draft.holdings.length === 1 ? "row" : "rows"}
          {atLimit && ` — limit of ${MAX_HOLDINGS} reached`}
        </span>
      </div>
      {pasteOpen && <PasteBox onDone={() => setPasteOpen(false)} dispatch={dispatch} room={MAX_HOLDINGS - draft.holdings.length} />}
    </section>
  );
}

function HoldingRow({
  index,
  holding: h,
  dispatch,
  provider,
  duplicate,
}: {
  index: number;
  holding: HoldingDraft;
  dispatch: PortfolioDispatch;
  provider: ProviderInfo;
  duplicate: boolean;
}) {
  const status = rowStatus(h);
  const label = holdingLabel(h) === "Unnamed holding" ? `row ${index + 1}` : holdingLabel(h);
  const errorId = `err-${h.id}`;
  const update = (patch: Partial<HoldingDraft>) => dispatch({ type: "update", id: h.id, patch });
  const sectorAllowed = canHaveSector(h.type);

  return (
    <li className={`row${status.kind === "invalid" ? " invalid" : ""}${duplicate ? " dupe" : ""}`}>
      <span className="row-num" aria-hidden="true">
        {index + 1}
      </span>
      <div className="row-grid">
        <div className="f-id">
          <IdentifierInput
            value={h.identifier}
            provider={provider}
            rowLabel={label}
            onChange={(v) => update({ identifier: v })}
            onPick={(m) =>
              update({
                identifier: m.identifier,
                exchange: m.exchange ?? "",
                name: m.name,
                type: m.type ?? h.type,
                sector: m.sector ?? null,
                source: provider.isDemo ? "fixture" : "provider",
              })
            }
          />
        </div>
        <div className="f-name">
          <input
            className="input"
            value={h.name}
            maxLength={120}
            placeholder="Name"
            aria-label={`Name for ${label}`}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="f-value">
          <input
            className="input tnum"
            value={h.valueText}
            inputMode="decimal"
            placeholder="Value"
            aria-label={`Current value for ${label}`}
            aria-invalid={status.kind === "invalid"}
            aria-describedby={status.kind === "invalid" ? errorId : undefined}
            maxLength={40}
            onChange={(e) => update({ valueText: e.target.value })}
          />
        </div>
        <div className="f-type">
          <select
            className="select"
            value={h.type}
            aria-label={`Instrument type for ${label}`}
            onChange={(e) => update({ type: e.target.value as InstrumentType })}
          >
            {TYPE_ORDER.filter((t) => INSTRUMENT_TYPES.includes(t)).map((t) => (
              <option key={t} value={t}>
                {t === "unknown" ? "Type…" : INSTRUMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="f-sector">
          <select
            className="select"
            value={sectorAllowed ? h.sector ?? "" : ""}
            disabled={!sectorAllowed}
            aria-label={`Sector for ${label}`}
            title={sectorAllowed ? undefined : "Funds, bonds, cash and crypto are not assigned a business sector."}
            onChange={(e) => update({ sector: (e.target.value || null) as Sector | null })}
          >
            <option value="">{sectorAllowed ? "Unclassified" : "No sector"}</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="icon-btn f-del"
          aria-label={`Remove ${label}`}
          onClick={() => dispatch({ type: "remove", id: h.id })}
        >
          ×
        </button>
      </div>
      {(status.kind === "invalid" || h.exchange || h.source !== "manual") && (
        <div className="row-foot">
          {status.kind === "invalid" && (
            <span id={errorId} className="row-error">
              {status.message} Not included in totals.
            </span>
          )}
          {h.exchange && <span className="tag">Exchange: {h.exchange}</span>}
          {h.source === "fixture" && <span className="tag demo">Details from demo data</span>}
          {h.source === "provider" && <span className="tag">Details from {provider.label}</span>}
        </div>
      )}
    </li>
  );
}

function PasteBox({ onDone, dispatch, room }: { onDone: () => void; dispatch: PortfolioDispatch; room: number }) {
  const [text, setText] = useState("");
  const [report, setReport] = useState<string[] | null>(null);
  return (
    <div className="paste">
      <label htmlFor="paste-area" className="paste-label">
        One holding per line: identifier, optional name, value. Copy straight from a spreadsheet.
      </label>
      <textarea
        id="paste-area"
        className="input"
        rows={6}
        value={text}
        placeholder={"AAPL, Apple, 12000\nVTI\tVanguard Total Stock Market ETF\t25000\nCASH, 4000"}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="editor-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const res = parsePastedHoldings(text, makeId, room);
            if (res.holdings.length) dispatch({ type: "addMany", holdings: res.holdings });
            const lines = [`Added ${res.holdings.length} ${res.holdings.length === 1 ? "holding" : "holdings"}.`];
            res.skipped.slice(0, 8).forEach((s) => lines.push(`Line ${s.line} skipped: ${s.reason}`));
            if (res.skipped.length > 8) lines.push(`…and ${res.skipped.length - 8} more lines skipped.`);
            setReport(lines);
            if (!res.skipped.length) {
              setText("");
              onDone();
            }
          }}
        >
          Add these holdings
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
      {report && (
        <ul className="paste-report" role="status">
          {report.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      <p className="hint">Pasted rows start without a type or sector — set them afterwards if you like.</p>
    </div>
  );
}
