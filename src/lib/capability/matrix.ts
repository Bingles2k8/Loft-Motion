/**
 * Loft Motion — capability matrix.
 *
 * The single table of truth for "what survives which export target". Refined
 * from the rough matrix in §3.2 of the build plan against real Lottie/CSS
 * limits. The capability engine (engine.ts) walks the scene and consults this.
 *
 * Keep this declarative — it's meant to be read and tweaked by humans.
 */
import type { CompatLevel, ExportTarget } from "@/lib/scene/schema";

export interface FeatureCompat {
  level: CompatLevel;
  /** Human-readable explanation surfaced in the UI when not `full`. */
  note?: string;
}

export type FeatureRow = Record<ExportTarget, FeatureCompat>;

const FULL: FeatureCompat = { level: "full" };

/** Stable keys for every distinguishable feature the engine can detect. */
export type FeatureKey =
  | "transform"
  | "opacity"
  | "shape"
  | "gradientFill"
  | "stroke"
  | "cornerRadius"
  | "text"
  | "image"
  | "blendMode"
  | "effect.blur"
  | "effect.glow"
  | "effect.drop-shadow";

export const FEATURE_MATRIX: Record<FeatureKey, FeatureRow> = {
  transform: { mp4: FULL, lottie: FULL, css: FULL },
  opacity: { mp4: FULL, lottie: FULL, css: FULL },

  shape: {
    mp4: FULL,
    lottie: FULL,
    css: {
      level: "partial",
      note: "Shapes become divs/clip-paths; complex geometry may simplify.",
    },
  },

  gradientFill: {
    mp4: FULL,
    lottie: {
      level: "partial",
      note: "Gradients export but are unreliable inside masks.",
    },
    css: FULL,
  },

  stroke: {
    mp4: FULL,
    lottie: FULL,
    css: {
      level: "partial",
      note: "Stroke maps to border/outline; dashed/aligned strokes may differ.",
    },
  },

  cornerRadius: { mp4: FULL, lottie: FULL, css: FULL },

  text: {
    mp4: FULL,
    lottie: {
      level: "partial",
      note: "Text exports best as outlines; live fonts depend on the player.",
    },
    css: FULL,
  },

  image: {
    mp4: FULL,
    lottie: {
      level: "partial",
      note: "Images are embedded as base64 — watch the file size.",
    },
    css: FULL,
  },

  blendMode: {
    mp4: FULL,
    lottie: {
      level: "partial",
      note: "Only some blend modes are supported by Lottie players.",
    },
    css: {
      level: "partial",
      note: "Maps to mix-blend-mode; rendering varies across browsers.",
    },
  },

  "effect.blur": {
    mp4: FULL,
    lottie: {
      level: "none",
      note: "Blur isn't supported in Lottie; it will be dropped or baked.",
    },
    css: {
      level: "partial",
      note: "Maps to filter: blur() — correct, but has a real perf cost.",
    },
  },

  "effect.glow": {
    mp4: FULL,
    lottie: {
      level: "none",
      note: "Glow is a shader effect; not representable in Lottie.",
    },
    css: {
      level: "partial",
      note: "Approximated with drop-shadow/blur filters; not pixel-identical.",
    },
  },

  "effect.drop-shadow": {
    mp4: FULL,
    lottie: {
      level: "partial",
      note: "Drop shadow maps to a Lottie layer style; soft edges may differ.",
    },
    css: FULL,
  },
};

/** Look up a feature's compatibility for one target. */
export function lookup(feature: FeatureKey, target: ExportTarget): FeatureCompat {
  return FEATURE_MATRIX[feature][target];
}

/** The worse of two levels (none < partial < full → return the more severe). */
export function worse(a: CompatLevel, b: CompatLevel): CompatLevel {
  const rank: Record<CompatLevel, number> = { none: 0, partial: 1, full: 2 };
  return rank[a] <= rank[b] ? a : b;
}
