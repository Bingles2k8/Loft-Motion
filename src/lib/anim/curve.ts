/**
 * Loft Motion — bezier curve geometry for the Graph Editor.
 *
 * A keyframe segment's easing is a unit cubic-bezier [x1,y1,x2,y2]. In the value
 * graph we draw the actual animated value over time, but the easing handles are
 * manipulated in the segment's normalised [0,1]×[0,1] space (time × progress),
 * exactly like CSS `cubic-bezier()`. These helpers convert between the two.
 */
import { easeWithBezier } from "@/lib/anim/easing";

export type Bezier = [number, number, number, number];

/** Sample N points of the eased progress curve for drawing, p in [0,1]. */
export function sampleCurve(bezier: Bezier, samples = 24): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    pts.push([x, easeWithBezier(bezier, x)]);
  }
  return pts;
}

/** Clamp control-point x into [0,1] (CSS requires monotonic time); y is free. */
export function clampHandle(x: number, y: number): [number, number] {
  return [Math.max(0, Math.min(1, x)), y];
}

/** A few presets, exposed for quick-apply buttons in the graph editor. */
export const QUICK_CURVES: Array<{ label: string; bezier: Bezier }> = [
  { label: "Linear", bezier: [0, 0, 1, 1] },
  { label: "Ease In", bezier: [0.42, 0, 1, 1] },
  { label: "Ease Out", bezier: [0, 0, 0.58, 1] },
  { label: "Ease Both", bezier: [0.42, 0, 0.58, 1] },
  { label: "Easy Ease", bezier: [0.33, 0, 0.67, 1] },
];
