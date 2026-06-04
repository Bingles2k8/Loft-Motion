/**
 * Loft Motion — transparent WebM export (VP9 alpha).
 *
 * MP4/H.264 can't carry alpha, so transparent video needs WebM/VP9. We render
 * frames to a canvas, capture a MediaStream and drive it frame-by-frame through
 * MediaRecorder. Frame-accurate via canvas.captureStream(0) + requestFrame().
 */
import { grabFrames, toImageData, type GrabProgress } from "@/lib/export/frames";
import type { SceneDocument } from "@/lib/scene/schema";

export class WebmUnsupported extends Error {
  constructor() {
    super(
      "Transparent WebM export needs MediaRecorder with VP9 alpha, which this " +
        "browser doesn't support. Try Chrome or Edge.",
    );
    this.name = "WebmUnsupported";
  }
}

export function canExportWebm(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  return (
    MediaRecorder.isTypeSupported?.("video/webm;codecs=vp9") ||
    MediaRecorder.isTypeSupported?.("video/webm")
  );
}

export async function exportWebm(
  scene: SceneDocument,
  opts: { scale?: number; fps?: number; onProgress?: (p: GrabProgress) => void } = {},
): Promise<Blob> {
  if (!canExportWebm()) throw new WebmUnsupported();
  const fps = opts.fps ?? scene.composition.fps;
  const { width, height, frames } = await grabFrames(scene, {
    scale: opts.scale ?? 1,
    fps,
    onProgress: opts.onProgress,
  });

  // A regular (non-offscreen) canvas is needed for captureStream in workers/main.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = (canvas as any).captureStream(0) as MediaStream;
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void;
  };
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();
  const frameMs = 1000 / fps;
  const total = frames.length;
  for (let i = 0; i < total; i++) {
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(toImageData(frames[i], width, height), 0, 0);
    track.requestFrame?.();
    opts.onProgress?.({ phase: "encoding", frame: i + 1, total });
    await new Promise((r) => setTimeout(r, frameMs));
  }
  recorder.stop();
  opts.onProgress?.({ phase: "done", frame: total, total });
  return done;
}
