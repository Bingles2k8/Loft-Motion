/**
 * Loft Motion — keyframe evaluation. THE shared animation path.
 *
 * Preview (PixiJS) and export (MP4/Lottie/CSS) MUST run through this same code
 * so what you see is exactly what you get. Divergence here is the classic
 * motion-tool bug the build plan warns about (§7).
 *
 * Everything is a scalar channel, so evaluation is a small, deterministic,
 * frame-accurate function.
 */
import { ease } from "@/lib/anim/easing";
import type {
  Animatable,
  Effect,
  Layer,
  Transform,
} from "@/lib/scene/schema";

/** Resolve a single animatable scalar channel at time `t` (seconds). */
export function evalAnimatable(prop: Animatable, t: number): number {
  const kfs = prop.keyframes;
  if (!kfs || kfs.length === 0) return prop.value;
  if (kfs.length === 1) return kfs[0].value;

  // Keyframes are kept sorted by time on edit; guard anyway at the ends.
  if (t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;

  // Find the bracketing segment [k0, k1].
  let lo = 0;
  let hi = kfs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (kfs[mid].time <= t) lo = mid;
    else hi = mid;
  }
  const k0 = kfs[lo];
  const k1 = kfs[hi];
  const span = k1.time - k0.time;
  if (span <= 0) return k1.value;

  const p = (t - k0.time) / span;
  const eased = ease(k0.easing, p); // easing belongs to the OUTGOING keyframe
  return k0.value + (k1.value - k0.value) * eased;
}

/** True when at least one channel actually animates (has >1 keyframe). */
export function isAnimated(prop: Animatable): boolean {
  return (prop.keyframes?.length ?? 0) > 1;
}

export interface ResolvedTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
}

export function evalTransform(tf: Transform, t: number): ResolvedTransform {
  return {
    x: evalAnimatable(tf.x, t),
    y: evalAnimatable(tf.y, t),
    scaleX: evalAnimatable(tf.scaleX, t),
    scaleY: evalAnimatable(tf.scaleY, t),
    rotation: evalAnimatable(tf.rotation, t),
    opacity: evalAnimatable(tf.opacity, t),
    anchorX: evalAnimatable(tf.anchorX, t),
    anchorY: evalAnimatable(tf.anchorY, t),
  };
}

/** Resolve all of an effect's animatable params to plain numbers at time `t`. */
export function evalEffectParams(
  effect: Effect,
  t: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, prop] of Object.entries(effect.params)) {
    out[key] = evalAnimatable(prop, t);
  }
  return out;
}

/** Is the layer's clip live at time `t`? (simple-timeline in/out timing) */
export function isLayerActive(layer: Layer, t: number): boolean {
  return t >= layer.timing.start && t <= layer.timing.end;
}

/**
 * Effective opacity of a layer at time `t`, folding the parent chain so nested
 * layers fade with their group. Returns 0..1.
 */
export function evalEffectiveOpacity(
  layer: Layer,
  layersById: Map<string, Layer>,
  t: number,
): number {
  let opacity = evalAnimatable(layer.transform.opacity, t) / 100;
  let parentId = layer.parentId;
  const guard = new Set<string>([layer.id]);
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId);
    const parent = layersById.get(parentId);
    if (!parent) break;
    opacity *= evalAnimatable(parent.transform.opacity, t) / 100;
    parentId = parent.parentId;
  }
  return opacity;
}
