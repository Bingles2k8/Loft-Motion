/**
 * Loft Motion — Agent ingestion & headless-ish export bridge (browser side).
 *
 * Loft Motion's renderer and video encoders are intentionally browser-based
 * (PixiJS + WebCodecs), so a *video* is produced inside the engine, not in Node.
 * This module is how an LLM-driven pipeline reaches that engine:
 *
 *   • parse a spec or project out of the page URL / localStorage, and
 *   • run any export and download the file —
 *
 * which together let an automated agent open the app with a spec, render, and
 * walk away with an MP4. The very same `runExport` powers the in-app Agent panel.
 */
import type { SceneDocument } from "@/lib/scene/schema";
import { compileSpec } from "@/lib/agent/compile";
import { safeParseSpec } from "@/lib/agent/spec";
import { importSceneJson, downloadFile, downloadSceneJson } from "@/lib/io/file";

export type ExportFormat =
  | "mp4"
  | "gif"
  | "webm"
  | "sprite"
  | "lottie"
  | "css"
  | "react"
  | "project";

export interface IngestResult {
  scene: SceneDocument;
  /** How the scene was obtained, for messaging. */
  source: "spec" | "project";
  notes: string[];
}

/** Decode a value that may be base64, URI-encoded, or raw JSON, into an object. */
export function decodeMaybeEncodedJson(raw: string): unknown {
  const tryParse = (s: string): unknown | undefined => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  // 1) raw JSON
  let v = tryParse(raw);
  if (v !== undefined) return v;
  // 2) URI-decoded JSON
  try {
    v = tryParse(decodeURIComponent(raw));
    if (v !== undefined) return v;
  } catch {
    /* not URI-encoded */
  }
  // 3) base64 (url-safe tolerated) → JSON
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? atob(b64) : "";
    v = tryParse(json);
    if (v !== undefined) return v;
  } catch {
    /* not base64 */
  }
  throw new Error("Could not decode the value as JSON, URI-encoded JSON, or base64 JSON.");
}

/** Build a scene from a decoded spec object (throws on invalid spec). */
export function sceneFromSpecData(data: unknown): IngestResult {
  const parsed = safeParseSpec(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`Invalid AnimationSpec: ${first?.path.join(".") || "(root)"} — ${first?.message}`);
  }
  const { scene, notes } = compileSpec(parsed.data);
  return { scene, source: "spec", notes };
}

/** Build a scene from a decoded project document (throws on invalid project). */
export function sceneFromProjectData(data: unknown): IngestResult {
  const result = importSceneJson(typeof data === "string" ? data : JSON.stringify(data));
  if (!result.ok || !result.scene) throw new Error(result.error ?? "Invalid project.");
  return { scene: result.scene, source: "project", notes: [] };
}

export interface UrlRequest {
  result?: IngestResult;
  exportFormat?: ExportFormat;
  /** Whether to download the export (vs. just open it in the editor). */
  download: boolean;
  /** Whether to start playback after loading. */
  autoplay: boolean;
  error?: string;
}

/**
 * Read an agent request out of the current URL. Recognised params (search OR
 * hash — hash keeps big payloads out of server logs):
 *   spec=<json|uri|base64>      compile a spec into a scene
 *   project=<json|uri|base64>   load a .loft.json project
 *   export=mp4|gif|webm|lottie|css|sprite|react|project
 *   download=1                  auto-download the export
 *   autoplay=1                  start playback after load
 */
export function readUrlRequest(href: string): UrlRequest | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const get = (k: string) => url.searchParams.get(k) ?? hashParams.get(k);

  const specRaw = get("spec");
  const projectRaw = get("project");
  const exportRaw = get("export") as ExportFormat | null;
  const download = ["1", "true", "yes"].includes((get("download") ?? "").toLowerCase());
  const autoplay = ["1", "true", "yes"].includes((get("autoplay") ?? "").toLowerCase());

  if (!specRaw && !projectRaw && !exportRaw) return null;

  const req: UrlRequest = { download, autoplay };
  if (exportRaw) req.exportFormat = exportRaw;

  try {
    if (specRaw) req.result = sceneFromSpecData(decodeMaybeEncodedJson(specRaw));
    else if (projectRaw) req.result = sceneFromProjectData(decodeMaybeEncodedJson(projectRaw));
  } catch (e) {
    req.error = e instanceof Error ? e.message : String(e);
  }
  return req;
}

function safeName(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "scene";
}

export interface ExportProgress {
  phase: string;
  frame: number;
  total: number;
}

/**
 * Render/serialise a scene to the requested format and trigger a download.
 * Returns a short human summary. Heavy exporters are imported lazily so this
 * module stays cheap until an export is actually run.
 */
export async function runExport(
  scene: SceneDocument,
  format: ExportFormat,
  opts: { scale?: number; onProgress?: (p: ExportProgress) => void } = {},
): Promise<string> {
  const name = safeName(scene.name);
  const scale = opts.scale ?? 0.5;
  const onProgress = opts.onProgress;

  switch (format) {
    case "project":
      downloadSceneJson(scene);
      return `Saved ${name}.loft.json`;
    case "mp4": {
      const { exportMp4 } = await import("@/lib/export/mp4");
      const blob = await exportMp4(scene, onProgress);
      downloadFile(`${name}.mp4`, blob, "video/mp4");
      return `Rendered ${name}.mp4`;
    }
    case "gif": {
      const { exportGif } = await import("@/lib/export/gif");
      const blob = await exportGif(scene, { scale, onProgress });
      downloadFile(`${name}.gif`, blob, "image/gif");
      return `Rendered ${name}.gif`;
    }
    case "webm": {
      const { exportWebm } = await import("@/lib/export/webm");
      const blob = await exportWebm(scene, { scale, onProgress });
      downloadFile(`${name}.webm`, blob, "video/webm");
      return `Rendered ${name}.webm`;
    }
    case "sprite": {
      const { exportSpriteSheet } = await import("@/lib/export/sprite");
      const r = await exportSpriteSheet(scene, { scale, onProgress });
      downloadFile(`${name}.sprite.png`, r.png, "image/png");
      downloadFile(`${name}.sprite.json`, r.json, "application/json");
      return `Rendered ${name} sprite sheet`;
    }
    case "lottie": {
      const { exportLottie } = await import("@/lib/export/lottie");
      const { json } = exportLottie(scene);
      downloadFile(`${name}.lottie.json`, JSON.stringify(json));
      return `Exported ${name}.lottie.json`;
    }
    case "css": {
      const { exportCss } = await import("@/lib/export/css");
      const { document } = exportCss(scene);
      downloadFile(`${name}.html`, document, "text/html");
      return `Exported ${name}.html`;
    }
    case "react": {
      const { reactSnippet } = await import("@/lib/export/snippets");
      downloadFile(`${name}.jsx`, reactSnippet(scene), "text/plain");
      return `Exported ${name}.jsx`;
    }
  }
}
