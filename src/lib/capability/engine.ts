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
import {
  FEATURE_MATRIX,
  lookup,
  worse,
  type FeatureKey,
} from "@/lib/capability/matrix";

export interface Finding {
  /** Which feature triggered this (matrix key). */
  feature: FeatureKey;
  level: CompatLevel;
  /** Short human label, e.g. "Glow", "Gradient fill", "Multiply blend". */
  label: string;
  note?: string;
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

/** Collect the (feature, label) pairs a single layer exercises. */
function layerFeatures(layer: Layer): Array<{ feature: FeatureKey; label: string }> {
  const feats: Array<{ feature: FeatureKey; label: string }> = [
    { feature: "transform", label: "Transform" },
  ];

  if (layer.type === "shape" && layer.shape) {
    feats.push({ feature: "shape", label: "Shape" });
    if (layer.shape.fill.gradient) {
      feats.push({ feature: "gradientFill", label: "Gradient fill" });
    }
    if (layer.shape.stroke) {
      feats.push({ feature: "stroke", label: "Stroke" });
    }
  }
  if (layer.type === "text") {
    feats.push({ feature: "text", label: "Text" });
  }
  if (layer.type === "image") {
    feats.push({ feature: "image", label: "Image" });
  }

  if (layer.blendMode !== "normal") {
    feats.push({
      feature: "blendMode",
      label: `${cap(layer.blendMode)} blend`,
    });
  }

  for (const effect of layer.effects) {
    if (!effect.enabled) continue;
    const key = `effect.${effect.type}` as FeatureKey;
    if (FEATURE_MATRIX[key]) {
      feats.push({ feature: key, label: cap(effect.type) });
    }
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

      for (const { feature, label } of layerFeatures(layer)) {
        const compat = lookup(feature, target);
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
  for (const { feature } of layerFeatures(layer)) {
    level = worse(level, lookup(feature, target).level);
  }
  return level;
}
