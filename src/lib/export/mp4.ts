/**
 * Loft Motion — MP4 exporter.
 *
 * Renders every frame through the SAME SceneRenderer the live preview uses
 * (preview-matches-output, §3.3/§7), into an OffscreenCanvas, then hands frames
 * to mediabunny's CanvasSource which drives a hardware WebCodecs VideoEncoder
 * and muxes to MP4 — fully client-side, nothing leaves the device.
 *
 * The heavy encode/mux runs off the main thread inside WebCodecs. (Moving the
 * per-frame Pixi draw into a Web Worker with a transferred OffscreenCanvas is a
 * Phase-2 optimisation; the encoder is already async + hardware-accelerated.)
 */
import { SceneRenderer } from "@/lib/render/renderer";
import type { SceneDocument } from "@/lib/scene/schema";

export interface Mp4Progress {
  phase: "preparing" | "rendering" | "finalizing" | "done";
  frame: number;
  total: number;
}

export class Mp4Unsupported extends Error {
  constructor() {
    super(
      "MP4 export needs the WebCodecs video encoder, which this browser doesn't " +
        "support yet. Try Chrome, Edge or Firefox 130+.",
    );
    this.name = "Mp4Unsupported";
  }
}

/** Is client-side MP4 encoding available in this browser? */
export async function canExportMp4(scene?: SceneDocument): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (typeof VideoEncoder === "undefined") return false;
  try {
    const { canEncodeVideo } = await import("mediabunny");
    return await canEncodeVideo("avc", {
      width: scene?.composition.width ?? 1920,
      height: scene?.composition.height ?? 1080,
    });
  } catch {
    return false;
  }
}

/** Encode a scene to an MP4 Blob, reporting progress along the way. */
export async function exportMp4(
  scene: SceneDocument,
  onProgress?: (p: Mp4Progress) => void,
): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") throw new Mp4Unsupported();

  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } =
    await import("mediabunny");

  const { width, height, fps, duration } = scene.composition;
  const total = Math.max(1, Math.round(duration * fps));

  onProgress?.({ phase: "preparing", frame: 0, total });

  const canvas = new OffscreenCanvas(width, height);
  const renderer = new SceneRenderer(scene);
  await renderer.init(canvas);

  const source = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: QUALITY_HIGH,
  });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  try {
    for (let i = 0; i < total; i++) {
      const t = i / fps;
      renderer.renderAt(t);
      // Units are SECONDS; await each add for encoder backpressure.
      await source.add(t, 1 / fps);
      onProgress?.({ phase: "rendering", frame: i + 1, total });
    }
    source.close();
    onProgress?.({ phase: "finalizing", frame: total, total });
    await output.finalize();
  } finally {
    renderer.destroy();
  }

  const buffer = target.buffer;
  if (!buffer) throw new Error("MP4 export produced no data.");
  onProgress?.({ phase: "done", frame: total, total });
  return new Blob([buffer], { type: "video/mp4" });
}
