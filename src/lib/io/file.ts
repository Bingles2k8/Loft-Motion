/**
 * Loft Motion — file I/O helpers (skeleton persistence).
 *
 * No backend yet: projects live in memory and round-trip to disk as the scene
 * document JSON. Import is validated through the Zod schema before it can reach
 * the renderer, so a malformed file fails loudly, not silently.
 */
import { safeParseScene, type SceneDocument } from "@/lib/scene/schema";

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
  return { ok: true, scene: result.data };
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
