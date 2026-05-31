/**
 * Loft Motion — explicit 2D affine matrices for parenting.
 *
 * We compose layer world transforms ourselves (rather than leaning on Pixi's
 * container nesting) so that parenting inherits TRANSFORM ONLY — not opacity or
 * blend mode — matching After Effects' parenting model. Convention: a matrix M
 * maps a local point p to world via `M·p`, and child world = parentWorld · childLocal.
 */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/** m1 · m2 (apply m2 first, then m1). */
export function mul(m1: Affine, m2: Affine): Affine {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

export interface LocalTransform {
  x: number;
  y: number;
  rotation: number; // radians
  scaleX: number;
  scaleY: number;
  pivotX: number; // local px
  pivotY: number;
}

/**
 * Build a layer's local matrix: world = T(pos) · R · S · T(-pivot).
 * (so the pivot point maps to the layer's position, and rotation/scale happen
 * about the pivot — exactly the anchor-point behaviour.)
 */
export function localMatrix(t: LocalTransform): Affine {
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  // R·S
  const a = cos * t.scaleX;
  const b = sin * t.scaleX;
  const c = -sin * t.scaleY;
  const d = cos * t.scaleY;
  // translation = pos − (R·S)·pivot
  return {
    a,
    b,
    c,
    d,
    tx: t.x - (a * t.pivotX + c * t.pivotY),
    ty: t.y - (b * t.pivotX + d * t.pivotY),
  };
}
