/**
 * Loft Motion — timeline shared helpers.
 */
import type { Layer } from "@/lib/scene/schema";
import {
  TRANSFORM_CHANNELS,
  effectChannels,
  type ChannelDef,
} from "@/lib/scene/paths";

export const ROW_H = 28;
export const RULER_H = 26;

/** All channel rows shown for an expanded layer (transform + effect params). */
export function layerChannels(layer: Layer): ChannelDef[] {
  return [...TRANSFORM_CHANNELS, ...effectChannels(layer)];
}

/** Attach window pointer move/up listeners for a drag gesture. */
export function startDrag(
  onMove: (e: PointerEvent) => void,
  onEnd?: (e: PointerEvent) => void,
) {
  const move = (e: PointerEvent) => onMove(e);
  const up = (e: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onEnd?.(e);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

export function fmtTime(t: number) {
  return `${t.toFixed(2)}s`;
}

/** Choose a "nice" ruler tick step targeting ~80px spacing. */
export function niceStep(pxPerSec: number) {
  const target = 80 / pxPerSec;
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
  return steps.find((s) => s >= target) ?? 60;
}
