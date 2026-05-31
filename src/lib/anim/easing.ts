/**
 * Loft Motion — named easing library (the "invisible" craft layer, §5).
 *
 * Designers think in feel, not bezier numbers. Every easing here is a named,
 * hand-tuned curve. The SAME library is consumed by the renderer, the timeline
 * and all three exporters, so "Settle" means the same thing on screen, in an
 * MP4, in Lottie and in CSS. Each entry also carries:
 *   - `bezier`  : cubic-bezier control points (x1,y1,x2,y2) for solving + CSS.
 *   - `blurb`   : a one-line description surfaced by the principles panel.
 *
 * Overshoot/anticipate curves intentionally push y outside [0,1] — that's the
 * spring-like over/undershoot, and it's representable by `cubic-bezier()` in CSS.
 */

export interface EasingDef {
  name: string;
  label: string;
  /** [x1, y1, x2, y2] — control points of a unit cubic bezier. */
  bezier: [number, number, number, number];
  blurb: string;
}

export const EASINGS = {
  linear: {
    name: "linear",
    label: "Linear",
    bezier: [0, 0, 1, 1],
    blurb: "Constant speed. Mechanical — great for spinners, rarely for motion.",
  },
  gentle: {
    name: "gentle",
    label: "Gentle",
    bezier: [0.25, 0.1, 0.25, 1],
    blurb: "Soft ease in and out. The safe, pleasant default for most moves.",
  },
  smooth: {
    name: "smooth",
    label: "Smooth",
    bezier: [0.45, 0, 0.55, 1],
    blurb: "Symmetric and calm — ideal for fades and gentle repositions.",
  },
  snappy: {
    name: "snappy",
    label: "Snappy",
    bezier: [0.2, 0, 0, 1],
    blurb: "Quick to leave, soft to land. Feels responsive and alive.",
  },
  sharp: {
    name: "sharp",
    label: "Sharp",
    bezier: [0.4, 0, 0.2, 1],
    blurb: "Decisive material-style motion for UI that should feel crisp.",
  },
  settle: {
    name: "settle",
    label: "Settle",
    bezier: [0.16, 1, 0.3, 1],
    blurb: "Rushes out then eases to a gentle, natural stop. Very organic.",
  },
  anticipate: {
    name: "anticipate",
    label: "Anticipate",
    bezier: [0.7, -0.4, 0.4, 1],
    blurb: "Winds back slightly before moving — adds intent and weight.",
  },
  overshoot: {
    name: "overshoot",
    label: "Overshoot",
    bezier: [0.34, 1.56, 0.64, 1],
    blurb: "Sails past the target then settles back. Playful and energetic.",
  },
  easeIn: {
    name: "easeIn",
    label: "Ease In",
    bezier: [0.42, 0, 1, 1],
    blurb: "Starts slow, accelerates out. Good for exits leaving the frame.",
  },
  easeOut: {
    name: "easeOut",
    label: "Ease Out",
    bezier: [0, 0, 0.58, 1],
    blurb: "Enters fast, decelerates in. Good for things arriving on screen.",
  },
} satisfies Record<string, EasingDef>;

export type Easings = typeof EASINGS;
export const EASING_NAMES = Object.keys(EASINGS) as (keyof Easings)[];

export function getEasing(name: string): EasingDef {
  return (EASINGS as Record<string, EasingDef>)[name] ?? EASINGS.gentle;
}

/* -------------------------------------------------------------------------- */
/*  Cubic-bezier solver (the same approach browsers use for CSS easing)       */
/* -------------------------------------------------------------------------- */

function A(a1: number, a2: number) {
  return 1.0 - 3.0 * a2 + 3.0 * a1;
}
function B(a1: number, a2: number) {
  return 3.0 * a2 - 6.0 * a1;
}
function C(a1: number) {
  return 3.0 * a1;
}

/** Evaluate the bezier polynomial at parameter t for control values a1,a2. */
function calcBezier(t: number, a1: number, a2: number) {
  return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
}

function calcSlope(t: number, a1: number, a2: number) {
  return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1);
}

/** Given an x in [0,1], find the bezier parameter t via Newton-Raphson. */
function solveT(x: number, x1: number, x2: number) {
  let t = x;
  for (let i = 0; i < 8; i++) {
    const xEst = calcBezier(t, x1, x2) - x;
    const d = calcSlope(t, x1, x2);
    if (Math.abs(d) < 1e-6) break;
    t -= xEst / d;
  }
  // Clamp into a sane range; bisection fallback for robustness.
  if (t < 0 || t > 1) {
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const xEst = calcBezier(t, x1, x2);
      if (Math.abs(xEst - x) < 1e-6) break;
      if (xEst < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
  }
  return t;
}

/**
 * Sample a cubic-bezier curve (given its 4 control points) at progress `p`.
 * Returns the eased value (can exceed [0,1] for overshoot/anticipate).
 */
export function easeWithBezier(
  bezier: readonly [number, number, number, number],
  p: number,
): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const [x1, y1, x2, y2] = bezier;
  if (x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1) return p; // linear fast-path
  const t = solveT(p, x1, x2);
  return calcBezier(t, y1, y2);
}

/**
 * Sample a named easing at normalised progress `p` in [0,1].
 */
export function ease(name: string, p: number): number {
  return easeWithBezier(getEasing(name).bezier, p);
}

/** CSS representation of a raw bezier, e.g. `cubic-bezier(0.16, 1, 0.3, 1)`. */
export function bezierToCss(
  bezier: readonly [number, number, number, number],
): string {
  const [x1, y1, x2, y2] = bezier;
  if (x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1) return "linear";
  return `cubic-bezier(${round(x1)}, ${round(y1)}, ${round(x2)}, ${round(y2)})`;
}

/** CSS representation of a named easing. */
export function easingToCss(name: string): string {
  if (name === "linear") return "linear";
  return bezierToCss(getEasing(name).bezier);
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
