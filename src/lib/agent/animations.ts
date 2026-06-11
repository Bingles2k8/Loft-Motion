/**
 * Loft Motion — Agent animation primitives.
 *
 * Turns the high-level `enter` / `exit` preset names from an {@link AnimationSpec}
 * into concrete keyframes on the transform channels. The taste lives here: each
 * preset picks an offset and a named easing that reads well by default, so an LLM
 * never has to reason about bezier control points or pixel offsets.
 *
 * A builder returns, per channel, a list of `{ time, value, easing }` points
 * expressed in ABSOLUTE composition values (px / percent / degrees / 0..100),
 * anchored so that the "settled" value equals the element's base value. The
 * compiler merges these onto the layer's transform.
 */
import type { EnterPreset, ExitPreset } from "@/lib/agent/spec";

export type Channel = "x" | "y" | "scaleX" | "scaleY" | "rotation" | "opacity";

export interface ChannelPoint {
  time: number;
  value: number;
  easing: string;
}

export type ChannelKeys = Partial<Record<Channel, ChannelPoint[]>>;

/** Base (settled) values an element rests at, used as the keyframe anchor. */
export interface Base {
  x: number;
  y: number;
  scale: number; // percent
  rotation: number; // degrees
  opacity: number; // 0..100
}

export interface Frame {
  width: number;
  height: number;
}

const ENTER_DEFAULT_DUR = 0.6;
const EXIT_DEFAULT_DUR = 0.5;

/* -------------------------------------------------------------------------- */
/*  Entrances                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build entrance keyframes. The motion runs over `[start, start + dur]` and
 * lands exactly on the element's base values.
 */
export function buildEnter(
  preset: EnterPreset,
  start: number,
  dur: number,
  base: Base,
  frame: Frame,
  easingOverride?: string,
): ChannelKeys {
  const t0 = start;
  const t1 = start + (dur || ENTER_DEFAULT_DUR);
  const ease = easingOverride;
  const keys: ChannelKeys = {};

  // Fade is shared by almost every entrance.
  const withFade = () => {
    keys.opacity = [
      { time: t0, value: 0, easing: ease ?? "gentle" },
      { time: Math.min(t1, t0 + (dur || ENTER_DEFAULT_DUR) * 0.85), value: base.opacity, easing: "gentle" },
    ];
  };

  switch (preset) {
    case "none":
      break;
    case "fade":
    case "blur-in":
      withFade();
      if (preset === "blur-in") {
        // Portable approximation: a tiny settle-in scale reads like a focus pull.
        keys.scaleX = [
          { time: t0, value: base.scale * 1.06, easing: ease ?? "settle" },
          { time: t1, value: base.scale, easing: "settle" },
        ];
        keys.scaleY = clone(keys.scaleX);
      }
      break;
    case "fade-up":
      withFade();
      keys.y = [
        { time: t0, value: base.y + 80, easing: ease ?? "settle" },
        { time: t1, value: base.y, easing: "settle" },
      ];
      break;
    case "fade-down":
      withFade();
      keys.y = [
        { time: t0, value: base.y - 80, easing: ease ?? "settle" },
        { time: t1, value: base.y, easing: "settle" },
      ];
      break;
    case "rise":
      withFade();
      keys.y = [
        { time: t0, value: base.y + Math.max(140, frame.height * 0.14), easing: ease ?? "settle" },
        { time: t1, value: base.y, easing: "settle" },
      ];
      break;
    case "from-left":
      withFade();
      keys.x = [
        { time: t0, value: base.x - frame.width * 0.4, easing: ease ?? "settle" },
        { time: t1, value: base.x, easing: "settle" },
      ];
      break;
    case "from-right":
      withFade();
      keys.x = [
        { time: t0, value: base.x + frame.width * 0.4, easing: ease ?? "settle" },
        { time: t1, value: base.x, easing: "settle" },
      ];
      break;
    case "from-top":
      withFade();
      keys.y = [
        { time: t0, value: base.y - frame.height * 0.45, easing: ease ?? "settle" },
        { time: t1, value: base.y, easing: "settle" },
      ];
      break;
    case "from-bottom":
      withFade();
      keys.y = [
        { time: t0, value: base.y + frame.height * 0.45, easing: ease ?? "settle" },
        { time: t1, value: base.y, easing: "settle" },
      ];
      break;
    case "pop":
      withFade();
      keys.scaleX = [
        { time: t0, value: base.scale * 0.3, easing: ease ?? "overshoot" },
        { time: t1, value: base.scale, easing: "overshoot" },
      ];
      keys.scaleY = clone(keys.scaleX);
      break;
    case "scale":
      withFade();
      keys.scaleX = [
        { time: t0, value: base.scale * 0.8, easing: ease ?? "settle" },
        { time: t1, value: base.scale, easing: "settle" },
      ];
      keys.scaleY = clone(keys.scaleX);
      break;
    case "zoom":
      withFade();
      keys.scaleX = [
        { time: t0, value: base.scale * 1.3, easing: ease ?? "settle" },
        { time: t1, value: base.scale, easing: "settle" },
      ];
      keys.scaleY = clone(keys.scaleX);
      break;
    case "spin":
      withFade();
      keys.rotation = [
        { time: t0, value: base.rotation - 120, easing: ease ?? "overshoot" },
        { time: t1, value: base.rotation, easing: "overshoot" },
      ];
      keys.scaleX = [
        { time: t0, value: base.scale * 0.4, easing: ease ?? "overshoot" },
        { time: t1, value: base.scale, easing: "overshoot" },
      ];
      keys.scaleY = clone(keys.scaleX);
      break;
  }
  return keys;
}

