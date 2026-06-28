/**
 * Channel path helpers — resolve dotted paths like "transform.x" or
 * "effects.<id>.params.strength" to the live Animatable on a layer. Shared by
 * the timeline (keyframe lanes) and the properties panel.
 */
import type { Animatable, Layer } from "@/lib/scene/schema";
import { effectDef } from "@/lib/effects/catalog";

export interface ChannelDef {
  path: string;
  label: string;
  /** Suffix shown in the UI, e.g. "px", "°", "%". */
  unit?: string;
  /** Optional clamp + step hints for sliders. */
  min?: number;
  max?: number;
  step?: number;
}

/** The transform channels surfaced as keyframe lanes (anchor stays advanced). */
export const TRANSFORM_CHANNELS: ChannelDef[] = [
  { path: "transform.x", label: "Position X", unit: "px" },
  { path: "transform.y", label: "Position Y", unit: "px" },
  { path: "transform.scaleX", label: "Scale X", unit: "%", min: 0, step: 1 },
  { path: "transform.scaleY", label: "Scale Y", unit: "%", min: 0, step: 1 },
  { path: "transform.rotation", label: "Rotation", unit: "°", step: 1 },
  { path: "transform.opacity", label: "Opacity", unit: "%", min: 0, max: 100, step: 1 },
];

/** Resolve a dotted path to the Animatable it points at (or null). */
export function getChannel(layer: Layer, path: string): Animatable | null {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = layer;
  for (const p of parts) {
    if (node == null) return null;
    node = Array.isArray(node)
      ? node.find((e: { id: string }) => e.id === p)
      : node[p];
  }
  if (node && Array.isArray(node.keyframes)) return node as Animatable;
  return null;
}

/** Trim-path channels (draw-on) — surfaced as lanes only when trim is on. */
export function trimChannels(layer: Layer): ChannelDef[] {
  if (!layer.shape?.trim?.enabled) return [];
  return [
    { path: "shape.trim.start", label: "Trim Start", unit: "%", min: 0, max: 100 },
    { path: "shape.trim.end", label: "Trim End", unit: "%", min: 0, max: 100 },
    { path: "shape.trim.offset", label: "Trim Offset", unit: "°" },
  ];
}

/** Effect param channels for a layer, for the deep timeline + properties. */
export function effectChannels(layer: Layer): ChannelDef[] {
  const defs: ChannelDef[] = [];
  for (const fx of layer.effects) {
    const def = effectDef(fx.type);
    for (const key of Object.keys(fx.params)) {
      const pdef = def.params.find((p) => p.key === key);
      defs.push({
        path: `effects.${fx.id}.params.${key}`,
        label: `${def.label} · ${pdef?.label ?? key}`,
        unit: pdef?.unit,
        min: pdef?.min,
        max: pdef?.max,
        step: pdef?.step,
      });
    }
  }
  return defs;
}
