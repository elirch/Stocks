"use client";

import { useEffect, useRef, useState } from "react";
import { lerpRect, type AtlasLayout } from "@/lib/layout/atlas";
import type { Rect } from "@/lib/layout/treemap";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Animates tile/region rectangles between layouts. Purely a layout
 * transition: it runs only when the user changes data, grouping or zoom,
 * and never loops (motion must not suggest live market activity).
 */
export function useAtlasTween(layout: AtlasLayout, reducedMotion: boolean, duration = 520) {
  const target = useRef(new Map<string, Rect>());
  const current = useRef(new Map<string, Rect>());
  const [frame, setFrame] = useState<Map<string, Rect>>(new Map());

  useEffect(() => {
    const next = new Map<string, Rect>();
    for (const r of layout.regions) next.set(`r:${r.key}`, r.rect);
    for (const t of layout.tiles) next.set(t.id, t.rect);
    target.current = next;

    const from = current.current;
    if (reducedMotion || from.size === 0) {
      current.current = next;
      setFrame(next);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = ease(t);
      const m = new Map<string, Rect>();
      for (const [id, to] of next) {
        const prev = from.get(id) ?? { x: to.x + to.w / 2, y: to.y + to.h / 2, w: 0, h: 0 };
        m.set(id, lerpRect(prev, to, k));
      }
      current.current = m;
      setFrame(m);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout, reducedMotion, duration]);

  return frame;
}
