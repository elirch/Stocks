"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { formatPercent } from "@/lib/format/format";
import type { ProviderInfo } from "@/lib/market-data/types";
import { groupPositions, summarize } from "@/lib/portfolio/calc";
import { makeId } from "@/lib/portfolio/ids";
import { computeInsights } from "@/lib/portfolio/insights";
import type { GroupKey, GroupMode } from "@/lib/portfolio/taxonomy";
import { toFile } from "@/lib/persistence/file";
import { importAnyFile } from "@/lib/persistence/importFile";
import { AtlasMap, AtlasPatterns } from "./AtlasMap";
import { ExportDialog } from "./ExportDialog";
import { HoldingsEditor } from "./HoldingsEditor";
import { DetailCard, HoldingsTable, Legend, Observations, StatRow } from "./Panels";
import { usePortfolio } from "./usePortfolio";

export function AtlasApp({ provider }: { provider: ProviderInfo }) {
  const { draft, dispatch, hydrated, restored, saveState, loadExample, startEmpty, clearAll } = usePortfolio();
  const [mode, setMode] = useState<GroupMode>("sector");
  const [view, setView] = useState<"map" | "table">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomKey, setZoomKey] = useState<GroupKey | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"holdings" | "map">("holdings");
  const [fileMsg, setFileMsg] = useState<{ kind: "ok" | "error"; lines: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(() => summarize(draft), [draft]);
  const groups = useMemo(() => groupPositions(summary.drawable, mode), [summary, mode]);
  const insights = useMemo(() => computeInsights(summary), [summary]);
  const selected = summary.drawable.find((p) => p.id === selectedId) ?? null;
  const hasData = summary.drawable.length > 0;
  const exportBase = useMemo(() => ({ currency: draft.currency, groups, mode, insights }), [draft.currency, groups, mode, insights]);

  const onZoom = useCallback((k: GroupKey | null) => setZoomKey(k), []);

  function goToWorkspace(tab: "holdings" | "map") {
    setMobileTab(tab);
    requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function downloadFile() {
    const blob = new Blob([JSON.stringify(toFile(draft), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-atlas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    const dropped = summary.excluded.length;
    setFileMsg({
      kind: "ok",
      lines: [
        "Portfolio file downloaded. Keep it somewhere safe — it contains your values.",
        ...(dropped ? [`${dropped} row(s) with invalid values were not included.`] : []),
      ],
    });
  }

  async function openFile(file: File) {
    const room = 1000;
    const res = importAnyFile(file.name, new Uint8Array(await file.arrayBuffer()), makeId, room);
    if (res.kind === "error") {
      setFileMsg({ kind: "error", lines: ["Couldn't open that file.", ...res.errors] });
      return;
    }
    const existing = draft.isExample ? 0 : summary.positions.length;
    if (existing > 0 && !window.confirm(`Replace your ${existing} current holdings with the ones in “${file.name}”?`)) return;
    if (res.kind === "portfolio") {
      dispatch({ type: "replace", draft: res.draft });
      setFileMsg({
        kind: "ok",
        lines: [`Opened ${res.draft.holdings.length} holdings in ${res.draft.currency}.`, ...res.warnings.slice(0, 6)],
      });
    } else {
      dispatch({
        type: "replace",
        draft: { currency: draft.currency, title: draft.isExample ? "My portfolio" : draft.title, holdings: res.holdings, dismissedDuplicates: [] },
      });
      setFileMsg({
        kind: "ok",
        lines: [
          `Imported ${res.holdings.length} holdings. Values are read as ${draft.currency} — change the currency if needed.`,
          ...(res.columns ? [`Columns used: ${[res.columns.identifier, res.columns.name, res.columns.value].filter(Boolean).join(", ")}.`] : []),
          ...res.skipped.slice(0, 6).map((x) => `Row ${x.row} skipped: ${x.reason}`),
          ...(res.skipped.length > 6 ? [`…and ${res.skipped.length - 6} more rows skipped.`] : []),
        ],
      });
    }
    setSelectedId(null);
    setZoomKey(null);
    setMobileTab("holdings");
  }

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <AtlasPatterns />
      </svg>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{BRAND.fullName}</p>
          <h1 id="hero-title" className="hero-title">
            See your portfolio <em>as a map.</em>
          </h1>
          <p className="hero-lede">
            Enter what you hold and Portfolio Atlas draws it: every holding is a shape sized exactly by its share, grouped
            into regions by sector or type. Explore it, then download a clean image to keep or share.
          </p>
          <div className="hero-cta">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                loadExample();
                setSelectedId(null);
                setZoomKey(null);
                goToWorkspace("map");
              }}
            >
              Try the example
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (draft.isExample) startEmpty();
                goToWorkspace("holdings");
              }}
            >
              Enter my holdings
            </button>
          </div>
          <p className="hero-note">No sign-up. Your holdings stay in this browser.</p>
        </div>
        <HeroGlyph />
      </section>

      <div className="workspace" id="atlas" ref={workspaceRef} data-ready={hydrated ? "true" : "false"}>
        {draft.isExample && (
          <div className="banner" role="status">
            <span>
              <strong>You&apos;re viewing an example portfolio.</strong> The amounts are fictional. Edits to the example aren&apos;t
              saved.
            </span>
            <span className="banner-actions">
              <button type="button" className="btn small" onClick={() => dispatch({ type: "adoptExample" })}>
                Use as my starting point
              </button>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => {
                  startEmpty();
                  setSelectedId(null);
                  setZoomKey(null);
                  setMobileTab("holdings");
                }}
              >
                Start my own
              </button>
            </span>
          </div>
        )}
        {hydrated && restored && !draft.isExample && (
          <p className="restored-note">Restored the portfolio saved in this browser.</p>
        )}

        <div className="tabs-mobile" role="tablist" aria-label="Workspace">
          <button type="button" role="tab" aria-selected={mobileTab === "holdings"} onClick={() => setMobileTab("holdings")}>
            Holdings ({summary.positions.length})
          </button>
          <button type="button" role="tab" aria-selected={mobileTab === "map"} onClick={() => setMobileTab("map")}>
            Atlas
          </button>
        </div>

        <div className="workspace-grid" data-tab={mobileTab}>
          <div className="col-editor">
            <HoldingsEditor
              draft={draft}
              dispatch={dispatch}
              provider={provider}
              onUpload={() => fileInput.current?.click()}
            />
            {summary.excluded.length > 0 && (
              <p className="notice warn" role="status">
                {summary.excluded.length} {summary.excluded.length === 1 ? "row has" : "rows have"} an invalid value and{" "}
                {summary.excluded.length === 1 ? "is" : "are"} not included in the map or totals.
              </p>
            )}
            <section className="data-box" aria-labelledby="data-title">
              <h3 id="data-title" className="eyebrow">
                Your data
              </h3>
              <p className="fine">
                {draft.isExample
                  ? "The example isn't saved."
                  : saveState === "unavailable"
                    ? "This browser isn't allowing local storage, so changes won't be remembered. Use “Save file”."
                    : "Saved automatically in this browser on this device only. Clearing browser data removes it — keep a file copy too."}
              </p>
              <div className="editor-actions">
                <button type="button" className="btn small" onClick={downloadFile} disabled={!summary.positions.length}>
                  Save file
                </button>
                <button type="button" className="btn small" onClick={() => fileInput.current?.click()}>
                  Upload
                </button>
                <button
                  type="button"
                  className="btn small ghost danger"
                  onClick={() => {
                    if (window.confirm("Remove all holdings from this browser? Files you saved are not affected.")) {
                      clearAll();
                      setSelectedId(null);
                      setZoomKey(null);
                      setFileMsg(null);
                    }
                  }}
                >
                  Clear all
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.csv,.tsv,.txt,.json,.png,application/json,image/png,text/csv"
                  hidden
                  data-testid="file-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void openFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {fileMsg && (
                <ul className={`file-msg ${fileMsg.kind}`} role="status">
                  {fileMsg.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </section>
            <button type="button" className="btn primary wide only-mobile" onClick={() => goToWorkspace("map")} disabled={!hasData}>
              See my atlas →
            </button>
          </div>

          <div className="col-atlas">
            <section className="atlas-card" aria-labelledby="atlas-title">
              <div className="atlas-head">
                <div>
                  <p className="eyebrow">{BRAND.product}</p>
                  <h2 id="atlas-title" className="atlas-title">
                    {draft.title || "My portfolio"}
                  </h2>
                </div>
                <div className="toolbar">
                  <div className="seg" role="radiogroup" aria-label="Group holdings by">
                    {(["sector", "type"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => {
                          setMode(m);
                          setZoomKey(null);
                        }}
                      >
                        {m === "sector" ? "By sector" : "By type"}
                      </button>
                    ))}
                  </div>
                  <div className="seg" role="radiogroup" aria-label="View as">
                    {(["map", "table"] as const).map((v) => (
                      <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}>
                        {v === "map" ? "Map" : "Table"}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn primary" onClick={() => setExportOpen(true)} disabled={!hasData}>
                    Download image
                  </button>
                </div>
              </div>

              {!hasData ? (
                <div className="atlas-empty">
                  <p className="atlas-empty-title">Your atlas appears here.</p>
                  <p>
                    {summary.positions.length > 0
                      ? "All entered values are zero. Add a value above zero to draw the map."
                      : "Add at least one holding with its current value — or try the example."}
                  </p>
                  <button type="button" className="btn" onClick={loadExample}>
                    Try the example
                  </button>
                </div>
              ) : (
                <>
                  {zoomKey && (
                    <div className="zoom-bar" role="status">
                      <span>
                        Zoomed into <strong>{groups.find((g) => g.key === zoomKey)?.style.label}</strong> (
                        {formatPercent(groups.find((g) => g.key === zoomKey)?.weight ?? 0)} of total). Areas are relative to
                        this region; labels still show share of the total.
                      </span>
                      <button type="button" className="btn small" onClick={() => setZoomKey(null)}>
                        ← Whole atlas
                      </button>
                    </div>
                  )}
                  {view === "map" ? (
                    <AtlasMap
                      groups={groups}
                      currency={draft.currency}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      zoomKey={zoomKey}
                      onZoom={onZoom}
                    />
                  ) : (
                    <HoldingsTable
                      summary={summary}
                      selectedId={selectedId}
                      onSelect={(id) => setSelectedId(id)}
                    />
                  )}
                  <StatRow insights={insights} currency={draft.currency} />
                  <div className="atlas-lower">
                    <div>
                      <DetailCard
                        position={selected}
                        summary={summary}
                        groups={groups}
                        mode={mode}
                        onClose={() => setSelectedId(null)}
                      />
                      <Observations insights={insights} />
                    </div>
                    <Legend groups={groups} mode={mode} zoomKey={zoomKey} onZoom={setZoomKey} />
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        base={exportBase}
        title={draft.title}
        onTitle={(t) => dispatch({ type: "setTitle", title: t })}
        portfolioJson={() => JSON.stringify(toFile(draft))}
      />
    </>
  );
}

/** Decorative hero illustration: a small static atlas. Not data. */
function HeroGlyph() {
  const tiles: [number, number, number, number, string, string?][] = [
    [0, 0, 150, 170, "#6E9BE6"],
    [150, 0, 90, 100, "#6E9BE6"],
    [150, 100, 90, 70, "#A88BE3"],
    [0, 170, 110, 130, "#D8CFBC", "hatch"],
    [110, 170, 130, 80, "#D8CFBC", "hatch"],
    [110, 250, 70, 50, "#E4E0D6", "dots"],
    [180, 250, 60, 50, "#6CC9A8"],
    [240, 0, 80, 120, "#3E9BA6"],
    [240, 120, 80, 90, "#F08C6E"],
    [240, 210, 45, 90, "#E3BC4E"],
    [285, 210, 35, 50, "#E58FB4"],
    [285, 260, 35, 40, "#EFEBE2", "stipple"],
  ];
  return (
    <div className="hero-glyph" aria-hidden="true">
      <svg viewBox="-6 -6 332 312" role="presentation">
        {tiles.map(([x, y, w, h, fill, tex], i) => (
          <g key={i} className="glyph-tile" style={{ animationDelay: `${i * 60}ms` }}>
            <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx={3} fill={fill} />
            {tex && <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx={3} fill={`url(#tx-${tex})`} />}
          </g>
        ))}
        <rect x={0} y={0} width={240} height={170} fill="none" stroke="#15171C" strokeWidth={2} />
        <rect x={0} y={170} width={240} height={130} fill="none" stroke="#15171C" strokeWidth={2} />
        <rect x={240} y={0} width={80} height={300} fill="none" stroke="#15171C" strokeWidth={2} />
      </svg>
      <p className="glyph-caption">Illustration</p>
    </div>
  );
}
