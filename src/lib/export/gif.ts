/**
 * Loft Motion — animated GIF export (fully client-side via gifenc).
 *
 * Renders frames through the shared grabber, quantises each to a 256-colour
 * palette and writes an animated GIF. GIF is the most-requested casual format
 * for social/marketing. Default downscale keeps size sane.
 */
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { grabFrames, type GrabProgress } from "@/lib/export/frames";
import type { SceneDocument } from "@/lib/scene/schema";

export interface GifOptions {
  /** 0..1 resolution scale (default 0.5 for reasonable file size). */
  scale?: number;
  /** Cap the GIF frame rate (GIFs above ~25fps gain little). */
  fps?: number;
  onProgress?: (p: GrabProgress) => void;
}

export async function exportGif(
  scene: SceneDocument,
  opts: GifOptions = {},
): Promise<Blob> {
  const fps = Math.min(opts.fps ?? 25, scene.composition.fps);
  const { width, height, frames } = await grabFrames(scene, {
    scale: opts.scale ?? 0.5,
    fps,
    onProgress: opts.onProgress,
  });

  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  const total = frames.length;

  for (let i = 0; i < total; i++) {
    const data = frames[i];
    // Quantise this frame to <=256 colours and map to indices.
    const palette = quantize(data, 256, { format: "rgba4444" });
    const index = applyPalette(data, palette, "rgba4444");
    gif.writeFrame(index, width, height, { palette, delay });
    opts.onProgress?.({ phase: "encoding", frame: i + 1, total });
    // Yield occasionally so the UI stays responsive.
    if (i % 8 === 0) await new Promise((r) => setTimeout(r));
  }
  gif.finish();
  opts.onProgress?.({ phase: "done", frame: total, total });
  const view = gif.bytesView();
  const bytes = new Uint8Array(view.length);
  bytes.set(view);
  return new Blob([bytes], { type: "image/gif" });
}
