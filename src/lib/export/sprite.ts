/**
 * Loft Motion — sprite sheet export.
 *
 * Tiles every frame into a single PNG grid + emits JSON tile metadata (TexturePacker-
 * style frame positions) — great for web/game devs animating via CSS steps() or a
 * sprite engine. Transparent background is preserved.
 */
import { grabFrames, toImageData, type GrabProgress } from "@/lib/export/frames";
import type { SceneDocument } from "@/lib/scene/schema";

export interface SpriteResult {
  png: Blob;
  json: string;
  cols: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export async function exportSpriteSheet(
  scene: SceneDocument,
  opts: { scale?: number; fps?: number; maxCols?: number; onProgress?: (p: GrabProgress) => void } = {},
): Promise<SpriteResult> {
  const { width, height, frames, fps } = await grabFrames(scene, {
    scale: opts.scale ?? 0.5,
    fps: opts.fps,
    onProgress: opts.onProgress,
  });
  const count = frames.length;
  const cols = Math.min(opts.maxCols ?? Math.ceil(Math.sqrt(count)), count);
  const rows = Math.ceil(count / cols);

  const sheet = new OffscreenCanvas(cols * width, rows * height);
  const ctx = sheet.getContext("2d")!;
  const tmp = new OffscreenCanvas(width, height);
  const tctx = tmp.getContext("2d")!;

  const tiles: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    tctx.putImageData(toImageData(frames[i], width, height), 0, 0);
    ctx.drawImage(tmp, col * width, row * height);
    tiles[`frame_${String(i).padStart(4, "0")}`] = {
      frame: { x: col * width, y: row * height, w: width, h: height },
    };
    opts.onProgress?.({ phase: "encoding", frame: i + 1, total: count });
  }

  const png = await sheet.convertToBlob({ type: "image/png" });
  const json = JSON.stringify(
    {
      frames: tiles,
      meta: {
        app: "Loft Motion",
        size: { w: cols * width, h: rows * height },
        frameSize: { w: width, h: height },
        cols,
        rows,
        frameCount: count,
        fps,
      },
    },
    null,
    2,
  );

  opts.onProgress?.({ phase: "done", frame: count, total: count });
  return { png, json, cols, rows, frameWidth: width, frameHeight: height, frameCount: count };
}
