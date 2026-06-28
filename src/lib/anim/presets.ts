/**
 * Loft Motion — preset animations (Figma Motion-style).
 *
 * One-click motion that drops at the playhead: Fade / Move / Scale / Rotate /
 * Pop. Each preset writes transform keyframes over a [at, at+duration] window
 * using the named-easing library, so it renders identically across the preview
 * and every exporter. Presets target different channels (fade→opacity,
 * move→y+opacity, scale/pop→scale, rotate→rotation) so they stack naturally
 * when applied together.
 */
import { uid } from "@/lib/scene/factory";
import type { Keyframe, Layer } from "@/lib/scene/schema";

export const MOTION_PRESETS = ["fade", "move", "scale", "rotate", "pop"] as const;
export type MotionPreset = (typeof MOTION_PRESETS)[number];

export const MOTION_PRESET_LABELS: Record<MotionPreset, string> = {
  fade: "Fade",
  move: "Move",
  scale: "Scale",
  rotate: "Rotate",
  pop: "Pop",
};

export const MOTION_PRESET_BLURBS: Record<MotionPreset, string> = {
  fade: "Opacity 0 → 100",
  move: "Slides up into place while fading in",
  scale: "Grows from nothing to its resting size",
  rotate: "Spins a half-turn into its resting angle",
  pop: "Springs in with a playful overshoot",
};

function kf(time: number, value: number, easing: string): Keyframe {
  return { id: uid("kf"), time, value, easing };
}

/** Default preset block length, in seconds. */
export const PRESET_DEFAULT_DURATION = 0.6;

/**
 * Apply a preset to a layer in place, anchored at `at` (the playhead) and
 * lasting `duration` seconds. Targets only the channels the preset needs, so
 * different presets layered together compose rather than clobber each other.
 */
export function applyMotionPreset(
  layer: Layer,
  preset: MotionPreset,
  opts: { at: number; duration?: number } = { at: 0 },
) {
  const dur = opts.duration ?? PRESET_DEFAULT_DURATION;
  const a = Math.max(0, opts.at);
  const b = a + dur;
  const t = layer.transform;
  const ease = "settle";

  switch (preset) {
    case "fade":
      t.opacity.keyframes = [kf(a, 0, ease), kf(b, 100, ease)];
      break;
    case "move":
      t.y.keyframes = [kf(a, t.y.value + 160, ease), kf(b, t.y.value, ease)];
      t.opacity.keyframes = [kf(a, 0, ease), kf(b, 100, ease)];
      break;
    case "scale":
      t.scaleX.keyframes = [kf(a, 0, ease), kf(b, t.scaleX.value, ease)];
      t.scaleY.keyframes = [kf(a, 0, ease), kf(b, t.scaleY.value, ease)];
      break;
    case "rotate":
      t.rotation.keyframes = [
        kf(a, t.rotation.value - 180, ease),
        kf(b, t.rotation.value, ease),
      ];
      break;
    case "pop":
      t.scaleX.keyframes = [kf(a, 0, "overshoot"), kf(b, t.scaleX.value, "overshoot")];
      t.scaleY.keyframes = [kf(a, 0, "overshoot"), kf(b, t.scaleY.value, "overshoot")];
      t.opacity.keyframes = [kf(a, 0, ease), kf(b, 100, ease)];
      break;
  }
}
