/**
 * Loft Motion — procedural behaviors (Cavalry-style).
 *
 * Each behavior is a PURE function of time `t` (seconds) that returns an offset
 * added on top of a layer's keyframed/static transform. Because everything is
 * pure-in-t, behaviors scrub and export frame-accurately with no state.
 *
 * A behavior targets a channel (position/x/y/scale/rotation/opacity) and is
 * evaluated with a clone context (index/count/stagger) so cloned copies cascade.
 */
import type { Behavior, BehaviorType } from "@/lib/scene/schema";

/* -------------------------------------------------------------------------- */
/*  Deterministic smooth value noise (for Wiggle)                              */
/* -------------------------------------------------------------------------- */

function hash1(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h / 0xffffffff) * 2 - 1;
}
const smoothstep = (x: number) => x * x * (3 - 2 * x);

function valueNoise1D(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  return hash1(i, seed) * (1 - smoothstep(f)) + hash1(i + 1, seed) * smoothstep(f);
}

function wiggle1D(t: number, freq: number, amp: number, octaves: number, seed: number): number {
  let sum = 0;
  let a = amp;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise1D(t * f, seed + o * 1013) * a;
    a *= 0.5;
    f *= 2;
  }
  return sum;
}

/* -------------------------------------------------------------------------- */
/*  Wave shapes (for Oscillate)                                                */
/* -------------------------------------------------------------------------- */

function wave(kind: number, phase: number): number {
  // kind: 0 sine, 1 triangle, 2 square, 3 sawtooth
  switch (kind) {
    case 1:
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case 2:
      return Math.sign(Math.sin(phase)) || 1;
    case 3: {
      const x = phase / (2 * Math.PI);
      return 2 * (x - Math.floor(x + 0.5));
    }
    default:
      return Math.sin(phase);
  }
}

/* -------------------------------------------------------------------------- */
/*  Analytic damped spring (deterministic — pure function of t)                */
/* -------------------------------------------------------------------------- */

function springDisplacement(
  t: number,
  stiffness: number,
  damping: number,
  mass: number,
  from: number,
): number {
  if (t <= 0) return from;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x0 = from;
  const v0 = 0;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const A = x0;
    const B = (v0 + zeta * w0 * x0) / wd;
    return Math.exp(-zeta * w0 * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
  } else if (zeta === 1) {
    return Math.exp(-w0 * t) * (x0 + (v0 + w0 * x0) * t);
  } else {
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - s);
    const r2 = -w0 * (zeta + s);
    const A = (v0 - r2 * x0) / (r1 - r2);
    const B = x0 - A;
    return A * Math.exp(r1 * t) + B * Math.exp(r2 * t);
  }
}

/* -------------------------------------------------------------------------- */
/*  Behavior output                                                            */
/* -------------------------------------------------------------------------- */

/** Offsets a behavior contributes, per channel. Unused channels stay 0. */
export interface BehaviorOffset {
  x: number;
  y: number;
  scale: number; // additive % (e.g. +10 = +10%)
  rotation: number; // additive degrees
  opacity: number; // additive %
}

const ZERO: BehaviorOffset = { x: 0, y: 0, scale: 0, rotation: 0, opacity: 0 };

export interface CloneContext {
  index: number;
  count: number;
  /** Per-clone time delay in seconds (from the cloner's stagger). */
  stagger: number;
}

const NO_CLONE: CloneContext = { index: 0, count: 1, stagger: 0 };

/** Default params per behavior type — the "it just works" values. */
export function defaultBehaviorParams(type: BehaviorType): Record<string, number> {
  switch (type) {
    case "wiggle":
      return { freq: 2, amp: 30, octaves: 1, seed: 1, wave: 0 };
    case "oscillate":
      return { freq: 1, amp: 40, phase: 0, wave: 0 };
    case "spin":
      return { rate: 120 }; // deg/sec
    case "spring":
      return { stiffness: 170, damping: 12, mass: 1, from: 80, delay: 0.2 };
    case "orbit":
      return { radius: 80, rate: 60, phase: 0 }; // deg/sec around a circle
  }
}

/** Three-tier preset multipliers applied to amplitude-like params. */
export const BEHAVIOR_PRESETS = ["subtle", "medium", "strong"] as const;
export type BehaviorPreset = (typeof BEHAVIOR_PRESETS)[number];
const PRESET_MULT: Record<BehaviorPreset, number> = { subtle: 0.4, medium: 1, strong: 2.5 };