/* -------------------------------------------------------------------------- */
/*  Exits                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Build exit keyframes. The motion runs over `[out - dur, out]`, starting at the
 * element's base values and leaving the frame.
 */
export function buildExit(
  preset: ExitPreset,
  out: number,
  dur: number,
  base: Base,
  frame: Frame,
  easingOverride?: string,
): ChannelKeys {
  const d = dur || EXIT_DEFAULT_DUR;
  const t0 = Math.max(0, out - d);
  const t1 = out;
  const ease = easingOverride ?? "easeIn";
  const keys: ChannelKeys = {};

  const withFadeOut = () => {
    keys.opacity = [
      { time: t0, value: base.opacity, easing: ease },
      { time: t1, value: 0, easing: ease },
    ];
  };

  switch (preset) {
    case "none":
      break;
    case "fade":
      withFadeOut();
      break;
    case "fade-up":
      withFadeOut();
      keys.y = [
        { time: t0, value: base.y, easing: ease },
        { time: t1, value: base.y - 80, easing: ease },
      ];
      break;
    case "fade-down":
    case "drop":
      withFadeOut();
      keys.y = [
        { time: t0, value: base.y, easing: ease },
        { time: t1, value: base.y + (preset === "drop" ? frame.height * 0.4 : 80), easing: ease },
      ];
      break;
    case "to-left":
      withFadeOut();
      keys.x = [
        { time: t0, value: base.x, easing: ease },
        { time: t1, value: base.x - frame.width * 0.4, easing: ease },
      ];
      break;
    case "to-right":
      withFadeOut();
      keys.x = [
        { time: t0, value: base.x, easing: ease },
        { time: t1, value: base.x + frame.width * 0.4, easing: ease },
      ];
      break;
    case "to-top":
      withFadeOut();
      keys.y = [
        { time: t0, value: base.y, easing: ease },
        { time: t1, value: base.y - frame.height * 0.45, easing: ease },
      ];
      break;
    case "to-bottom":
      withFadeOut();
      keys.y = [
        { time: t0, value: base.y, easing: ease },
        { time: t1, value: base.y + frame.height * 0.45, easing: ease },
      ];
      break;
    case "pop":
    case "scale":
      withFadeOut();
      keys.scaleX = [
        { time: t0, value: base.scale, easing: ease },
        { time: t1, value: base.scale * (preset === "pop" ? 0.3 : 0.8), easing: ease },
      ];
      keys.scaleY = clone(keys.scaleX);
      break;
    case "zoom":
      withFadeOut();
      keys.scaleX = [
        { time: t0, value: base.scale, easing: ease },
        { time: t1, value: base.scale * 1.3, easing: ease },
      ];
      keys.scaleY = clone(keys.scaleX);
      break;
    case "spin":
      withFadeOut();
      keys.rotation = [
        { time: t0, value: base.rotation, easing: ease },
        { time: t1, value: base.rotation + 120, easing: ease },
      ];
      keys.scaleX = [
        { time: t0, value: base.scale, easing: ease },
        { time: t1, value: base.scale * 0.4, easing: ease },
      ];
      keys.scaleY = clone(keys.scaleX);
      break;
  }
  return keys;
}

function clone(pts?: ChannelPoint[]): ChannelPoint[] {
  return (pts ?? []).map((p) => ({ ...p }));
}
