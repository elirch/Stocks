"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { insetRect, layoutAtlas, pickScaleShare, scaleSquareSide } from "@/lib/layout/atlas";
import type { Rect } from "@/lib/layout/treemap";
import type { Group } from "@/lib/portfolio/calc";
import { formatMoney, formatPercent } from "@/lib/format/format";
import { TYPE_TEXTURE, sectorDescription, type GroupKey, type Texture } from "@/lib/portfolio/taxonomy";
import type { Position } from "@/lib/portfolio/types";
import { useAtlasTween, usePrefersReducedMotion } from "./useAtlasTween";

interface Props {
  groups: Group[];
  currency: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoomKey: GroupKey | null;
  onZoom: (key: GroupKey | null) => void;
}

const INK = "#15171C";

/** Rough text width for Inter at a given size — used only to decide whether a label fits. */
function textWidth(s: string, size: number) {
  return s.length * size * 0.56;
}

function fitText(s: string, size: number, maxW: number): string | null {
  if (textWidth(s, size) <= maxW) return s;
  const n = Math.floor(maxW / (size * 0.56)) - 1;
  if (n < 4) return null;
  return `${s.slice(0, n).trimEnd()}…`;
}

export function textureFor(p: Position): Texture {
  return TYPE_TEXTURE[p.type];
}

export function AtlasPatterns() {
  return (
    <defs>
      <pattern id="tx-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" stroke={INK} strokeOpacity="0.28" strokeWidth="1.6" />
      </pattern>
      <pattern id="tx-dots" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.3" fill={INK} fillOpacity="0.32" />
        <circle cx="6" cy="6" r="1.3" fill={INK} fillOpacity="0.32" />
      </pattern>
      <pattern id="tx-cross" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="9" stroke={INK} strokeOpacity="0.22" strokeWidth="1.2" />
        <line x1="0" y1="0" x2="9" y2="0" stroke={INK} strokeOpacity="0.22" strokeWidth="1.2" />
      </pattern>
      <pattern id="tx-stipple" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="3" r="0.9" fill={INK} fillOpacity="0.35" />
        <circle cx="7" cy="1" r="0.7" fill={INK} fillOpacity="0.3" />
        <circle cx="5" cy="7" r="0.9" fill={INK} fillOpacity="0.35" />
        <circle cx="9" cy="8" r="0.6" fill={INK} fillOpacity="0.3" />
      </pattern>
    </defs>
  );
}

