/**
 * Loft Motion — viewport transform math.
 *
 * Maps between comp space (the composition's pixel grid) and screen space (the
 * displayed canvas), and resolves a layer's transformed bounding-box corners so
 * the viewport overlay can draw handles and hit-test drags. The drag math
 * (move / scale / rotate about the anchor) lives in ViewportOverlay; this module
 * supplies the geometry it needs.
 */
import { evalTransform } from "@/lib/anim/evaluate";
import type { Layer } from "@/lib/scene/schema";

export interface Vec2 {
  x: number;
  y: number;
}

/** The pixel size of a layer's content box, before transform. */
export function layerSize(layer: Layer): Vec2 {
  if (layer.type === "shape" && layer.shape)
    return { x: layer.shape.width, y: layer.shape.height };
  if (layer.type === "image" && layer.image)
    return { x: layer.image.naturalWidth, y: layer.image.naturalHeight };
  if (layer.type === "text" && layer.text) {
    // Rough estimate — text has no stored box; approximate from font metrics.
    const w = layer.text.content.length * layer.text.fontSize * 0.55;
    return { x: w, y: layer.text.fontSize * 1.2 };
  }
  return { x: 100, y: 100 };
}

export interface ResolvedBox {
  /** Anchor position in comp space (== Position). */
  anchor: Vec2;
  /** The four transformed corners in comp space (TL, TR, BR, BL). */
  corners: [Vec2, Vec2, Vec2, Vec2];
  /** Edge midpoints in comp space (top, right, bottom, left). */
  edges: [Vec2, Vec2, Vec2, Vec2];
  rotation: number; // radians
  size: Vec2;
  scale: Vec2; // fraction (1 = 100%)
}

function rotate(p: Vec2, rad: number): Vec2 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Resolve a layer's box (corners/edges/anchor) in comp space at time `t`. */
export function resolveBox(layer: Layer, t: number): ResolvedBox {
  const tf = evalTransform(layer.transform, t);
  const size = layerSize(layer);
  const scale = { x: tf.scaleX / 100, y: tf.scaleY / 100 };
  const rad = (tf.rotation * Math.PI) / 180;
  const anchor = { x: tf.x, y: tf.y };
  // Anchor in local px.
  const aLocal = { x: tf.anchorX * size.x, y: tf.anchorY * size.y };

  // Map a local-space point to comp space.
  const toComp = (lx: number, ly: number): Vec2 => {
    const rel = { x: (lx - aLocal.x) * scale.x, y: (ly - aLocal.y) * scale.y };
    const r = rotate(rel, rad);
    return { x: anchor.x + r.x, y: anchor.y + r.y };
  };

  const corners: [Vec2, Vec2, Vec2, Vec2] = [
    toComp(0, 0),
    toComp(size.x, 0),
    toComp(size.x, size.y),
    toComp(0, size.y),
  ];
  const edges: [Vec2, Vec2, Vec2, Vec2] = [
    toComp(size.x / 2, 0),
    toComp(size.x, size.y / 2),
    toComp(size.x / 2, size.y),
    toComp(0, size.y / 2),
  ];

  return { anchor, corners, edges, rotation: rad, size, scale };
}

/** Is comp-space point `p` inside the layer's transformed box? */
export function hitTest(layer: Layer, t: number, p: Vec2): boolean {
  const tf = evalTransform(layer.transform, t);
  const size = layerSize(layer);
  const scale = { x: tf.scaleX / 100, y: tf.scaleY / 100 };
  const rad = (tf.rotation * Math.PI) / 180;
  const aLocal = { x: tf.anchorX * size.x, y: tf.anchorY * size.y };
  // Inverse-map p into local space.
  const rel = { x: p.x - tf.x, y: p.y - tf.y };
  const unrot = rotate(rel, -rad);
  const local = {
    x: unrot.x / (scale.x || 1e-6) + aLocal.x,
    y: unrot.y / (scale.y || 1e-6) + aLocal.y,
  };
  return local.x >= 0 && local.x <= size.x && local.y >= 0 && local.y <= size.y;
}
