/**
 * Loft Motion — Cloner geometry (per-layer Duplicator).
 *
 * Produces the list of per-clone transforms for a layer's cloner. Pure
 * functions; the renderer turns each into a Pixi display object and the
 * behavior engine cascades using each clone's `index`.
 */
import type { Cloner } from "@/lib/scene/schema";

export interface CloneTransform {
  index: number;
  dx: number; // position offset (comp px) from the layer's base position
  dy: number;
  rotation: number; // additive degrees
  scaleMul: number; // multiplier (1 = 100%)
  opacityMul: number; // multiplier (1 = full)
}

export function clonerTransforms(c: Cloner): CloneTransform[] {
  const out: CloneTransform[] = [];
  const push = (i: number, dx: number, dy: number, baseRot = 0) => {
    out.push({
      index: i,
      dx,
      dy,
      rotation: baseRot + c.stepRotation * i,
      scaleMul: 1 + (c.stepScale / 100) * i,
      opacityMul: Math.max(0, 1 + (c.stepOpacity / 100) * i),
    });
  };

  if (c.mode === "grid") {
    const cols = Math.max(1, c.cols);
    const rows = Math.max(1, c.rows);
    const w = (cols - 1) * c.spacingX;
    const h = (rows - 1) * c.spacingY;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        push(i++, col * c.spacingX - w / 2, r * c.spacingY - h / 2);
      }
    }
  } else if (c.mode === "radial") {
    const count = Math.max(1, c.count);
    for (let i = 0; i < count; i++) {
      const aDeg = c.startAngle + (360 / count) * i;
      const a = (aDeg * Math.PI) / 180;
      push(i, Math.cos(a) * c.radius, Math.sin(a) * c.radius, c.faceOut ? aDeg + 90 : 0);
    }
  } else {
    // line
    const count = Math.max(1, c.count);
    const w = (count - 1) * c.spacingX;
    for (let i = 0; i < count; i++) {
      push(i, i * c.spacingX - w / 2, 0);
    }
  }
  return out;
}

/** Total clone count for a cloner config (for behavior cascade context). */
export function cloneCount(c: Cloner): number {
  if (c.mode === "grid") return Math.max(1, c.cols) * Math.max(1, c.rows);
  return Math.max(1, c.count);
}
