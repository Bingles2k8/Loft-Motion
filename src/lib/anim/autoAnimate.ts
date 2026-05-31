/**
 * Loft Motion — Auto-Animate (Cavalry-style one-click transitions).
 *
 * Writes transform keyframes onto a layer for a polished in / out move, using a
 * "magic easing" (a smooth Settle-like curve) by default. Built entirely on the
 * existing keyframe engine — no new runtime.
 */
import { uid } from "@/lib/scene/factory";
import type { Composition, Keyframe, Layer } from "@/lib/scene/schema";

export const AUTO_ANIMATE_PRESETS = [
  "fade",
  "pop",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "zoom",
  "spin-in",
] as const;
export type AutoAnimatePreset = (typeof AUTO_ANIMATE_PRESETS)[number];

export const AUTO_ANIMATE_LABELS: Record<AutoAnimatePreset, string> = {
  fade: "Fade In",
  pop: "Pop In",
  "slide-up": "Slide Up",
  "slide-down": "Slide Down",
  "slide-left": "Slide Left",
  "slide-right": "Slide Right",
  zoom: "Zoom In",
  "spin-in": "Spin In",
};

/** Magic easing — a smooth, slightly-overshooting settle on the way in. */
const EASE_IN = "settle";
const EASE_OUT = "easeIn";

function kf(time: number, value: number, easing: string): Keyframe {
  return { id: uid("kf"), time, value, easing };
}

/**
 * Apply an entrance (and optional matching exit) to a layer, mutating its
 * transform channels in place. `dir` chooses in / out / both.
 */
export function applyAutoAnimate(
  layer: Layer,
  preset: AutoAnimatePreset,
  comp: Composition,
  opts: { duration?: number; mode?: "in" | "out" | "both" } = {},
) {
  const dur = opts.duration ?? 0.8;
  const mode = opts.mode ?? "in";
  const t = layer.transform;
  const x0 = t.x.value;
  const y0 = t.y.value;

  const inEnd = layer.timing.start + dur;
  const outStart = Math.max(inEnd, layer.timing.end - dur);

  // Offsets for the "off-screen / hidden" state relative to resting transform.
  const off = (() => {
    switch (preset) {
      case "slide-up":
        return { dx: 0, dy: comp.height * 0.4, scale: 100, rot: 0, op: 0 };
      case "slide-down":
        return { dx: 0, dy: -comp.height * 0.4, scale: 100, rot: 0, op: 0 };
      case "slide-left":
        return { dx: comp.width * 0.4, dy: 0, scale: 100, rot: 0, op: 0 };
      case "slide-right":
        return { dx: -comp.width * 0.4, dy: 0, scale: 100, rot: 0, op: 0 };
      case "pop":
        return { dx: 0, dy: 0, scale: 0, rot: 0, op: 0 };
      case "zoom":
        return { dx: 0, dy: 0, scale: 180, rot: 0, op: 0 };
      case "spin-in":
        return { dx: 0, dy: 0, scale: 0, rot: -180, op: 0 };
      case "fade":
      default:
        return { dx: 0, dy: 0, scale: 100, rot: 0, op: 0 };
    }
  })();

  const restScale = t.scaleX.value;
  const restRot = t.rotation.value;

  if (mode === "in" || mode === "both") {
    if (off.dx || off.dy) {
      t.x.keyframes = [kf(layer.timing.start, x0 + off.dx, EASE_IN), kf(inEnd, x0, EASE_IN)];
      t.y.keyframes = [kf(layer.timing.start, y0 + off.dy, EASE_IN), kf(inEnd, y0, EASE_IN)];
    }
    if (off.scale !== 100) {
      t.scaleX.keyframes = [kf(layer.timing.start, off.scale, EASE_IN), kf(inEnd, restScale, EASE_IN)];
      t.scaleY.keyframes = [kf(layer.timing.start, off.scale, EASE_IN), kf(inEnd, restScale, EASE_IN)];
    }
    if (off.rot) {
      t.rotation.keyframes = [kf(layer.timing.start, restRot + off.rot, EASE_IN), kf(inEnd, restRot, EASE_IN)];
    }
    // Opacity fades in for every preset.
    t.opacity.keyframes = [kf(layer.timing.start, off.op, EASE_IN), kf(inEnd, 100, EASE_IN)];
  }

  if (mode === "out" || mode === "both") {
    const endT = layer.timing.end;
    if (off.dx || off.dy) {
      t.x.keyframes = [...(t.x.keyframes ?? []), kf(outStart, x0, EASE_OUT), kf(endT, x0 + off.dx, EASE_OUT)];
      t.y.keyframes = [...(t.y.keyframes ?? []), kf(outStart, y0, EASE_OUT), kf(endT, y0 + off.dy, EASE_OUT)];
    }
    if (off.scale !== 100) {
      t.scaleX.keyframes = [...(t.scaleX.keyframes ?? []), kf(outStart, restScale, EASE_OUT), kf(endT, off.scale, EASE_OUT)];
      t.scaleY.keyframes = [...(t.scaleY.keyframes ?? []), kf(outStart, restScale, EASE_OUT), kf(endT, off.scale, EASE_OUT)];
    }
    t.opacity.keyframes = [...(t.opacity.keyframes ?? []), kf(outStart, 100, EASE_OUT), kf(endT, off.op, EASE_OUT)];
  }

  // Keep keyframes sorted by time.
  for (const ch of [t.x, t.y, t.scaleX, t.scaleY, t.rotation, t.opacity]) {
    ch.keyframes?.sort((a, b) => a.time - b.time);
  }
}
