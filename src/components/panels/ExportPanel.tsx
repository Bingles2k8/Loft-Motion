"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import { analyzeScene } from "@/lib/capability/engine";
import { EXPORT_TARGETS, type ExportTarget } from "@/lib/scene/schema";
import { LEVEL_META, TARGET_LABEL } from "@/components/ui/compat";
import { canExportMp4, exportMp4, type Mp4Progress } from "@/lib/export/mp4";
import { exportLottie } from "@/lib/export/lottie";
import { exportCss } from "@/lib/export/css";
import { downloadFile, downloadSceneJson } from "@/lib/io/file";

const DESCRIPTIONS: Record<ExportTarget, string> = {
  mp4: "Hardware-encoded H.264, rendered frame-by-frame in your browser. Everything you see survives — effects included.",
  lottie: "Bodymovin JSON for web & app players. Vector-clean, tiny — but shader effects can't come along.",
  css: "Standalone @keyframes + HTML. Named easings map to cubic-bezier(); drop it straight into a page.",
};

function safeName(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "scene";
}

export function ExportPanel() {
  const show = useStore((s) => s.showExport);
  const setShow = useStore((s) => s.setShowExport);
  const scene = useStore((s) => s.scene);
  const activeTarget = useStore((s) => s.activeTarget);
  const setActiveTarget = useStore((s) => s.setActiveTarget);

  const [progress, setProgress] = useState<Mp4Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [mp4Ok, setMp4Ok] = useState<boolean | null>(null);
  const [cssPreview, setCssPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const report = useMemo(() => analyzeScene(scene), [scene]);

  useEffect(() => {
    if (show) canExportMp4(scene).then(setMp4Ok);
  }, [show, scene]);

  if (!show) return null;

  const target = activeTarget;
  const tr = report[target];

  const runExport = async () => {
    setError(null);
    setCssPreview(null);
    try {
      if (target === "mp4") {
        setBusy(true);
        setProgress({ phase: "preparing", frame: 0, total: 1 });
        const blob = await exportMp4(scene, setProgress);
        downloadFile(`${safeName(scene.name)}.mp4`, blob, "video/mp4");
      } else if (target === "lottie") {
        const { json } = exportLottie(scene);
        downloadFile(`${safeName(scene.name)}.lottie.json`, JSON.stringify(json));
      } else {
        const { document, css } = exportCss(scene);
        downloadFile(`${safeName(scene.name)}.html`, document, "text/html");
        setCssPreview(css);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const disabled = busy || (target === "mp4" && mp4Ok === false);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={() => !busy && setShow(false)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
          <h2 className="text-sm font-bold">Export</h2>
          <button
            onClick={() => !busy && setShow(false)}
            className="text-haze-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Target tabs */}
        <div className="flex gap-1 border-b border-ink-700 px-3 py-2">
          {EXPORT_TARGETS.map((t) => {
            const m = LEVEL_META[report[t].level];
            return (
              <button
                key={t}
                onClick={() => setActiveTarget(t)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  t === target
                    ? "bg-ink-700 text-white"
                    : "text-haze-400 hover:bg-ink-800"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                {TARGET_LABEL[t]}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs leading-relaxed text-haze-300">
            {DESCRIPTIONS[target]}
          </p>

          {target === "mp4" && mp4Ok === false && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              This browser doesn&apos;t support the WebCodecs video encoder. Try
              Chrome, Edge, or Firefox 130+. You can still export Lottie or CSS.
            </div>
          )}

          {/* Capability summary */}
          <div className="mt-4">
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-haze-400">
              What survives
            </h3>
            {tr.issues.length === 0 ? (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-200">
                Everything in this scene exports cleanly to {TARGET_LABEL[target]}. ✨
              </p>
            ) : (
              <ul className="space-y-1">
                {tr.issues.map((f, i) => {
                  const m = LEVEL_META[f.level];
                  return (
                    <li
                      key={i}
                      className="flex gap-2 rounded-lg border border-ink-700 px-3 py-1.5 text-[11px]"
                    >
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${m.dot}`} />
                      <span className="text-haze-300">
                        <span className="font-semibold text-haze-200">
                          {f.layerName} · {f.label}
                        </span>
                        {" — "}
                        {f.note ?? m.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-haze-400">
                <span className="capitalize">{progress.phase}…</span>
                <span>
                  {progress.frame}/{progress.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${(progress.frame / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          {cssPreview !== null && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-haze-400">
                  CSS
                </h3>
                <button
                  onClick={() => {
                    const text = cssPreview;
                    if (text) navigator.clipboard?.writeText(text);
                  }}
                  className="text-[11px] text-brand-300 hover:underline"
                >
                  Copy
                </button>
              </div>
              <textarea
                readOnly
                value={cssPreview}
                className="h-40 w-full rounded-lg border border-ink-700 bg-ink-900 p-2 font-mono text-[10px] text-haze-300"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-ink-700 px-5 py-3">
          <button
            onClick={() => downloadSceneJson(scene)}
            className="text-xs text-haze-400 transition hover:text-white"
          >
            Save .loft.json
          </button>
          <div className="flex-1" />
          <button
            onClick={runExport}
            disabled={disabled}
            className="flex items-center gap-2 rounded bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-400 disabled:cursor-default disabled:opacity-50"
          >
            {busy && (
              <span className="lm-spin inline-block h-3 w-3 rounded-full border-2 border-white/40 border-t-white" />
            )}
            {busy ? "Exporting…" : `Export ${TARGET_LABEL[target]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
