/**
 * Loft Motion — align & distribute helpers (Figma/AE-style).
 *
 * Operates on a layer's static Position. Uses each layer's transformed bounds
 * (position + size + scale) to align edges/centres or distribute spacing. For
 * keyframed positions we adjust the static `value` of x/y; if x/y is animated
 * this still nudges the base, which is the pragmatic behaviour.
 */
import { layerSize } from "@/lib/render/viewport";
import { evalAnimatable } from "@/lib/anim/evaluate";
import type { Layer } from "@/lib/scene/schema";

export type AlignOp =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "centerY"
  | "bottom";
export type DistributeOp = "horizontal" | "vertical";

interface Box {
  layer: Layer;
  cx: number; // current centre (comp px)
  cy: number;
  w: number; // transformed half-extents
  h: number;
}

function box(layer: Layer): Box {
  const t = layer.transform;
  const cx = evalAnimatable(t.x, 0);
  const cy = evalAnimatable(t.y, 0);
  const size = layerSize(layer);
  const sx = evalAnimatable(t.scaleX, 0) / 100;
  const sy = evalAnimatable(t.scaleY, 0) / 100;
  return { layer, cx, cy, w: (size.x * sx) / 2, h: (size.y * sy) / 2 };
}

/** Compute new {x,y} centre for each layer after an align op. Returns a map. */
export function computeAlign(
  layers: Layer[],
  op: AlignOp,
): Map<string, { x?: number; y?: number }> {
  const boxes = layers.map(box);
  const out = new Map<string, { x?: number; y?: number }>();
  if (boxes.length === 0) return out;

  const minLeft = Math.min(...boxes.map((b) => b.cx - b.w));
  const maxRight = Math.max(...boxes.map((b) => b.cx + b.w));
  const minTop = Math.min(...boxes.map((b) => b.cy - b.h));
  const maxBottom = Math.max(...boxes.map((b) => b.cy + b.h));
  const midX = (minLeft + maxRight) / 2;
  const midY = (minTop + maxBottom) / 2;

  for (const b of boxes) {
    switch (op) {
      case "left":
        out.set(b.layer.id, { x: minLeft + b.w });
        break;
      case "right":
        out.set(b.layer.id, { x: maxRight - b.w });
        break;
      case "centerX":
        out.set(b.layer.id, { x: midX });
        break;
      case "top":
        out.set(b.layer.id, { y: minTop + b.h });
        break;
      case "bottom":
        out.set(b.layer.id, { y: maxBottom - b.h });
        break;
      case "centerY":
        out.set(b.layer.id, { y: midY });
        break;
    }
  }
  return out;
}

/** Distribute layers to equalise gaps along an axis (needs 3+ layers). */
export function computeDistribute(
  layers: Layer[],
  op: DistributeOp,
): Map<string, { x?: number; y?: number }> {
  const out = new Map<string, { x?: number; y?: number }>();
  if (layers.length < 3) return out;
  const boxes = layers.map(box);

  if (op === "horizontal") {
    boxes.sort((a, b) => a.cx - b.cx);
    const first = boxes[0];
    const last = boxes[boxes.length - 1];
    const span = last.cx - first.cx;
    const step = span / (boxes.length - 1);
    boxes.forEach((b, i) => {
      if (i === 0 || i === boxes.length - 1) return;
      out.set(b.layer.id, { x: first.cx + step * i });
    });
  } else {
    boxes.sort((a, b) => a.cy - b.cy);
    const first = boxes[0];
    const last = boxes[boxes.length - 1];
    const span = last.cy - first.cy;
    const step = span / (boxes.length - 1);
    boxes.forEach((b, i) => {
      if (i === 0 || i === boxes.length - 1) return;
      out.set(b.layer.id, { y: first.cy + step * i });
    });
  }
  return out;
}