export function applyPreset(
  type: BehaviorType,
  preset: BehaviorPreset,
): Record<string, number> {
  const p = defaultBehaviorParams(type);
  const m = PRESET_MULT[preset];
  if (type === "wiggle" || type === "oscillate") p.amp *= m;
  else if (type === "spin" || type === "orbit") p.rate *= m;
  else if (type === "spring") p.from *= m;
  return p;
}

/**
 * Evaluate a single behavior at time `t`, returning its channel offsets.
 * `clone` carries the per-copy index for staggered cascades.
 */
export function evalBehavior(
  b: Behavior,
  t: number,
  duration: number,
  clone: CloneContext = NO_CLONE,
): BehaviorOffset {
  if (!b.enabled) return ZERO;
  const p = b.params;
  const s = b.strength;
  // Per-clone time delay so cloned copies cascade.
  let tt = t - clone.index * clone.stagger;

  // Seamless loop: wrap time and cross-blend (only meaningful for wiggle/osc).
  const wrap = (val: (time: number) => number) => {
    if (!b.loop || duration <= 0) return val(tt);
    const tm = ((tt % duration) + duration) % duration;
    const a = val(tm);
    const c = val(tm - duration);
    const k = tm / duration;
    return a * (1 - k) + c * k;
  };

  const out: BehaviorOffset = { x: 0, y: 0, scale: 0, rotation: 0, opacity: 0 };

  switch (b.type) {
    case "wiggle": {
      const freq = p.freq ?? 2;
      const amp = (p.amp ?? 30) * s;
      const oct = Math.max(1, Math.round(p.octaves ?? 1));
      const seed = (p.seed ?? 1) + clone.index * 17;
      const vx = wrap((time) => wiggle1D(time, freq, amp, oct, seed));
      const vy = wrap((time) => wiggle1D(time, freq, amp, oct, seed + 101));
      assignTarget(out, b.target, vx, vy);
      break;
    }
    case "oscillate": {
      const freq = p.freq ?? 1;
      const amp = (p.amp ?? 40) * s;
      const phase = ((p.phase ?? 0) * Math.PI) / 180 + clone.index * 0.5;
      const kind = p.wave ?? 0;
      const v = wrap((time) => amp * wave(kind, 2 * Math.PI * freq * time + phase));
      // For position-target oscillate, drive Y by default (bobbing).
      if (b.target === "position") assignTarget(out, "y", 0, v);
      else assignTarget(out, b.target, v, v);
      break;
    }
    case "spin": {
      const rate = (p.rate ?? 120) * s;
      out.rotation = rate * tt;
      break;
    }
    case "spring": {
      const delay = p.delay ?? 0;
      tt = t - delay - clone.index * clone.stagger;
      const disp =
        springDisplacement(
          Math.max(0, tt),
          p.stiffness ?? 170,
          p.damping ?? 12,
          p.mass ?? 1,
          (p.from ?? 80) * s,
        );
      if (b.target === "scale") out.scale = disp;
      else if (b.target === "rotation") out.rotation = disp;
      else if (b.target === "opacity") out.opacity = disp;
      else assignTarget(out, b.target, disp, disp);
      break;
    }
    case "orbit": {
      const radius = (p.radius ?? 80) * s;
      const rate = (p.rate ?? 60) * Math.PI / 180; // rad/sec
      const phase = ((p.phase ?? 0) * Math.PI) / 180 + clone.index * 0.5;
      out.x = Math.cos(rate * tt + phase) * radius;
      out.y = Math.sin(rate * tt + phase) * radius;
      break;
    }
  }
  return out;
}

function assignTarget(
  out: BehaviorOffset,
  target: string,
  vx: number,
  vy: number,
) {
  switch (target) {
    case "position":
      out.x += vx;
      out.y += vy;
      break;
    case "x":
      out.x += vx;
      break;
    case "y":
      out.y += vy;
      break;
    case "scale":
      out.scale += vx;
      break;
    case "rotation":
      out.rotation += vx;
      break;
    case "opacity":
      out.opacity += vx;
      break;
  }
}

/** Sum every behavior on a layer into a single combined offset. */
export function evalBehaviors(
  behaviors: Behavior[],
  t: number,
  duration: number,
  clone: CloneContext = NO_CLONE,
): BehaviorOffset {
  const acc: BehaviorOffset = { x: 0, y: 0, scale: 0, rotation: 0, opacity: 0 };
  for (const b of behaviors) {
    const o = evalBehavior(b, t, duration, clone);
    acc.x += o.x;
    acc.y += o.y;
    acc.scale += o.scale;
    acc.rotation += o.rotation;
    acc.opacity += o.opacity;
  }
  return acc;
}
