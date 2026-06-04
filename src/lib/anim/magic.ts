/**
 * Loft Motion — "Animate this" / "Surprise me" magic motion.
 *
 * Applies a tasteful, randomised-but-curated animation to a layer with zero
 * setup — the "taste encoded as defaults" promise as a single click. Picks an
 * entrance preset + an optional looping behavior, seeded so "Surprise me"
 * re-rolls a fresh combination each time. All deterministic once written.
 */
import { applyAutoAnimate, type AutoAnimatePreset } from "@/lib/anim/autoAnimate";
import { createBehavior } from "@/lib/scene/factory";
import { applyPreset } from "@/lib/anim/behaviors";
import type { Composition, Layer } from "@/lib/scene/schema";

const ENTRANCES: AutoAnimatePreset[] = [
  "fade", "pop", "slide-up", "slide-down", "slide-left", "slide-right", "zoom", "spin-in",
];

// Optional ambient looping behaviors layered on top of the entrance.
const AMBIENT: Array<{ type: Parameters<typeof createBehavior>[0]; target: Parameters<typeof createBehavior>[1] }> = [
  { type: "oscillate", target: "scale" },
  { type: "wiggle", target: "position" },
  { type: "spin", target: "rotation" },
  { type: "oscillate", target: "y" },
];

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Simple seeded RNG so a given seed reproduces the same look. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Mutate a layer with a tasteful animation. `seed` drives the variation; pass a
 * fresh random seed for "Surprise me", or a fixed one for a stable "Animate this".
 */
export function applyMagic(layer: Layer, comp: Composition, seed: number, ambient = true) {
  const rnd = rng(seed);
  // Clear any prior magic so re-rolls don't stack.
  layer.behaviors = [];

  const entrance = pick(ENTRANCES, rnd);
  applyAutoAnimate(layer, entrance, comp, { mode: "in", duration: 0.6 + rnd() * 0.4 });

  // ~60% of the time add a gentle ambient loop for life.
  if (ambient && rnd() > 0.4) {
    const a = pick(AMBIENT, rnd);
    const b = createBehavior(a.type, a.target);
    // Keep ambient subtle by default.
    b.params = applyPreset(a.type, rnd() > 0.6 ? "medium" : "subtle");
    b.loop = a.type === "oscillate" || a.type === "wiggle";
    layer.behaviors.push(b);
  }
}
