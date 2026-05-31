/**
 * Loft Motion — file I/O helpers (skeleton persistence).
 *
 * No backend yet: projects live in memory and round-trip to disk as the scene
 * document JSON. Import is validated through the Zod schema before it can reach
 * the renderer, so a malformed file fails loudly, not silently.
 */
import { safeParseScene, SCENE_VERSION, type SceneDocument } from "@/lib/scene/schema";

/** Trigger a browser download of a string/blob. */
export function downloadFile(
  filename: string,
  content: string | Blob,
  mime = "application/json",
) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSceneJson(scene: SceneDocument): string {
  return JSON.stringify(scene, null, 2);
}

export function downloadSceneJson(scene: SceneDocument) {
  const safeName = scene.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  downloadFile(`${safeName || "scene"}.loft.json`, exportSceneJson(scene));
}

export interface ImportResult {
  ok: boolean;
  scene?: SceneDocument;
  error?: string;
}

/** Parse + validate an imported JSON string. */
export function importSceneJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const result = safeParseScene(data);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: `Not a valid Loft Motion scene: ${first?.path.join(".")} ${first?.message}`,
    };
  }
  // Migrate older documents forward (assets added in v2).
  const scene: SceneDocument = {
    ...result.data,
    version: SCENE_VERSION,
    assets: result.data.assets ?? [],
  };
  return { ok: true, scene };
}

/** Read a File (from an <input type=file>) as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Read an image File as a data URL plus its natural dimensions. */
export function readImageFile(
  file: File,
): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () =>
        resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = src;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type AssetKind = "image" | "video" | "audio" | "unsupported";

export function classifyFile(file: File): AssetKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "unsupported";
}

export interface ReadAssetResult {
  kind: AssetKind;
  name: string;
  src: string;
  size: number;
  width: number;
  height: number;
  duration?: number;
}

/**
 * Read ANY supported media file fully in-browser (never uploaded): returns a
 * data URL plus probed dimensions/duration. Used by the Project panel's
 * drag-and-drop import.
 */
export async function readAssetFile(file: File): Promise<ReadAssetResult> {
  const kind = classifyFile(file);
  const src = await readDataUrl(file);
  const base: ReadAssetResult = {
    kind,
    name: file.name,
    src,
    size: file.size,
    width: 0,
    height: 0,
  };

  if (kind === "image") {
    const dims = await probeImage(src);
    return { ...base, ...dims };
  }
  if (kind === "video") {
    const meta = await probeVideo(src);
    return { ...base, ...meta };
  }
  if (kind === "audio") {
    const dur = await probeAudio(src);
    return { ...base, duration: dur };
  }
  return base;
}

function probeImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

function probeVideo(
  src: string,
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      resolve({
        width: v.videoWidth,
        height: v.videoHeight,
        duration: v.duration || 0,
      });
    v.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
    v.src = src;
  });
}

function probeAudio(src: string): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(a.duration || 0);
    a.onerror = () => resolve(0);
    a.src = src;
  });
}

/** Human-readable byte size, e.g. "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
