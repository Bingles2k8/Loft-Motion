"use client";

/**
 * Loft Motion — Agent bridge.
 *
 * Two jobs, both about letting an LLM *drive* the live engine:
 *
 *  1. **URL ingestion + auto-export.** If the page is opened with a `spec=` or
 *     `project=` payload, load it; if `export=` is present, render that format
 *     and download it. This is how an automated agent turns a spec into a video
 *     file end-to-end (the encoder is browser-only, so it must run here).
 *
 *  2. **`window.LoftAgent`.** A small programmatic surface so an agent driving a
 *     real browser (computer-use / Playwright) can build and export animations
 *     by calling functions instead of clicking.
 *
 * Renders only a tiny status toast while an auto-request runs; otherwise nothing.
 */
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import {
  readUrlRequest,
  runExport,
  sceneFromSpecData,
  sceneFromProjectData,
  type ExportFormat,
} from "@/lib/agent/ingest";
import {
  LOFT_AGENT_GUIDE,
  specJsonSchema,
  exampleSpec,
  type AnimationSpec,
} from "@/lib/agent";

/** The programmatic API exposed on `window.LoftAgent`. */
export interface LoftAgentApi {
  version: string;
  /** The full LLM authoring guide (also a system prompt). */
  readonly guide: string;
  /** JSON Schema for an AnimationSpec. */
  schema(): Record<string, unknown>;
  /** A representative example spec to adapt. */
  example(): AnimationSpec;
  /** Compile a spec (object or JSON string) and load it into the editor. */
  load(spec: AnimationSpec | string): { ok: boolean; notes?: string[]; error?: string };
  /** Load a .loft.json project (object or JSON string) into the editor. */
  loadProject(project: unknown): { ok: boolean; error?: string };
  /** The current scene document. */
  getScene(): unknown;
  /** Render/serialise the current scene and download it. Resolves to a summary. */
  export(format?: ExportFormat, opts?: { scale?: number }): Promise<string>;
  /** Convenience: render an MP4 (or another video format) and download it. */
  exportVideo(format?: "mp4" | "gif" | "webm"): Promise<string>;
  /** Convenience: download the current scene as a .loft.json project. */
  saveProject(): Promise<string>;
}

declare global {
  interface Window {
    LoftAgent?: LoftAgentApi;
  }
}

interface Toast {
  kind: "info" | "error" | "done";
  text: string;
}

export function AgentBridge() {
  const [toast, setToast] = useState<Toast | null>(null);

  // Expose the programmatic API.
  useEffect(() => {
    const api: LoftAgentApi = {
      version: "0.1.0",
      get guide() {
        return LOFT_AGENT_GUIDE;
      },
      schema: () => specJsonSchema(),
      example: () => exampleSpec(),
      load: (spec) => {
        try {
          const data = typeof spec === "string" ? JSON.parse(spec) : spec;
          const { scene, notes } = sceneFromSpecData(data);
          useStore.getState().loadScene(scene);
          return { ok: true, notes };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      },
      loadProject: (project) => {
        try {
          const { scene } = sceneFromProjectData(project);
          useStore.getState().loadScene(scene);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      },
      getScene: () => useStore.getState().scene,
      export: (format = "mp4", opts) => runExport(useStore.getState().scene, format, opts),
      exportVideo: (format = "mp4") => runExport(useStore.getState().scene, format),
      saveProject: () => runExport(useStore.getState().scene, "project"),
    };
    window.LoftAgent = api;
    return () => {
      if (window.LoftAgent === api) delete window.LoftAgent;
    };
  }, []);

  // Handle a URL request (spec/project + optional auto-export) once on load.
  useEffect(() => {
    const req = readUrlRequest(window.location.href);
    if (!req) return;
    let cancelled = false;

    (async () => {
      if (req.error) {
        setToast({ kind: "error", text: req.error });
        return;
      }
      if (req.result) {
        useStore.getState().loadScene(req.result.scene);
        if (req.autoplay) useStore.getState().play();
        setToast({
          kind: "info",
          text:
            req.result.source === "spec"
              ? "Loaded animation from spec."
              : "Loaded project.",
        });
      }
      if (req.exportFormat && req.download) {
        const scene = useStore.getState().scene;
        setToast({ kind: "info", text: `Rendering ${req.exportFormat.toUpperCase()}…` });
        try {
          const summary = await runExport(scene, req.exportFormat, {
            onProgress: (p) =>
              !cancelled &&
              setToast({
                kind: "info",
                text: `${cap(p.phase)} ${p.total ? `${p.frame}/${p.total}` : ""}`.trim(),
              }),
          });
          if (!cancelled) setToast({ kind: "done", text: summary });
        } catch (e) {
          if (!cancelled)
            setToast({ kind: "error", text: e instanceof Error ? e.message : String(e) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-dismiss success/info toasts.
  useEffect(() => {
    if (!toast || toast.kind === "error") return;
    const t = setTimeout(() => setToast(null), toast.kind === "done" ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const color =
    toast.kind === "error"
      ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
      : toast.kind === "done"
        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
        : "border-brand-500/40 bg-brand-500/15 text-brand-100";

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2">
      <div className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur ${color}`}>
        {toast.kind === "info" && (
          <span className="lm-spin inline-block h-3 w-3 rounded-full border-2 border-current/40 border-t-current" />
        )}
        <span>{toast.text}</span>
        {toast.kind === "error" && (
          <button
            onClick={() => setToast(null)}
            className="ml-1 text-current/70 transition hover:text-current"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
