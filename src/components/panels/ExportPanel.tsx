"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import { analyzeScene } from "@/lib/capability/engine";
import { type ExportTarget } from "@/lib/scene/schema";
import { CompatFormatIcon, LEVEL_META, TARGET_LABEL } from "@/components/ui/compat";
import { canExportMp4, exportMp4 } from "@/lib/export/mp4";
import { exportLottie } from "@/lib/export/lottie";
import { exportCss } from "@/lib/export/css";
import { exportGif } from "@/lib/export/gif";
import { canExportWebm, exportWebm } from "@/lib/export/webm";
import { exportSpriteSheet } from "@/lib/export/sprite";
import { lottieEmbedSnippet, reactSnippet } from "@/lib/export/snippets";
import { downloadFile, downloadSceneJson } from "@/lib/io/file";

/* The full format list, grouped. */
type Fmt =
  | "mp4"
  | "gif"
  | "webm"
  | "sprite"
  | "lottie"
  | "css"
  | "react";

interface FmtDef {
  id: Fmt;
  label: string;
  group: "Video" | "Vector & Code";
  /** Which capability target governs the fidelity report (if any). */
  compat?: ExportTarget;
  desc: string;
}

const FORMATS: FmtDef[] = [
  { id: "mp4", label: "MP4", group: "Video", compat: "mp4", desc: "Hardware-encoded H.264. Everything you see survives — effects included. No transparency." },
  { id: "gif", label: "GIF", group: "Video", compat: "mp4", desc: "Animated GIF, the universal casual format. Downscaled & 256-colour for size." },
  { id: "webm", label: "WebM (alpha)", group: "Video", compat: "mp4", desc: "Transparent video (VP9 alpha) for overlays & stickers. Chrome/Edge only." },
  { id: "sprite", label: "Sprite sheet", group: "Video", compat: "mp4", desc: "A tiled PNG + JSON frame map for CSS steps() or game engines. Keeps transparency." },
  { id: "lottie", label: "Lottie", group: "Vector & Code", compat: "lottie", desc: "Bodymovin JSON for web & app players. Vector-clean & tiny — shader effects can't come along." },
  { id: "css", label: "CSS", group: "Vector & Code", compat: "css", desc: "Standalone @keyframes + HTML. GPU-safe, with a prefers-reduced-motion fallback baked in." },
  { id: "react", label: "React", group: "Vector & Code", compat: "css", desc: "A React component wrapping the CSS keyframes — framework-native handoff." },
];

function safeName(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "scene";
}

interface Progress {
  phase: string;
  frame: number;
  total: number;
}

