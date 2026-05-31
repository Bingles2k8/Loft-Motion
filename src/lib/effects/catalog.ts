/**
 * Loft Motion — effects catalog.
 *
 * The browseable list backing the Effects panel. Each entry pairs an effect
 * type with a category, description and its export-compatibility headline so the
 * panel can warn before a user even applies it.
 */
import type { EffectType, ExportTarget } from "@/lib/scene/schema";
import { lookup, type FeatureKey } from "@/lib/capability/matrix";

export interface EffectCatalogEntry {
  type: EffectType;
  label: string;
  category: string;
  description: string;
}

export const EFFECT_CATALOG: EffectCatalogEntry[] = [
  {
    type: "blur",
    label: "Gaussian Blur",
    category: "Blur & Sharpen",
    description: "Softens the layer. Rich in MP4; dropped by Lottie.",
  },
  {
    type: "glow",
    label: "Glow",
    category: "Stylize",
    description: "Adds a luminous halo. MP4 only — it's a shader effect.",
  },
  {
    type: "drop-shadow",
    label: "Drop Shadow",
    category: "Perspective",
    description: "Casts a soft offset shadow. Survives CSS cleanly.",
  },
];

export const EFFECT_CATEGORIES = Array.from(
  new Set(EFFECT_CATALOG.map((e) => e.category)),
);

/** Per-target compatibility headline for a catalog effect. */
export function effectCompat(type: EffectType, target: ExportTarget) {
  return lookup(`effect.${type}` as FeatureKey, target);
}
