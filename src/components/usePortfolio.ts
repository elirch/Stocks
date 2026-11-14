"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { dismissGroup, mergeDuplicates } from "@/lib/portfolio/duplicates";
import { blankHolding, emptyPortfolio, examplePortfolio } from "@/lib/portfolio/example";
import { makeId } from "@/lib/portfolio/ids";
import { canHaveSector } from "@/lib/portfolio/taxonomy";
import type { HoldingDraft, PortfolioDraft } from "@/lib/portfolio/types";
import { MAX_HOLDINGS } from "@/lib/portfolio/validate";
import { clearLocal, loadLocal, saveLocal } from "@/lib/persistence/local";

type Action =
  | { type: "replace"; draft: PortfolioDraft }
  | { type: "setCurrency"; currency: string }
  | { type: "setTitle"; title: string }
  | { type: "add"; after?: string }
  | { type: "addMany"; holdings: HoldingDraft[] }
  | { type: "update"; id: string; patch: Partial<HoldingDraft> }
  | { type: "remove"; id: string }
  | { type: "merge"; ids: string[] }
  | { type: "keepBoth"; ids: string[] }
  | { type: "adoptExample" };

function reducer(state: PortfolioDraft, action: Action): PortfolioDraft {
  switch (action.type) {
    case "replace":
      return action.draft;
    case "setCurrency":
      return { ...state, currency: action.currency };
    case "setTitle":
      return { ...state, title: action.title.slice(0, 60) };
    case "add": {
      if (state.holdings.length >= MAX_HOLDINGS) return state;
      const h = blankHolding(makeId);
      const idx = action.after ? state.holdings.findIndex((x) => x.id === action.after) : -1;
      const holdings = [...state.holdings];
      holdings.splice(idx >= 0 ? idx + 1 : holdings.length, 0, h);
      return { ...state, holdings };
    }
    case "addMany": {
      // Replace a single untouched blank row rather than leaving it dangling.
      const base = state.holdings.filter((h) => h.identifier || h.name || h.valueText);
      const room = MAX_HOLDINGS - base.length;
      return { ...state, holdings: [...base, ...action.holdings.slice(0, Math.max(0, room))] };
    }
    case "update":
      return {
        ...state,
        holdings: state.holdings.map((h) => {
          if (h.id !== action.id) return h;
          const next = { ...h, ...action.patch };
          if (!canHaveSector(next.type)) next.sector = null;
          // Editing descriptive fields by hand makes the row manual.
          if (("name" in action.patch || "sector" in action.patch || "type" in action.patch) && !("source" in action.patch)) {
            next.source = "manual";
          }
          return next;
        }),
      };
    case "remove": {
      const holdings = state.holdings.filter((h) => h.id !== action.id);
      return { ...state, holdings: holdings.length ? holdings : [blankHolding(makeId)] };
    }
    case "merge": {
      const merged = mergeDuplicates(state.holdings, action.ids);
      return merged ? { ...state, holdings: merged } : state;
    }
    case "adoptExample":
      return { ...state, isExample: false, title: state.title === "Example portfolio" ? "My portfolio" : state.title };
    case "keepBoth":
      return { ...state, dismissedDuplicates: dismissGroup(state.dismissedDuplicates, action.ids) };
  }
}

export type SaveState = "idle" | "saved" | "unavailable";

export function usePortfolio() {
  const [draft, dispatch] = useReducer(reducer, undefined, () => emptyPortfolio(makeId));
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const skipSave = useRef(true);

  // Restore from this browser on first load.
  useEffect(() => {
    const saved = loadLocal(makeId);
    if (saved && saved.holdings.length) {
      dispatch({ type: "replace", draft: saved });
      setRestored(true);
    }
    setHydrated(true);
  }, []);

  // Autosave (debounced). The example portfolio is never written over the user's data.
  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (draft.isExample) return;
    const t = window.setTimeout(() => setSaveState(saveLocal(draft) ? "saved" : "unavailable"), 400);
    return () => window.clearTimeout(t);
  }, [draft, hydrated]);

  const loadExample = useCallback(() => dispatch({ type: "replace", draft: examplePortfolio(makeId) }), []);
  const startEmpty = useCallback(() => {
    // Fresh start: restore what this browser saved, if anything; otherwise a blank sheet.
    const saved = loadLocal(makeId);
    dispatch({ type: "replace", draft: saved && saved.holdings.length ? saved : emptyPortfolio(makeId) });
  }, []);
  const clearAll = useCallback(() => {
    clearLocal();
    skipSave.current = true;
    setSaveState("idle");
    setRestored(false);
    dispatch({ type: "replace", draft: emptyPortfolio(makeId) });
  }, []);

  return { draft, dispatch, hydrated, restored, saveState, loadExample, startEmpty, clearAll };
}

export type PortfolioDispatch = ReturnType<typeof usePortfolio>["dispatch"];
