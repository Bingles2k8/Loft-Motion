/**
 * Loft Motion — path geometry for Trim Paths & dashed strokes.
 *
 * Produces a closed polyline outline for a shape, plus helpers to extract a
 * trimmed sub-path (start/end %, offset) and to split a polyline into dashes.
 * Used by the renderer to draw "draw-on" stroke animation.
 */
import type { ShapePayload } from "@/lib/scene/schema";

export type Pt = [number, number];

/** Build a closed outline polyline (comp-local px) for a shape. */
export function shapeOutline(shape: ShapePayload, segs = 64): Pt[] {
  const { width: w, height: h } = shape;
  const pts: Pt[] = [];
  switch (shape.kind) {
    case "ellipse": {
      const rx = w / 2;
      const ry = h / 2;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push([w / 2 + Math.cos(a) * rx, h / 2 + Math.sin(a) * ry]);
      }
      break;
    }
    case "polygon":
    case "star": {
      const n = shape.points;
      const cx = w / 2;
      const cy = h / 2;
      const outer = Math.min(w, h) / 2;
      const inner = outer / 2;
      const count = shape.kind === "star" ? n * 2 : n;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 - Math.PI / 2;
        const r = shape.kind === "star" && i % 2 === 1 ? inner : outer;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      break;
    }
    case "rect":
    default: {
      const r = Math.min(shape.cornerRadius, w / 2, h / 2);
      if (r > 0) {
        // Rounded rect: corners as arcs.
        const corner = (cx: number, cy: number, a0: number) => {
          const q = Math.max(2, Math.round(segs / 8));
          for (let i = 0; i <= q; i++) {
            const a = a0 + (i / q) * (Math.PI / 2);
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
        };
        corner(w - r, r, -Math.PI / 2); // top-right
        corner(w - r, h - r, 0); // bottom-right
        corner(r, h - r, Math.PI / 2); // bottom-left
        corner(r, r, Math.PI); // top-left
      } else {
        pts.push([0, 0], [w, 0], [w, h], [0, h]);
      }
      break;
    }
  }
  return pts;
}

function lengthOf(pts: Pt[], closed: boolean): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += dist(pts[i], pts[i + 1]);
  if (closed && pts.length > 1) len += dist(pts[pts.length - 1], pts[0]);
  return len;
}
function dist(a: Pt, b: Pt) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Resample a closed polyline at a given arc-length distance → point. */
function pointAt(pts: Pt[], target: number): Pt {
  const n = pts.length;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const seg = dist(a, b);
    if (acc + seg >= target) {
      const f = seg === 0 ? 0 : (target - acc) / seg;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    acc += seg;
  }
  return pts[0];
}

/**
 * Extract the trimmed sub-path between start% and end% (0..100), rotated by
 * `offsetDeg` of travel around the closed path. Returns a polyline (open).
 */
export function trimPath(
  pts: Pt[],
  startPct: number,
  endPct: number,
  offsetDeg = 0,
): Pt[] {
  if (pts.length < 2) return pts;
  const total = lengthOf(pts, true);
  if (total <= 0) return pts;
  const offset = (offsetDeg / 360) * total;
  let s = (Math.min(startPct, endPct) / 100) * total + offset;
  let e = (Math.max(startPct, endPct) / 100) * total + offset;
  const span = e - s;
  if (span <= 0) return [];
  // Walk in fine steps to build the sub-path (robust + simple).
  const out: Pt[] = [];
  const steps = Math.max(2, Math.round((span / total) * 256));
  for (let i = 0; i <= steps; i++) {
    const d = s + (span * i) / steps;
    out.push(pointAt(pts, ((d % total) + total) % total));
  }
  void e;
  void s;
  return out;
}

/** Split a polyline into visible dash segments given dash/gap lengths. */
export function dashPolyline(pts: Pt[], dash: number, gap: number): Pt[][] {
  if (dash <= 0) return [pts];
  const g = gap > 0 ? gap : dash;
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let drawn = 0;
  let on = true;
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i];
    const b = pts[i + 1];
    let segLen = dist(a, b);
    while (segLen > 0) {
      const remain = (on ? dash : g) - drawn;
      if (remain >= segLen) {
        if (on) {
          if (cur.length === 0) cur.push(a);
          cur.push(b);
        }
        drawn += segLen;
        segLen = 0;
      } else {
        const f = remain / segLen;
        const mid: Pt = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        if (on) {
          if (cur.length === 0) cur.push(a);
          cur.push(mid);
          out.push(cur);
          cur = [];
        }
        a = mid;
        segLen -= remain;
        drawn = 0;
        on = !on;
      }
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