export function ExportPanel() {
  const show = useStore((s) => s.showExport);
  const setShow = useStore((s) => s.setShowExport);
  const scene = useStore((s) => s.scene);

  const [fmt, setFmt] = useState<Fmt>("mp4");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [mp4Ok, setMp4Ok] = useState<boolean | null>(null);
  const [codePreview, setCodePreview] = useState<{ title: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // GIF/WebM/sprite options
  const [scale, setScale] = useState(0.5);

  const report = useMemo(() => analyzeScene(scene), [scene]);

  useEffect(() => {
    if (show) canExportMp4(scene).then(setMp4Ok);
  }, [show, scene]);
  // Reset transient state when switching format.
  useEffect(() => {
    setCodePreview(null);
    setError(null);
  }, [fmt]);

  if (!show) return null;

  const def = FORMATS.find((f) => f.id === fmt)!;
  const compatTarget = def.compat;
  const tr = compatTarget ? report[compatTarget] : null;
  const webmOk = canExportWebm();

  const run = async () => {
    setError(null);
    setCodePreview(null);
    setBusy(true);
    const name = safeName(scene.name);
    const onP = (p: { phase: string; frame: number; total: number }) => setProgress(p);
    try {
      switch (fmt) {
        case "mp4": {
          setProgress({ phase: "preparing", frame: 0, total: 1 });
          const blob = await exportMp4(scene, onP);
          downloadFile(`${name}.mp4`, blob, "video/mp4");
          break;
        }
        case "gif": {
          const blob = await exportGif(scene, { scale, onProgress: onP });
          downloadFile(`${name}.gif`, blob, "image/gif");
          break;
        }
        case "webm": {
          const blob = await exportWebm(scene, { scale, onProgress: onP });
          downloadFile(`${name}.webm`, blob, "video/webm");
          break;
        }
        case "sprite": {
          const r = await exportSpriteSheet(scene, { scale, onProgress: onP });
          downloadFile(`${name}.sprite.png`, r.png, "image/png");
          downloadFile(`${name}.sprite.json`, r.json, "application/json");
          break;
        }
        case "lottie": {
          const { json } = exportLottie(scene);
          downloadFile(`${name}.lottie.json`, JSON.stringify(json));
          setCodePreview({ title: "Web embed", code: lottieEmbedSnippet(scene) });
          break;
        }
        case "css": {
          const { document, css } = exportCss(scene);
          downloadFile(`${name}.html`, document, "text/html");
          setCodePreview({ title: "CSS", code: css });
          break;
        }
        case "react": {
          const code = reactSnippet(scene);
          downloadFile(`${name}.jsx`, code, "text/plain");
          setCodePreview({ title: "React component", code });
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const isRaster = fmt === "gif" || fmt === "webm" || fmt === "sprite";
  const blocked =
    busy ||
    (fmt === "mp4" && mp4Ok === false) ||
    (fmt === "webm" && !webmOk);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={() => !busy && setShow(false)}
    >
      <div
        className="flex h-[80vh] max-h-[640px] w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: format list */}
        <div className="flex w-48 shrink-0 flex-col border-r border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-4 py-3.5 text-sm font-bold text-haze-200">
            Export
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {(["Video", "Vector & Code"] as const).map((group) => (
              <div key={group} className="mb-2">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-haze-500">
                  {group}
                </div>
                {FORMATS.filter((f) => f.group === group).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFmt(f.id)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition ${
                      f.id === fmt
                        ? "bg-ink-700 text-haze-200"
                        : "text-haze-400 hover:bg-ink-800"
                    }`}
                  >
                    {f.compat && (
                      <CompatFormatIcon target={f.compat} level={report[f.compat].level} size={13} />
                    )}
                    {f.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button
            onClick={() => downloadSceneJson(scene)}
            className="border-t border-ink-700 px-4 py-2.5 text-left text-[11px] text-haze-400 transition hover:text-haze-200"
          >
            Save project (.loft.json)
          </button>
        </div>

        {/* Right: options + report */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-haze-200">{def.label}</h2>
            <button
              onClick={() => !busy && setShow(false)}
              className="text-haze-400 transition hover:text-haze-200"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-xs leading-relaxed text-haze-300">{def.desc}</p>

            {fmt === "mp4" && mp4Ok === false && (
              <Warn>This browser doesn&apos;t support the WebCodecs encoder. Try Chrome, Edge, or Firefox 130+ — or export GIF / Lottie / CSS.</Warn>
            )}
            {fmt === "webm" && !webmOk && (
              <Warn>Transparent WebM needs MediaRecorder VP9 alpha (Chrome / Edge).</Warn>
            )}

            {/* Raster resolution control */}
            {isRaster && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[11px] text-haze-400">Resolution</span>
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.25}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="lm-slider flex-1"
                />
                <span className="w-24 text-right text-[11px] tabular-nums text-haze-300">
                  {Math.round(scene.composition.width * scale)}×
                  {Math.round(scene.composition.height * scale)}
                </span>
              </div>
            )}

            {/* Fidelity report */}
            {tr && (
              <div className="mt-4">
                <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-haze-400">
                  What survives
                </h3>
                {tr.issues.length === 0 ? (
                  <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-200">
                    Everything in this scene exports cleanly to {def.label}. ✨
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {tr.issues.map((f, i) => {
                      const m = LEVEL_META[f.level];
                      return (
                        <li key={i} className="flex gap-2 rounded-lg border border-ink-700 px-3 py-1.5 text-[11px]">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${m.dot}`} />
                          <span className="text-haze-300">
                            <span className="font-semibold text-haze-200">{f.layerName} · {f.label}</span>
                            {" — "}
                            {f.note ?? m.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {progress && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] text-haze-400">
                  <span className="capitalize">{progress.phase}…</span>
                  <span>{progress.frame}/{progress.total}</span>
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

            {codePreview && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-haze-400">
                    {codePreview.title}
                  </h3>
                  <button
                    onClick={() => navigator.clipboard?.writeText(codePreview.code)}
                    className="text-[11px] text-brand-300 hover:underline"
                  >
                    Copy to clipboard
                  </button>
                </div>
                <textarea
                  readOnly
                  value={codePreview.code}
                  className="h-44 w-full rounded-lg border border-ink-700 bg-ink-900 p-2 font-mono text-[10px] text-haze-300"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-ink-700 px-5 py-3">
            <div className="flex-1" />
            <button
              onClick={run}
              disabled={blocked}
              className="flex items-center gap-2 rounded bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-400 disabled:cursor-default disabled:opacity-50"
            >
              {busy && (
                <span className="lm-spin inline-block h-3 w-3 rounded-full border-2 border-white/40 border-t-white" />
              )}
              {busy ? "Exporting…" : `Export ${def.label}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
      {children}
    </div>
  );
}