export function AtlasMap({ groups, currency, selectedId, onSelect, zoomKey, onZoom }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = width === 0 ? 0 : width < 560 ? Math.round(width * 1.25) : Math.round(Math.min(width * 0.62, 720));
  const zoomGroup = zoomKey ? groups.find((g) => g.key === zoomKey) ?? null : null;
  const shown = useMemo(() => (zoomGroup ? [zoomGroup] : groups), [groups, zoomGroup]);
  const layout = useMemo(() => layoutAtlas(shown, width, height), [shown, width, height]);
  const frame = useAtlasTween(layout, reducedMotion);

  // Keyboard order: by value across everything shown.
  const order = useMemo(() => [...layout.tiles].sort((a, b) => a.position.rank - b.position.rank), [layout]);
  const byId = useMemo(() => new Map(layout.tiles.map((t) => [t.id, t])), [layout]);
  const shownTotal = shown.reduce((a, g) => a + g.value, 0);

  useEffect(() => {
    if (zoomKey && !zoomGroup) onZoom(null);
  }, [zoomKey, zoomGroup, onZoom]);

  const active = activeId ? byId.get(activeId) : undefined;
  const hovered = hover ? byId.get(hover.id) : undefined;
  const scaleShare = pickScaleShare(layout);
  const scaleSide = scaleSquareSide(layout, scaleShare);

  function hitTest(px: number, py: number) {
    for (const t of layout.tiles) {
      const r = t.rect;
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return t;
    }
    return undefined;
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType !== "mouse") return;
    const box = e.currentTarget.getBoundingClientRect();
    const t = hitTest(e.clientX - box.left, e.clientY - box.top);
    setHover(t ? { id: t.id, x: e.clientX - box.left, y: e.clientY - box.top } : null);
  }

  function onClick(e: MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const t = hitTest(e.clientX - box.left, e.clientY - box.top);
    if (t) {
      onSelect(t.id === selectedId ? null : t.id);
      setActiveId(t.id);
    }
  }

  function move(delta: number) {
    if (!order.length) return;
    const idx = activeId ? order.findIndex((t) => t.id === activeId) : -1;
    const next = idx < 0 ? (delta > 0 ? 0 : order.length - 1) : (idx + delta + order.length) % order.length;
    setActiveId(order[next]!.id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        move(-1);
        break;
      case "Home":
        if (order[0]) setActiveId(order[0].id);
        break;
      case "End":
        if (order.length) setActiveId(order[order.length - 1]!.id);
        break;
      case "Enter":
      case " ":
        if (activeId) onSelect(activeId === selectedId ? null : activeId);
        break;
      case "Escape":
        if (selectedId) onSelect(null);
        else if (zoomKey) onZoom(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  const highlightId = (focused && activeId) || selectedId;
  const liveText = active
    ? `${active.position.label}: ${formatPercent(active.position.weight)} of entered holdings, rank ${active.position.rank}. ${sectorDescription(active.position)}. Press Enter for details.`
    : "";

  return (
    <div className="atlas">
      <div
        ref={wrapRef}
        className="atlas-frame"
        style={{ height: height || undefined }}
        tabIndex={0}
        role="group"
        aria-roledescription="portfolio map"
        aria-label={`Portfolio map with ${layout.tiles.length} holdings. Use arrow keys to move between holdings by size, Enter to open details${zoomKey ? ", Escape to zoom out" : ""}.`}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setFocused(true);
          if (!activeId && order[0]) setActiveId(selectedId ?? order[0].id);
        }}
        onBlur={() => setFocused(false)}
      >
        {width > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="atlas-svg"
            aria-hidden="true"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
            onClick={onClick}
          >
            {layout.tiles.map((t) => {
              const r = frame.get(t.id) ?? t.rect;
              const d = insetRect(r, 0.75);
              const style = t.position;
              const fill = groups.find((g) => g.key === t.groupKey)?.style.fill ?? "#ddd";
              const tex = textureFor(style);
              const rx = Math.min(3, d.w / 4, d.h / 4);
              return (
                <g key={t.id}>
                  <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={rx} fill={fill} />
                  {tex !== "none" && <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={rx} fill={`url(#tx-${tex})`} />}
                  <TileLabel rect={d} position={t.position} />
                </g>
              );
            })}
            {layout.regions.map((rg) => {
              const r = frame.get(`r:${rg.key}`) ?? rg.rect;
              return (
                <rect
                  key={rg.key}
                  x={r.x + 0.5}
                  y={r.y + 0.5}
                  width={Math.max(0, r.w - 1)}
                  height={Math.max(0, r.h - 1)}
                  fill="none"
                  stroke={INK}
                  strokeWidth={1.5}
                />
              );
            })}
            {hovered && hovered.id !== highlightId && <Highlight rect={frame.get(hovered.id) ?? hovered.rect} weight={1.5} />}
            {highlightId && byId.get(highlightId) && (
              <Highlight rect={frame.get(highlightId) ?? byId.get(highlightId)!.rect} weight={3} ring />
            )}
          </svg>
        )}
        {/* Region labels are real buttons: they zoom into a region. */}
        {width > 0 &&
          layout.regions.map((rg) => {
            const r = rg.rect;
            if (r.w < 96 || r.h < 44) return null;
            const share = shownTotal > 0 ? rg.group.value / shownTotal : 0;
            return (
              <button
                key={rg.key}
                type="button"
                className="region-chip"
                style={{ left: r.x + 6, top: r.y + 6, maxWidth: r.w - 12 }}
                onClick={() => onZoom(zoomKey ? null : rg.key)}
                aria-label={zoomKey ? `Zoom out from ${rg.group.style.label}` : `Zoom into ${rg.group.style.label}, ${formatPercent(rg.group.weight)}`}
              >
                <span className="region-chip-name">{rg.group.style.label}</span>
                <span className="region-chip-pct">{formatPercent(zoomKey ? rg.group.weight : share)}</span>
              </button>
            );
          })}
        {hovered && hover && (
          <div
            className="atlas-tooltip"
            style={{
              left: Math.min(hover.x + 14, width - 230),
              top: hover.y + 16 > height - 90 ? hover.y - 86 : hover.y + 16,
            }}
            role="presentation"
          >
            <strong>{hovered.position.label}</strong>
            <span className="tt-row">
              <span>{formatPercent(hovered.position.weight, 2)}</span>
              <span>{formatMoney(hovered.position.value, currency)}</span>
            </span>
            <span className="tt-sub">{sectorDescription(hovered.position)}</span>
          </div>
        )}
        <div className="sr-only" aria-live="polite">
          {focused ? liveText : ""}
        </div>
      </div>
      <div className="atlas-scale" aria-label={`Scale: a square this size represents ${Math.round(scaleShare * 100)}% of ${zoomGroup ? zoomGroup.style.label : "the holdings shown"}`}>
        <span className="scale-square" style={{ width: scaleSide, height: scaleSide }} aria-hidden="true" />
        <span>
          = {Math.round(scaleShare * 100)}% of {zoomGroup ? `${zoomGroup.style.label} (${formatPercent(zoomGroup.weight * scaleShare, 2)} of total)` : "entered holdings"}.
          Each shape&apos;s area is proportional to its value.
        </span>
      </div>
    </div>
  );
}

function Highlight({ rect, weight, ring }: { rect: Rect; weight: number; ring?: boolean }) {
  const small = Math.min(rect.w, rect.h) < 12;
  return (
    <g pointerEvents="none">
      <rect
        x={rect.x + weight / 2}
        y={rect.y + weight / 2}
        width={Math.max(0, rect.w - weight)}
        height={Math.max(0, rect.h - weight)}
        fill="none"
        stroke={INK}
        strokeWidth={weight}
      />
      {ring && small && (
        // A locator ring for very small holdings: an outline only, so the holding's
        // drawn area is not enlarged.
        <circle cx={rect.x + rect.w / 2} cy={rect.y + rect.h / 2} r={14} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="4 3" />
      )}
    </g>
  );
}

function TileLabel({ rect, position }: { rect: Rect; position: Position }) {
  const { w, h } = rect;
  if (w < 30 || h < 16) return null;
  const size = Math.max(10, Math.min(20, Math.sqrt(w * h) / 7.5));
  const pct = formatPercent(position.weight);
  const pad = Math.max(4, size * 0.45);
  const maxW = w - pad * 2;
  const name = h >= size * 2.6 ? fitText(position.label, size, maxW) : null;
  const pctSize = name ? size * 0.82 : Math.min(size, 13);
  if (textWidth(pct, pctSize) > maxW) return null;
  const bottom = rect.y + h - pad;
  return (
    <g pointerEvents="none" className="tile-label">
      {name && (
        <text x={rect.x + pad} y={bottom - pctSize * 1.25} fontSize={size} fontWeight={600} fill={INK}>
          {name}
        </text>
      )}
      <text x={rect.x + pad} y={bottom} fontSize={pctSize} fill={INK} fillOpacity={0.78} className="tnum">
        {pct}
      </text>
    </g>
  );
}
