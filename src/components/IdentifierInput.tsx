"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ProviderInfo, SecurityMatch } from "@/lib/market-data/types";
import { INSTRUMENT_LABELS } from "@/lib/portfolio/taxonomy";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick: (m: SecurityMatch) => void;
  provider: ProviderInfo;
  rowLabel: string;
}

/**
 * Identifier field with optional security search. Only the typed text is
 * sent to the server; values and other holdings are never included.
 */
export function IdentifierInput({ value, onChange, onPick, provider, rowLabel }: Props) {
  const [results, setResults] = useState<SecurityMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [typed, setTyped] = useState(false);
  const listId = useId();
  const abort = useRef<AbortController | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!provider.enabled || !typed) return;
    const q = value.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setStatus("loading");
      try {
        const res = await fetch(`/api/securities/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("search failed");
        const body = (await res.json()) as { results: SecurityMatch[] };
        setResults(body.results ?? []);
        setOpen(focusedRef.current);
        setActive(-1);
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [value, provider.enabled, typed]);

  function choose(m: SecurityMatch) {
    onPick(m);
    setOpen(false);
    setTyped(false);
  }

  const showList = open && typed && provider.enabled && value.trim().length > 0;

  return (
    <div className="combo">
      <input
        className="input"
        value={value}
        maxLength={120}
        placeholder={provider.enabled ? "Ticker (search)" : "Ticker / ID"}
        aria-label={`Identifier for ${rowLabel}`}
        role={provider.enabled ? "combobox" : undefined}
        aria-expanded={provider.enabled ? showList : undefined}
        aria-controls={provider.enabled ? listId : undefined}
        aria-autocomplete={provider.enabled ? "list" : undefined}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setTyped(true);
          onChange(e.target.value);
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          abort.current?.abort();
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            setActive((a) => Math.min(results.length - 1, a + 1));
            e.preventDefault();
          } else if (e.key === "ArrowUp") {
            setActive((a) => Math.max(-1, a - 1));
            e.preventDefault();
          } else if (e.key === "Enter" && active >= 0 && results[active]) {
            choose(results[active]);
            e.preventDefault();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul className="combo-list" id={listId} role="listbox" aria-label="Matching securities">
          {status === "error" && <li className="combo-note">Search unavailable. Keep typing to enter it manually.</li>}
          {results.length === 0 && status !== "error" && (
            <li className="combo-note">No match — that&apos;s fine, just fill in the name yourself.</li>
          )}
          {results.map((m, i) => (
            <li
              key={`${m.identifier}@${m.exchange ?? ""}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "combo-opt active" : "combo-opt"}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m);
              }}
            >
              <span className="combo-id">{m.identifier}</span>
              <span className="combo-name">{m.name}</span>
              <span className="combo-meta">
                {[m.exchange, m.type ? INSTRUMENT_LABELS[m.type] : null].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
          <li className="combo-source">
            {provider.isDemo ? "Demo data — a small sample list for testing, not a live data feed." : provider.attribution ?? provider.label}
          </li>
        </ul>
      )}
    </div>
  );
}
