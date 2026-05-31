/**
 * Loft Motion — Lottie / bodymovin JSON exporter (best-effort).
 *
 * Serialises transforms and basic shapes/text/images to bodymovin JSON. The
 * capability engine runs first; unsupported effects (blur/glow) are dropped with
 * an explicit notice rather than producing a silently-broken file (§3.5, §7).
 *
 * Named easings map to Lottie's per-keyframe bezier handles (o = out tangent,
 * i = in tangent) so "Settle" looks the same in a Lottie player as on canvas.
 */
import { evalAnimatable, isAnimated, keyframeBezier } from "@/lib/anim/evaluate";
import { analyzeScene } from "@/lib/capability/engine";
import type {
  Animatable,
  Layer,
  SceneDocument,
  ShapePayload,
} from "@/lib/scene/schema";

/* eslint-disable @typescript-eslint/no-explicit-any */

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Lottie scalar property (split-position component, opacity, rotation…). */
function scalarProp(ch: Animatable, fps: number): any {
  if (!isAnimated(ch)) return { a: 0, k: ch.value };
  const k = ch.keyframes.map((kf, i, arr) => {
    const node: any = { t: round(kf.time * fps), s: [kf.value] };
    if (i < arr.length - 1) {
      const [x1, y1, x2, y2] = keyframeBezier(kf);
      node.o = { x: [x1], y: [y1] };
      node.i = { x: [x2], y: [y2] };
    }
    return node;
  });
  return { a: 1, k };
}

/** Lottie 2-D property built from two scalar channels (scale, anchor). */
function vec2Prop(
  chx: Animatable,
  chy: Animatable,
  fps: number,
  scale = 1,
): any {
  if (!isAnimated(chx) && !isAnimated(chy)) {
    return { a: 0, k: [chx.value * scale, chy.value * scale] };
  }
  const times = unionTimes(chx, chy);
  const k = times.map((t, i) => {
    const node: any = {
      t: round(t * fps),
      s: [evalAnimatable(chx, t) * scale, evalAnimatable(chy, t) * scale],
    };
    if (i < times.length - 1) {
      const [x1, y1, x2, y2] = segmentBezierAt(chx, t) ??
        segmentBezierAt(chy, t) ?? [0.33, 0, 0.67, 1];
      node.o = { x: [x1, x1], y: [y1, y1] };
      node.i = { x: [x2, x2], y: [y2, y2] };
    }
    return node;
  });
  return { a: 1, k };
}

function unionTimes(a: Animatable, b: Animatable): number[] {
  const set = new Set<number>();
  for (const k of a.keyframes) set.add(k.time);
  for (const k of b.keyframes) set.add(k.time);
  if (set.size === 0) set.add(0);
  return [...set].sort((x, y) => x - y);
}

function segmentBezierAt(
  ch: Animatable,
  t: number,
): [number, number, number, number] | null {
  const kf = ch.keyframes.find((k) => Math.abs(k.time - t) < 1e-4);
  return kf ? keyframeBezier(kf) : null;
}

function shapeItems(layer: Layer, shape: ShapePayload): any[] {
  const items: any[] = [];
  switch (shape.kind) {
    case "rect":
      items.push({
        ty: "rc",
        p: { a: 0, k: [shape.width / 2, shape.height / 2] },
        s: { a: 0, k: [shape.width, shape.height] },
        r: { a: 0, k: shape.cornerRadius },
      });
      break;
    case "ellipse":
      items.push({
        ty: "el",
        p: { a: 0, k: [shape.width / 2, shape.height / 2] },
        s: { a: 0, k: [shape.width, shape.height] },
      });
      break;
    case "polygon":
    case "star":
      items.push({
        ty: "sr",
        sy: shape.kind === "star" ? 1 : 2,
        p: { a: 0, k: [shape.width / 2, shape.height / 2] },
        pt: { a: 0, k: shape.points },
        r: { a: 0, k: 0 },
        ir: { a: 0, k: Math.min(shape.width, shape.height) / 4 },
        or: { a: 0, k: Math.min(shape.width, shape.height) / 2 },
        is: { a: 0, k: 0 },
        os: { a: 0, k: 0 },
      });
      break;
  }

  if (shape.stroke && shape.stroke.width > 0) {
    items.push({
      ty: "st",
      c: { a: 0, k: rgb(shape.stroke.color) },
      o: { a: 0, k: 100 },
      w: { a: 0, k: shape.stroke.width },
      lc: 2,
      lj: 2,
    });
  }
  items.push({
    ty: "fl",
    c: { a: 0, k: rgb(shape.fill.color) },
    o: { a: 0, k: 100 },
  });
  // Group transform (identity — layer transform handles placement).
  items.push({
    ty: "tr",
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  });
  return items;
}

