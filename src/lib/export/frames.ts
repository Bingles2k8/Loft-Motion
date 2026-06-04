/**
 * Loft Motion — shared frame grabbing for raster exports (GIF, WebM, sprites).
 *
 * Renders the scene to an OffscreenCanvas frame-by-frame via the same
 * SceneRenderer the preview uses, then reads back RGBA pixels for each frame so
 * downstream encoders (gifenc, sprite sheet) can consume them. Fully in-browser.
 */
import { SceneRenderer } from "@/lib/render/renderer";
import type { SceneDocument } from "@/lib/scene/schema";

export interface FrameSet {
  width: number;
  height: number;
  fps: number;
  /** One Uint8ClampedArray (RGBA) per frame. */
  frames: Uint8ClampedArray[];
}

/** Build an ImageData from an RGBA buffer (copies into a fresh ArrayBuffer so
 *  the typing is unambiguous regardless of the source buffer kind). */
export function toImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ImageData {
  const copy = new Uint8ClampedArray(data.length);
  copy.set(data);
  return new ImageData(copy, width, height);
}

export interface GrabProgress {
  phase: "rendering" | "encoding" | "done";
  frame: number;
  total: number;
}

/**
 * Render every frame and return raw RGBA buffers. `scale` downsamples (e.g. GIF
 * at 0.5) to keep size/time reasonable. `maxFrames` caps very long comps.
 */
export async function grabFrames(
  scene: SceneDocument,
  opts: { scale?: number; fps?: number; onProgress?: (p: GrabProgress) => void } = {},
): Promise<FrameSet> {
  const scale = opts.scale ?? 1;
  const fps = opts.fps ?? scene.composition.fps;
  const w = Math.max(1, Math.round(scene.composition.width * scale));
  const h = Math.max(1, Math.round(scene.composition.height * scale));
  const total = Math.max(1, Math.round(scene.composition.duration * fps));

  // Render at full res, then downscale into a 2D canvas for readback.
  const renderCanvas = new OffscreenCanvas(
    scene.composition.width,
    scene.composition.height,
  );
  const renderer = new SceneRenderer(scene, "high");
  await renderer.init(renderCanvas);

  const readCanvas = new OffscreenCanvas(w, h);
  const ctx = readCanvas.getContext("2d", { willReadFrequently: true })!;

  const frames: Uint8ClampedArray[] = [];
  try {
    for (let i = 0; i < total; i++) {
      renderer.renderAt(i / fps);
      ctx.clearRect(0, 0, w, h);
      // The Pixi canvas is the renderer's source; draw it scaled.
      ctx.drawImage(renderCanvas as unknown as CanvasImageSource, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      frames.push(img.data);
      opts.onProgress?.({ phase: "rendering", frame: i + 1, total });
    }
  } finally {
    renderer.destroy();
  }

  return { width: w, height: h, fps, frames };
}
