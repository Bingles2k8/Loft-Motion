/**
 * Loft Motion — capability engine.
 *
 * A pure module: scene document in, per-target reports out. The UI surfaces
 * this live (per-layer badges + a pre-export summary). This is the honesty
 * layer — Loft Motion must never produce a broken export silently (§7).
 */
import {
  EXPORT_TARGETS,
  type CompatLevel,
  type ExportTarget,
  type Layer,
  type SceneDocument,
} from "@/lib/scene/schema";
import { lookup, worse, type FeatureKey } from "@/lib/capability/matrix";
import { effectCompat, effectDef } from "@/lib/effects/catalog";

export interface Finding {
  /** Stable identifier for the feature that triggered this. */
  feature: string;
  level: CompatLevel;
  /** Short human label, e.g. "Glow", "Gradient fill", "Multiply blend". */
  label: string;
  note?: string;
}

/** A feature a layer exercises, with a per-target compat resolver. */
interface FeatureUse {
  feature: string;
  label: string;
  compatFor: (target: ExportTarget) => { level: CompatLevel; note?: string };
}

export interface LayerReport {
  layerId: string;
  layerName: string;
  /** Worst compatibility across all of this layer's features for the target. */
  level: CompatLevel;
  findings: Finding[];
}

export interface TargetReport {
  target: ExportTarget;
  /** Worst compatibility across the whole scene for this target. */
  level: CompatLevel;
  layers: LayerReport[];
  /** Flat list of everything that degrades or drops, for the summary panel. */
  issues: Array<Finding & { layerName: string }>;
}

export type CapabilityReport = Record<ExportTarget, TargetReport>;

/** A feature whose compat comes from the static matrix. */
function matrixFeature(feature: FeatureKey, label: string): FeatureUse {
  return { feature, label, compatFor: (target) => lookup(feature, target) };
}

/** Collect the features (with per-target compat) a single layer exercises. */
function layerFeatures(layer: Layer): FeatureUse[] {
  const feats: FeatureUse[] = [matrixFeature("transform", "Transform")];

  if (layer.type === "shape" && layer.shape) {
    feats.push(matrixFeature("shape", "Shape"));
    if (layer.shape.fill.gradient) {
      feats.push(matrixFeature("gradientFill", "Gradient fill"));
    }
    if (layer.shape.stroke) {
      feats.push(matrixFeature("stroke", "Stroke"));
    }
    if (layer.shape.trim?.enabled) {
      feats.push(matrixFeature("trim", "Trim paths"));
    }
  }
  if (layer.type === "text") feats.push(matrixFeature("text", "Text"));
  if (layer.type === "image") feats.push(matrixFeature("image", "Image"));

  if (layer.blendMode !== "normal") {
    feats.push(matrixFeature("blendMode", `${cap(layer.blendMode)} blend`));
  }
  if (layer.masks.length > 0) feats.push(matrixFeature("mask", "Mask"));
  if (layer.matte !== "none") feats.push(matrixFeature("matte", "Track matte"));

  // Effects resolve their compat from the effects catalog (single source).
  for (const effect of layer.effects) {
    if (!effect.enabled) continue;
    feats.push({
      feature: `effect.${effect.type}`,
      label: effectDef(effect.type).label,
      compatFor: (target) => effectCompat(effect.type, target),
    });
  }

  return feats;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

/** Analyse a scene and return a per-target capability report. */
export function analyzeScene(scene: SceneDocument): CapabilityReport {
  const report = {} as CapabilityReport;

  for (const target of EXPORT_TARGETS) {
    const layerReports: LayerReport[] = [];
    const issues: Array<Finding & { layerName: string }> = [];
    let sceneLevel: CompatLevel = "full";

    for (const layer of scene.layers) {
      const findings: Finding[] = [];
      let layerLevel: CompatLevel = "full";

      for (const { feature, label, compatFor } of layerFeatures(layer)) {
        const compat = compatFor(target);
        const finding: Finding = {
          feature,
          label,
          level: compat.level,
          note: compat.note,
        };
        findings.push(finding);
        layerLevel = worse(layerLevel, compat.level);
        if (compat.level !== "full") {
          issues.push({ ...finding, layerName: layer.name });
        }
      }

      sceneLevel = worse(sceneLevel, layerLevel);
      layerReports.push({
        layerId: layer.id,
        layerName: layer.name,
        level: layerLevel,
        findings,
      });
    }

    report[target] = {
      target,
      level: sceneLevel,
      layers: layerReports,
      issues,
    };
  }

  return report;
}

/** Convenience: the compat level of one layer for one target. */
export function layerLevelFor(
  layer: Layer,
  target: ExportTarget,
): CompatLevel {
  let level: CompatLevel = "full";
  for (const { compatFor } of layerFeatures(layer)) {
    level = worse(level, compatFor(target).level);
  }
  return level;
}