function layerBounds(layer: Layer): { w: number; h: number } {
  if (layer.type === "shape" && layer.shape)
    return { w: layer.shape.width, h: layer.shape.height };
  if (layer.type === "image" && layer.image)
    return { w: layer.image.naturalWidth, h: layer.image.naturalHeight };
  if (layer.type === "text" && layer.text)
    return { w: 0, h: 0 }; // text anchored at baseline; keep simple
  return { w: 0, h: 0 };
}

function buildTransform(layer: Layer, fps: number): any {
  const t = layer.transform;
  const { w, h } = layerBounds(layer);
  return {
    o: { ...scalarProp(t.opacity, fps) }, // 0..100
    r: scalarProp(t.rotation, fps),
    p: {
      s: true,
      x: scalarProp(t.x, fps),
      y: scalarProp(t.y, fps),
    },
    a: { a: 0, k: [t.anchorX.value * w, t.anchorY.value * h] },
    s: vec2Prop(t.scaleX, t.scaleY, fps),
  };
}

export interface LottieExport {
  json: any;
  warnings: string[];
}

export function exportLottie(scene: SceneDocument): LottieExport {
  const fps = scene.composition.fps;
  const op = round(scene.composition.duration * fps);
  const report = analyzeScene(scene).lottie;
  const warnings = report.issues.map(
    (i) => `${i.layerName}: ${i.label} — ${i.note ?? i.level}`,
  );

  const assets: any[] = [];
  const layers: any[] = [];

  // Lottie draws index 0 on TOP, so reverse our bottom-up order.
  scene.layers.forEach((layer, idx) => {
    const ind = idx + 1;
    const inFrame = round(layer.timing.start * fps);
    const outFrame = round(layer.timing.end * fps);
    const common = {
      nm: layer.name,
      ind,
      ip: inFrame,
      op: outFrame || op,
      st: 0,
      sr: 1,
      bm: 0,
      ks: buildTransform(layer, fps),
    };

    if (layer.type === "shape" && layer.shape) {
      layers.push({
        ...common,
        ty: 4,
        shapes: [{ ty: "gr", nm: layer.name, it: shapeItems(layer, layer.shape) }],
      });
    } else if (layer.type === "image" && layer.image) {
      const refId = `image_${idx}`;
      assets.push({
        id: refId,
        w: layer.image.naturalWidth,
        h: layer.image.naturalHeight,
        u: "",
        p: layer.image.src,
        e: 1,
      });
      layers.push({ ...common, ty: 2, refId });
    } else if (layer.type === "text" && layer.text) {
      layers.push({
        ...common,
        ty: 5,
        t: {
          d: {
            k: [
              {
                t: 0,
                s: {
                  s: layer.text.fontSize,
                  f: "LoftFont",
                  t: layer.text.content,
                  j: layer.text.align === "center" ? 2 : layer.text.align === "right" ? 1 : 0,
                  tr: layer.text.letterSpacing,
                  lh: layer.text.fontSize * 1.2,
                  ls: 0,
                  fc: rgb(layer.text.fill),
                },
              },
            ],
          },
          p: {},
          m: { g: 1, a: { a: 0, k: [0, 0] } },
          a: [],
        },
      });
    }
  });

  // Reverse so our bottom-most layer renders behind in Lottie.
  layers.reverse();

  const json = {
    v: "5.7.4",
    fr: fps,
    ip: 0,
    op,
    w: scene.composition.width,
    h: scene.composition.height,
    nm: scene.name,
    ddd: 0,
    assets,
    layers,
    fonts: scene.layers.some((l) => l.type === "text")
      ? {
          list: [
            {
              fName: "LoftFont",
              fFamily: "Inter",
              fStyle: "Bold",
              fWeight: "700",
              origin: 0,
            },
          ],
        }
      : undefined,
  };

  return { json, warnings };
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
