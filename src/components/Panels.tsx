"use client";

import type { Group, PortfolioSummary } from "@/lib/portfolio/calc";
import { formatMoney, formatPercent } from "@/lib/format/format";
import type { Insights } from "@/lib/portfolio/insights";
import { INSTRUMENT_LABELS, groupKeyFor, sectorDescription, type GroupKey, type GroupMode, type Texture } from "@/lib/portfolio/taxonomy";
import type { Position } from "@/lib/portfolio/types";

export function Swatch({ fill, texture }: { fill: string; texture: Texture }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="swatch">
      <rect x="0.5" y="0.5" width="13" height="13" rx="2.5" fill={fill} stroke="#15171C" strokeOpacity="0.5" />
      {texture !== "none" && <rect x="0.5" y="0.5" width="13" height="13" rx="2.5" fill={`url(#tx-${texture})`} />}
    </svg>
  );
}

export function StatRow({ insights, currency }: { insights: Insights; currency: string }) {
  return (
    <dl className="stats">
      <div className="stat">
        <dt>Total entered</dt>
        <dd className="tnum">{formatMoney(insights.total, currency)}</dd>
      </div>
      <div className="stat">
        <dt>Holdings</dt>
        <dd className="tnum">{insights.holdingCount}</dd>
      </div>
      <div className="stat">
        <dt>Largest</dt>
        <dd>
          {insights.largest ? (
            <>
              <span className="tnum">{formatPercent(insights.largest.weight)}</span>
              <span className="stat-sub">{insights.largest.label}</span>
            </>
          ) : (
            "—"
          )}
        </dd>
      </div>
      <div className="stat">
        <dt>Top {insights.topN || 3}</dt>
        <dd className="tnum">{insights.topN ? formatPercent(insights.topNWeight) : "—"}</dd>
      </div>
    </dl>
  );
}

export function Observations({ insights }: { insights: Insights }) {
  if (!insights.observations.length) return null;
  return (
    <section className="observations" aria-labelledby="obs-title">
      <h3 id="obs-title" className="eyebrow">
        What the numbers say
      </h3>
      <ul>
        {insights.observations.map((o) => (
          <li key={o.id}>{o.text}</li>
        ))}
      </ul>
      <p className="fine">
        Calculations from the values you entered — not interpretations or advice. They describe only the holdings entered,
        not your total wealth.
      </p>
    </section>
  );
}

export function Legend({
  groups,
  mode,
  zoomKey,
  onZoom,
}: {
  groups: Group[];
  mode: GroupMode;
  zoomKey: GroupKey | null;
  onZoom: (k: GroupKey | null) => void;
}) {
  const max = Math.max(...groups.map((g) => g.weight), 0.0001);
  return (
    <section className="legend" aria-labelledby="legend-title">
      <h3 id="legend-title" className="eyebrow">
        {mode === "sector" ? "Sector composition" : "By instrument type"}
      </h3>
      <ul>
        {groups.map((g) => (
          <li key={g.key}>
            <button
              type="button"
              className={`legend-item${zoomKey === g.key ? " on" : ""}`}
              onClick={() => onZoom(zoomKey === g.key ? null : g.key)}
              aria-pressed={zoomKey === g.key}
              aria-label={`${g.style.label}: ${formatPercent(g.weight)}, ${g.positions.length} holdings. ${zoomKey === g.key ? "Zoom out" : "Zoom in"}`}
            >
              <Swatch fill={g.style.fill} texture={g.style.texture} />
              <span className="legend-name">{g.style.label}</span>
              <span className="legend-bar" aria-hidden="true">
                <span style={{ width: `${(g.weight / max) * 100}%`, background: g.style.fill }} />
              </span>
              <span className="legend-pct tnum">{formatPercent(g.weight)}</span>
            </button>
            {g.style.note && <p className="legend-note">{g.style.note}</p>}
          </li>
        ))}
      </ul>
      <p className="fine">Texture shows instrument type: hatched = fund/ETF, dotted = cash, crosshatch = crypto, speckled = no type/sector.</p>
    </section>
  );
}

export function DetailCard({
  position,
  summary,
  groups,
  mode,
  onClose,
}: {
  position: Position | null;
  summary: PortfolioSummary;
  groups: Group[];
  mode: GroupMode;
  onClose: () => void;
}) {
  if (!position) {
    return (
      <section className="detail empty" aria-live="polite">
        <p>
          <strong>Select any shape</strong> on the map — or a row in the table — to see its exact value and share.
        </p>
      </section>
    );
  }
  const group = groups.find((g) => g.key === groupKeyFor(position, mode));
  const of = summary.drawable.length;
  return (
    <section className="detail" aria-live="polite" aria-labelledby="detail-title">
      <div className="detail-head">
        <div>
          <p className="eyebrow">
            #{position.rank} of {of}
          </p>
          <h3 id="detail-title" className="detail-title">
            {position.label}
          </h3>
          {(position.identifier || position.exchange) && (
            <p className="detail-id">{[position.identifier, position.exchange].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Share of entered holdings</dt>
          <dd className="big tnum">{formatPercent(position.weight, 2)}</dd>
        </div>
        <div>
          <dt>Current value</dt>
          <dd className="big tnum">{formatMoney(position.value, summary.currency)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{INSTRUMENT_LABELS[position.type]}</dd>
        </div>
        <div>
          <dt>Sector</dt>
          <dd>{sectorDescription(position)}</dd>
        </div>
        {group && group.positions.length > 1 && (
          <div className="span2">
            <dt>Within {group.style.label}</dt>
            <dd>
              {formatPercent(position.value / group.value)} of this group ({formatPercent(group.weight)} of the total)
            </dd>
          </div>
        )}
      </dl>
      <p className="fine">
        {position.source === "manual" && "Details as entered by you."}
        {position.source === "fixture" && "Name and classification from the built-in demo list — please double-check."}
        {position.source === "provider" && "Name and type from the security-search provider."}
        {(position.type === "etf" || position.type === "mutual_fund") && " What this fund holds is not broken down here."}
      </p>
    </section>
  );
}

export function HoldingsTable({
  summary,
  selectedId,
  onSelect,
}: {
  summary: PortfolioSummary;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="holdings-table">
        <caption className="sr-only">All entered holdings, largest first</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Holding</th>
            <th scope="col">Type</th>
            <th scope="col">Sector</th>
            <th scope="col" className="num">
              Value ({summary.currency})
            </th>
            <th scope="col" className="num">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.positions.map((p) => (
            <tr key={p.id} className={p.id === selectedId ? "sel" : undefined}>
              <td className="tnum">{p.rank}</td>
              <th scope="row">
                <button type="button" className="link-btn" onClick={() => onSelect(p.id)} disabled={p.value === 0}>
                  {p.label}
                </button>
                {p.identifier && p.identifier !== p.label && <span className="cell-sub">{p.identifier}</span>}
              </th>
              <td>{INSTRUMENT_LABELS[p.type]}</td>
              <td>{sectorDescription(p)}</td>
              <td className="num tnum">{formatMoney(p.value, summary.currency)}</td>
              <td className="num tnum">{formatPercent(p.weight, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {summary.positions.some((p) => p.value === 0) && <p className="fine">Zero-value holdings are listed but can&apos;t be drawn on the map.</p>}
    </div>
  );
}
