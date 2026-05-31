/**
 * Loft Motion — effects catalog (single source of truth).
 *
 * Every effect is described declaratively here: its pixi-filters backing, its
 * animatable params (with ranges + defaults), default colours, category,
 * description, and per-export-target compatibility. The Effects panel, the
 * factory (createEffect), the renderer (filter construction) and the capability
 * engine all read from this — adding an effect means adding one entry.
 *
 * Param/option names and defaults were verified against pixi-filters v6.
 */
import type {
  CompatLevel,
  EffectType,
  ExportTarget,
} from "@/lib/scene/schema";

export interface EffectParamDef {
  key: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export interface EffectColorDef {
  /** which stored field this colour writes to */
  field: "color" | "color2";
  label: string;
  default: string;
}

export interface EffectDef {
  type: EffectType;
  label: string;
  category: string;
  description: string;
  params: EffectParamDef[];
  colors?: EffectColorDef[];
  /** Per-target compatibility (MP4 is always full — it's rasterised). */
  compat: Record<ExportTarget, { level: CompatLevel; note?: string }>;
  /** True if the effect advances a `time` uniform (animated procedurally). */
  timeDriven?: boolean;
}

const MP4_FULL = { level: "full" as CompatLevel };
const LOTTIE_NO = {
  level: "none" as CompatLevel,
  note: "Shader effect — not representable in Lottie; rendered in MP4 only.",
};
const CSS_NO = {
  level: "none" as CompatLevel,
  note: "Not representable in CSS.",
};

/** A shader effect: rich in MP4, dropped by Lottie & CSS. */
function shaderCompat(): EffectDef["compat"] {
  return { mp4: MP4_FULL, lottie: LOTTIE_NO, css: CSS_NO };
}

export const EFFECTS: Record<EffectType, EffectDef> = {
  /* ---------------- Blur & Sharpen ---------------- */
  blur: {
    type: "blur",
    label: "Gaussian Blur",
    category: "Blur & Sharpen",
    description: "Softens the layer evenly.",
    params: [{ key: "strength", label: "Blurriness", default: 8, min: 0, max: 100 }],
    compat: {
      mp4: MP4_FULL,
      lottie: LOTTIE_NO,
      css: { level: "partial", note: "Maps to filter: blur() — real perf cost." },
    },
  },
  "motion-blur": {
    type: "motion-blur",
    label: "Directional Blur",
    category: "Blur & Sharpen",
    description: "Smears along an angle — fake motion blur.",
    params: [
      { key: "angle", label: "Direction", default: 0, min: -180, max: 180, unit: "°" },
      { key: "length", label: "Length", default: 30, min: 0, max: 200 },
    ],
    compat: shaderCompat(),
  },
  "zoom-blur": {
    type: "zoom-blur",
    label: "Zoom Blur",
    category: "Blur & Sharpen",
    description: "Radial zoom streaks from a centre point.",
    params: [
      { key: "strength", label: "Strength", default: 0.2, min: 0, max: 1, step: 0.01 },
      { key: "innerRadius", label: "Inner radius", default: 0, min: 0, max: 1000 },
    ],
    compat: shaderCompat(),
  },
  "radial-blur": {
    type: "radial-blur",
    label: "Radial Blur",
    category: "Blur & Sharpen",
    description: "Spin blur around a centre point.",
    params: [
      { key: "angle", label: "Angle", default: 12, min: 0, max: 180, unit: "°" },
    ],
    compat: shaderCompat(),
  },

  /* ---------------- Glow / Shadow / Edges ---------------- */
  glow: {
    type: "glow",
    label: "Glow",
    category: "Stylize",
    description: "Neon edge glow.",
    params: [
      { key: "strength", label: "Outer", default: 12, min: 0, max: 50 },
      { key: "innerStrength", label: "Inner", default: 2, min: 0, max: 50 },
      { key: "distance", label: "Distance", default: 10, min: 1, max: 50 },
    ],
    colors: [{ field: "color", label: "Colour", default: "#79aede" }],
    compat: shaderCompat(),
  },
  bloom: {
    type: "bloom",
    label: "Optical Glow",
    category: "Stylize",
    description: "Threshold bloom on bright areas — a 'Deep Glow' look.",
    params: [
      { key: "threshold", label: "Threshold", default: 0.5, min: 0, max: 1, step: 0.01 },
      { key: "bloomScale", label: "Intensity", default: 1.2, min: 0, max: 3, step: 0.05 },
      { key: "blur", label: "Radius", default: 8, min: 0, max: 40 },
    ],
    compat: shaderCompat(),
  },
  "drop-shadow": {
    type: "drop-shadow",
    label: "Drop Shadow",
    category: "Perspective",
    description: "Soft offset shadow.",
    params: [
      { key: "distance", label: "Distance", default: 12, min: 0, max: 100 },
      { key: "angle", label: "Direction", default: 45, min: -180, max: 180, unit: "°" },
      { key: "blur", label: "Softness", default: 8, min: 0, max: 50 },
      { key: "alpha", label: "Opacity", default: 60, min: 0, max: 100, unit: "%" },
    ],
    colors: [{ field: "color", label: "Colour", default: "#000000" }],
    compat: {
      mp4: MP4_FULL,
      lottie: {
        level: "partial",
        note: "Maps to a Lottie layer style; soft edges may differ.",
      },
      css: { level: "full" },
    },
  },
  outline: {
    type: "outline",
    label: "Outline",
    category: "Stylize",
    description: "Coloured stroke around the layer's edge.",
    params: [
      { key: "thickness", label: "Thickness", default: 3, min: 0, max: 20 },
    ],
    colors: [{ field: "color", label: "Colour", default: "#ffffff" }],
    compat: { mp4: MP4_FULL, lottie: { level: "partial", note: "Maps to a stroke." }, css: CSS_NO },
  },
  bevel: {
    type: "bevel",
    label: "Bevel",
    category: "Perspective",
    description: "3-D beveled edge with light & shadow.",
    params: [
      { key: "rotation", label: "Light angle", default: 45, min: 0, max: 360, unit: "°" },
      { key: "thickness", label: "Thickness", default: 2, min: 0, max: 20 },
    ],
    colors: [
      { field: "color", label: "Light", default: "#ffffff" },
      { field: "color2", label: "Shadow", default: "#000000" },
    ],
    compat: shaderCompat(),
  },

  /* ---------------- Colour ---------------- */
  adjust: {
    type: "adjust",
    label: "Brightness & Contrast",
    category: "Color Correction",
    description: "Brightness, contrast, saturation and gamma.",
    params: [
      { key: "brightness", label: "Brightness", default: 1, min: 0, max: 3, step: 0.01 },
      { key: "contrast", label: "Contrast", default: 1, min: 0, max: 3, step: 0.01 },
      { key: "saturation", label: "Saturation", default: 1, min: 0, max: 3, step: 0.01 },
      { key: "gamma", label: "Gamma", default: 1, min: 0, max: 3, step: 0.01 },
    ],
    compat: {
      mp4: MP4_FULL,
      lottie: LOTTIE_NO,
      css: { level: "partial", note: "Maps to filter: brightness/contrast/saturate()." },
    },
  },
  "hue-saturation": {
    type: "hue-saturation",
    label: "Hue / Saturation",
    category: "Color Correction",
    description: "Rotate hue and shift saturation / lightness.",
    params: [
      { key: "hue", label: "Hue", default: 0, min: -180, max: 180, unit: "°" },
      { key: "saturation", label: "Saturation", default: 0, min: -1, max: 1, step: 0.01 },
      { key: "lightness", label: "Lightness", default: 0, min: -1, max: 1, step: 0.01 },
    ],
    compat: {
      mp4: MP4_FULL,
      lottie: LOTTIE_NO,
      css: { level: "partial", note: "Maps to filter: hue-rotate/saturate()." },
    },
  },
  tint: {
    type: "tint",
    label: "Tint",
    category: "Color Correction",
    description: "Maps blacks and whites to two colours.",
    params: [{ key: "amount", label: "Amount", default: 100, min: 0, max: 100, unit: "%" }],
    colors: [
      { field: "color", label: "Black to", default: "#000000" },
      { field: "color2", label: "White to", default: "#4f8fcb" },
    ],
    compat: shaderCompat(),
  },
  "color-overlay": {
    type: "color-overlay",
    label: "Fill",
    category: "Color Correction",
    description: "Replaces the layer's colour with a solid fill.",
    params: [{ key: "alpha", label: "Opacity", default: 100, min: 0, max: 100, unit: "%" }],
    colors: [{ field: "color", label: "Colour", default: "#4f8fcb" }],
    compat: { mp4: MP4_FULL, lottie: { level: "partial", note: "Approximate fill." }, css: CSS_NO },
  },

  /* ---------------- Stylize / Distort ---------------- */
  "rgb-split": {
    type: "rgb-split",
    label: "Chromatic Aberration",
    category: "Stylize",
    description: "Splits the RGB channels for a fringe effect.",
    params: [{ key: "amount", label: "Amount", default: 8, min: 0, max: 40 }],
    compat: shaderCompat(),
  },
  glitch: {
    type: "glitch",
    label: "Glitch",
    category: "Stylize",
    description: "Sliced, offset, RGB-split digital glitch.",
    params: [
      { key: "slices", label: "Slices", default: 6, min: 2, max: 30, step: 1 },
      { key: "offset", label: "Offset", default: 80, min: 0, max: 400 },
    ],
    compat: shaderCompat(),
  },
  crt: {
    type: "crt",
    label: "CRT",
    category: "Stylize",
    description: "Scanlines, curvature, noise & vignette.",
    params: [
      { key: "curvature", label: "Curvature", default: 1, min: 0, max: 10, step: 0.1 },
      { key: "lineWidth", label: "Line width", default: 1, min: 0, max: 5, step: 0.1 },
      { key: "noise", label: "Noise", default: 0.2, min: 0, max: 1, step: 0.01 },
      { key: "vignetting", label: "Vignette", default: 0.3, min: 0, max: 0.5, step: 0.01 },
    ],
    compat: shaderCompat(),
    timeDriven: true,
  },
  "old-film": {
    type: "old-film",
    label: "Old Film",
    category: "Stylize",
    description: "Sepia, grain, scratches & vignette.",
    params: [
      { key: "sepia", label: "Sepia", default: 0.3, min: 0, max: 1, step: 0.01 },
      { key: "noise", label: "Grain", default: 0.3, min: 0, max: 1, step: 0.01 },
      { key: "scratch", label: "Scratches", default: 0.5, min: -1, max: 1, step: 0.01 },
      { key: "vignetting", label: "Vignette", default: 0.3, min: 0, max: 0.5, step: 0.01 },
    ],
    compat: shaderCompat(),
    timeDriven: true,
  },
  pixelate: {
    type: "pixelate",
    label: "Pixelate",
    category: "Stylize",
    description: "Mosaic blocks.",
    params: [{ key: "size", label: "Block size", default: 10, min: 1, max: 100, step: 1 }],
    compat: shaderCompat(),
  },
  dot: {
    type: "dot",
    label: "Halftone",
    category: "Stylize",
    description: "Halftone dot pattern.",
    params: [
      { key: "scale", label: "Scale", default: 1, min: 0.3, max: 5, step: 0.1 },
      { key: "angle", label: "Angle", default: 5, min: 0, max: 90, unit: "°" },
    ],
    compat: shaderCompat(),
  },
  vignette: {
    type: "vignette",
    label: "Vignette",
    category: "Stylize",
    description: "Darkens the edges of the frame.",
    params: [
      { key: "amount", label: "Amount", default: 0.4, min: 0, max: 0.5, step: 0.01 },
      { key: "blur", label: "Softness", default: 0.3, min: 0, max: 0.5, step: 0.01 },
    ],
    compat: shaderCompat(),
  },
  "bulge-pinch": {
    type: "bulge-pinch",
    label: "Bulge / Pinch",
    category: "Distort",
    description: "Spherise or pinch around a centre.",
    params: [
      { key: "strength", label: "Strength", default: 0.5, min: -1, max: 1, step: 0.01 },
      { key: "radius", label: "Radius", default: 200, min: 10, max: 1000 },
    ],
    compat: shaderCompat(),
  },
  twist: {
    type: "twist",
    label: "Twirl",
    category: "Distort",
    description: "Rotates pixels around a centre — a twirl.",
    params: [
      { key: "angle", label: "Angle", default: 4, min: -20, max: 20, step: 0.1 },
      { key: "radius", label: "Radius", default: 200, min: 10, max: 1000 },
    ],
    compat: shaderCompat(),
  },
};

export const EFFECT_LIST = Object.values(EFFECTS);

export const EFFECT_CATEGORIES = Array.from(
  new Set(EFFECT_LIST.map((e) => e.category)),
);

export function effectDef(type: EffectType): EffectDef {
  return EFFECTS[type];
}

/** Per-target compatibility headline for a catalog effect. */
export function effectCompat(type: EffectType, target: ExportTarget) {
  return EFFECTS[type].compat[target];
}
