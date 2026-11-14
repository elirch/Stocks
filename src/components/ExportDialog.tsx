"use client";

import { useEffect, useRef, useState } from "react";
import { canvasToBlob, exportFileName, renderInfographicCanvas, type ExportOptions } from "@/lib/export/renderInfographic";
import { BRAND } from "@/lib/brand";
import { embedText } from "@/lib/export/pngMeta";

type Base = Omit<ExportOptions, "showAmounts" | "date" | "brand" | "product" | "title">;

export function ExportDialog({ open, onClose, base, title, onTitle, portfolioJson }: {
  open: boolean;
  /** Serialized portfolio file, embedded only in the "editable copy". */
  portfolioJson: () => string;
  onClose: () => void;
  base: Base;
  title: string;
  onTitle: (t: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Default back to percentages-only every time the dialog opens.
  useEffect(() => {
    if (open) setShowAmounts(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let url: string | null = null;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const canvas = await renderInfographicCanvas(options(), 1);
        const blob = await canvasToBlob(canvas);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showAmounts, title, base]);

  function options(): ExportOptions {
    return { ...base, title, showAmounts, date: new Date(), brand: BRAND.byline, product: BRAND.product };
  }

  async function download(editable: boolean) {
    setBusy(true);
    try {
      const o = options();
      const canvas = await renderInfographicCanvas(o, 2);
      let blob = await canvasToBlob(canvas);
      if (editable) {
        const bytes = embedText(new Uint8Array(await blob.arrayBuffer()), portfolioJson());
        blob = new Blob([bytes as BlobPart], { type: "image/png" });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName(o.title, o.date, editable);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="export-title">
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id="export-title" className="panel-title">Download image</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="export-grid">
          <div className="export-preview">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview of the infographic image" />
            ) : (
              <div className="preview-placeholder">Rendering preview…</div>
            )}
          </div>
          <div className="export-options">
            <label className="field">
              <span>Title on the image</span>
              <input className="input" value={title} maxLength={60} onChange={(e) => onTitle(e.target.value)} />
            </label>
            <fieldset className="field">
              <legend>What to show</legend>
              <label className="radio">
                <input type="radio" name="amounts" checked={!showAmounts} onChange={() => setShowAmounts(false)} />
                <span>
                  <strong>Percentages only</strong>
                  <small>Recommended for sharing. No amounts appear in the image.</small>
                </span>
              </label>
              <label className="radio">
                <input type="radio" name="amounts" checked={showAmounts} onChange={() => setShowAmounts(true)} />
                <span>
                  <strong>Include amounts ({base.currency})</strong>
                  <small>Shows your total and the value of each holding. Think before posting publicly.</small>
                </span>
              </label>
            </fieldset>
            {showAmounts && (
              <p className="notice warn" role="status">
                This image will reveal how much you hold.
              </p>
            )}
            {error && <p className="row-error">{error}</p>}
            <button type="button" className="btn primary wide" onClick={() => download(false)} disabled={busy}>
              {busy ? "Preparing…" : "Download PNG"}
            </button>
            <div className="editable-box">
              <button type="button" className="btn wide" onClick={() => download(true)} disabled={busy}>
                Download editable copy
              </button>
              <p className="fine">
                Same image, with your holdings saved inside. Upload it here later to keep editing. Keep it private — it contains
                your values.
              </p>
            </div>
            <p className="fine">2160 × 2700 PNG, made on your device.</p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
