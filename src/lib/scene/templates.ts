/**
 * Loft Motion — Templates.
 *
 * Finished, multi-layer projects you can open and tinker with — the impressive
 * end of the gallery (vs the single-trick "building blocks" in examples.ts).
 * Each is a fully choreographed scene built on the real schema: keyframed
 * transforms with named easings, kinetic type, cloners, behaviors and effects.
 *
 * A small builder toolkit keeps each project readable; everything it produces is
 * a plain SceneDocument that round-trips through the Zod schema unchanged.
 */
import {
  SCENE_VERSION,
  type Behavior,
  type BehaviorTarget,
  type Cloner,
  type Effect,
  type Keyframe,
  type Layer,
  type SceneDocument,
  type ShapeKind,
  type TextAnimKind,
  type TextAnimUnit,
} from "@/lib/scene/schema";
import {
  anim,
  createBehavior,
  createCloner,
  createEffect,
  createShapeLayer,
  createTextLayer,
  defaultTransform,
  kf,
} from "@/lib/scene/factory";
import type { ExampleProject } from "@/lib/scene/examples";

/* --------------------------- builder toolkit ----------------------------- */

type Ease =
  | "linear" | "gentle" | "smooth" | "snappy" | "sharp"
  | "settle" | "anticipate" | "overshoot" | "easeIn" | "easeOut";

/** Keyframe shorthand. */
const k = (t: number, v: number, e: Ease = "gentle"): Keyframe => kf(t, v, e);

interface Common {
  rotation?: number;
  opacity?: number;
  scale?: number;
  anchorX?: number;
  anchorY?: number;
  blend?: Layer["blendMode"];
  label?: number;
  start?: number;
  end?: number;
  effects?: Effect[];
  behaviors?: Behavior[];
  cloner?: Cloner;
  parentId?: string | null;
  // Per-channel keyframe tracks:
  ax?: Keyframe[];
  ay?: Keyframe[];
  asx?: Keyframe[];
  asy?: Keyframe[];
  as?: Keyframe[]; // both scale axes
  arot?: Keyframe[];
  aop?: Keyframe[];
}

/** Sentinel "end" → resolved to the comp duration by doc(). */
const HOLD = 99999;

function decorate(l: Layer, x: number, y: number, c: Common): Layer {
  l.transform = defaultTransform(x, y);
  const t = l.transform;
  if (c.rotation != null) t.rotation.value = c.rotation;
  if (c.opacity != null) t.opacity.value = c.opacity;
  if (c.scale != null) { t.scaleX.value = c.scale; t.scaleY.value = c.scale; }
  if (c.anchorX != null) t.anchorX.value = c.anchorX;
  if (c.anchorY != null) t.anchorY.value = c.anchorY;
  if (c.ax) t.x.keyframes = c.ax;
  if (c.ay) t.y.keyframes = c.ay;
  if (c.as) { t.scaleX.keyframes = c.as; t.scaleY.keyframes = c.as.map((kk) => ({ ...kk, id: kk.id + "y" })); }
  if (c.asx) t.scaleX.keyframes = c.asx;
  if (c.asy) t.scaleY.keyframes = c.asy;
  if (c.arot) t.rotation.keyframes = c.arot;
  if (c.aop) t.opacity.keyframes = c.aop;
  if (c.blend) l.blendMode = c.blend;
  if (c.label) l.label = c.label;
  if (c.effects) l.effects = c.effects;
  if (c.behaviors) l.behaviors = c.behaviors;
  if (c.cloner) l.cloner = c.cloner;
  if (c.parentId !== undefined) l.parentId = c.parentId;
  l.timing = { start: c.start ?? 0, end: c.end ?? HOLD };
  return l;
}

interface ShapeOpts extends Common {
  r?: number;
  points?: number;
  gradientTo?: string;
  gradientAngle?: number;
  stroke?: { color: string; width: number; cap?: "round" | "butt" | "square"; dash?: number; gap?: number };
  trimEnd?: Keyframe[]; // animate a draw-on if provided (needs stroke)
}

function shape(
  name: string,
  kind: ShapeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  c: ShapeOpts = {},
): Layer {
  const l = createShapeLayer(kind, { name, x, y });
  l.shape = {
    kind,
    width: w,
    height: h,
    cornerRadius: c.r ?? 0,
    points: c.points ?? 5,
    fill: c.gradientTo
      ? { color: fill, gradient: { to: c.gradientTo, angle: c.gradientAngle ?? 90 } }
      : { color: fill },
    stroke: c.stroke,
    trim: c.trimEnd
      ? { enabled: true, start: anim(0), end: anim(100, c.trimEnd), offset: anim(-90) }
      : undefined,
  };
  return decorate(l, x, y, c);
}

interface TextOpts extends Common {
  align?: "left" | "center" | "right";
  letter?: number;
  animator?: { kind: TextAnimKind; unit?: TextAnimUnit; stagger?: number; duration?: number; start?: number };
  counter?: { from: number; to: number; decimals?: number; prefix?: string; suffix?: string; separator?: boolean };
}

function text(
  name: string,
  content: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  fill: string,
  c: TextOpts = {},
): Layer {
  const l = createTextLayer({ name, x, y });
  l.text = {
    content,
    fontSize: size,
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: weight,
    align: c.align ?? "center",
    fill,
    letterSpacing: c.letter ?? 0,
    animator: c.animator
      ? {
          kind: c.animator.kind,
          unit: c.animator.unit ?? "word",
          stagger: c.animator.stagger ?? 0.06,
          duration: c.animator.duration ?? 0.6,
          start: c.animator.start ?? 0,
        }
      : undefined,
    counter: c.counter
      ? {
          enabled: true,
          from: c.counter.from,
          to: c.counter.to,
          decimals: c.counter.decimals ?? 0,
          prefix: c.counter.prefix ?? "",
          suffix: c.counter.suffix ?? "",
          separator: c.counter.separator ?? true,
        }
      : undefined,
  };
  return decorate(l, x, y, c);
}

/* effect / behavior / cloner helpers */
function glow(color = "#ffffff", intensity = 1.5): Effect {
  const e = createEffect("glow");
  if (e.params.intensity) e.params.intensity.value = intensity;
  e.color = color;
  return e;
}
function bloom(intensity = 1.2): Effect {
  const e = createEffect("bloom");
  if (e.params.intensity) e.params.intensity.value = intensity;
  return e;
}
function shadow(): Effect {
  return createEffect("drop-shadow");
}
function vignette(): Effect {
  return createEffect("vignette");
}
function wiggle(target: BehaviorTarget = "position", freq = 0.5, amp = 22): Behavior {
  const b = createBehavior("wiggle", target);
  b.params = { ...b.params, freq, amp };
  b.loop = true;
  return b;
}
function spin(rate = 30): Behavior {
  const b = createBehavior("spin", "rotation");
  b.params = { ...b.params, rate };
  return b;
}
function orbit(radius = 40, rate = 50): Behavior {
  const b = createBehavior("orbit", "position");
  b.params = { ...b.params, radius, rate };
  return b;
}
function clonerOf(over: Partial<Cloner>): Cloner {
  return { ...createCloner(), ...over };
}

function doc(
  name: string,
  w: number,
  h: number,
  dur: number,
  bg: string,
  layers: Layer[],
): SceneDocument {
  for (const l of layers) if (l.timing.end >= HOLD) l.timing.end = dur;
  return {
    version: SCENE_VERSION,
    name,
    composition: { width: w, height: h, fps: 30, duration: dur, background: bg },
    layers,
    assets: [],
    palette: { swatches: [] },
  };
}

/* ============================== TEMPLATES ================================= */

/** 1 — Aurora Product Promo (16:9, 7s). */
function auroraPromo(): SceneDocument {
  const DUR = 7;
  const cx = 960;
  const bg = shape("Backdrop", "rect", cx, 540, 1920, 1080, "#160a2e", {
    gradientTo: "#3b1466",
    gradientAngle: 120,
  });
  // Soft aurora blobs drifting behind everything.
  const blobA = shape("Aurora A", "ellipse", 560, 360, 900, 900, "#7c3aed", {
    opacity: 42, blend: "screen", effects: [bloom(1.4)], behaviors: [wiggle("position", 0.25, 60)],
  });
  const blobB = shape("Aurora B", "ellipse", 1420, 760, 820, 820, "#ec4899", {
    opacity: 38, blend: "screen", effects: [bloom(1.4)], behaviors: [wiggle("position", 0.3, 70)],
  });
  // Floating particle field.
  const dust = shape("Particles", "ellipse", cx, 540, 8, 8, "#e9d5ff", {
    opacity: 70,
    cloner: clonerOf({ mode: "grid", cols: 12, rows: 7, spacingX: 150, spacingY: 150, stepOpacity: -2, stagger: 0.04 }),
    behaviors: [wiggle("position", 0.6, 26)],
  });
  // Glowing product card that springs in.
  const card = shape("Product Card", "rect", cx, 560, 760, 460, "#1a1033", {
    r: 36,
    gradientTo: "#2a1a4d", gradientAngle: 135,
    stroke: { color: "#a855f7", width: 2 },
    effects: [glow("#a855f7", 0.9), shadow()],
    as: [k(0.2, 0, "overshoot"), k(1.1, 100, "overshoot")],
    aop: [k(0.2, 0, "gentle"), k(0.7, 100, "gentle")],
    ay: [k(0.2, 600, "settle"), k(1.1, 560, "settle")],
  });
  // Inner mock UI lines on the card.
  const bar1 = shape("UI Bar 1", "rect", cx - 180, 470, 280, 26, "#c084fc", {
    r: 13, aop: [k(0.9, 0, "gentle"), k(1.3, 100, "gentle")], asx: [k(0.9, 0, "settle"), k(1.5, 100, "settle")], anchorX: 0,
  });
  const bar2 = shape("UI Bar 2", "rect", cx - 120, 560, 520, 18, "#3b2a5c", {
    r: 9, aop: [k(1.05, 0, "gentle"), k(1.45, 100, "gentle")], asx: [k(1.05, 0, "settle"), k(1.65, 100, "settle")], anchorX: 0,
  });
  const bar3 = shape("UI Bar 3", "rect", cx - 150, 610, 400, 18, "#3b2a5c", {
    r: 9, aop: [k(1.2, 0, "gentle"), k(1.6, 100, "gentle")], asx: [k(1.2, 0, "settle"), k(1.8, 100, "settle")], anchorX: 0,
  });
  // Headline + sub + CTA.
  const kicker = text("Kicker", "INTRODUCING", cx, 210, 34, 700, "#c4b5fd", {
    letter: 10, aop: [k(1.4, 0, "gentle"), k(1.9, 100, "gentle")], ay: [k(1.4, 240, "settle"), k(1.9, 210, "settle")],
  });
  const title = text("Headline", "Build motion that ships", cx, 300, 96, 800, "#ffffff", {
    letter: -2,
    animator: { kind: "fade-up", unit: "word", stagger: 0.08, duration: 0.6, start: 1.6 },
  });
  const sub = text("Subhead", "Design, animate and export — all in the browser.", cx, 880, 36, 500, "#c7b8e8", {
    aop: [k(2.4, 0, "gentle"), k(3, 100, "gentle")], ay: [k(2.4, 910, "settle"), k(3, 880, "settle")],
  });
  const cta = shape("CTA", "rect", cx, 970, 320, 84, "#a855f7", {
    r: 42, effects: [glow("#a855f7", 1.1)],
    as: [k(2.8, 0, "overshoot"), k(3.5, 100, "overshoot")],
  });
  const ctaLabel = text("CTA Label", "Start free", cx, 970, 34, 700, "#ffffff", {
    aop: [k(3.1, 0, "gentle"), k(3.5, 100, "gentle")],
  });
  return doc("Aurora Product Promo", 1920, 1080, DUR, "#160a2e", [
    bg, blobA, blobB, dust, card, bar1, bar2, bar3, kicker, title, sub, cta, ctaLabel,
  ]);
}

/** 2 — App Onboarding (9:16 vertical, 6s). */
function appOnboarding(): SceneDocument {
  const DUR = 6;
  const cx = 540;
  const bg = shape("Backdrop", "rect", cx, 960, 1080, 1920, "#04211c", {
    gradientTo: "#0b3b32", gradientAngle: 160,
  });
  const halo = shape("Halo", "ellipse", cx, 620, 760, 760, "#10b981", {
    opacity: 32, blend: "screen", effects: [bloom(1.5)], as: [k(0, 80, "settle"), k(1.2, 100, "settle")],
  });
  // Hero app icon that pops.
  const icon = shape("App Icon", "rect", cx, 620, 300, 300, "#14b8a6", {
    r: 72, gradientTo: "#06b6d4", gradientAngle: 135, effects: [glow("#2dd4bf", 1.2), shadow()],
    as: [k(0.2, 0, "overshoot"), k(1.0, 100, "overshoot")],
    arot: [k(0.2, -20, "overshoot"), k(1.0, 0, "overshoot")],
  });
  const glyph = text("Glyph", "✦", cx, 628, 150, 800, "#ffffff", {
    aop: [k(0.7, 0, "gentle"), k(1.1, 100, "gentle")],
    as: [k(0.7, 40, "overshoot"), k(1.2, 100, "overshoot")],
  });
  const title = text("Title", "Welcome aboard", cx, 920, 76, 800, "#ffffff", {
    aop: [k(1.1, 0, "gentle"), k(1.6, 100, "gentle")], ay: [k(1.1, 970, "settle"), k(1.6, 920, "settle")],
  });
  const body = text("Body", "Three quick things to get you moving.", cx, 1010, 36, 500, "#86d6c9", {
    aop: [k(1.3, 0, "gentle"), k(1.8, 100, "gentle")], ay: [k(1.3, 1050, "settle"), k(1.8, 1010, "settle")],
  });
  // Three feature rows that stagger up.
  const rowsY = [1200, 1360, 1520];
  const rowColors = ["#2dd4bf", "#34d399", "#22d3ee"];
  const rowText = ["Realtime preview", "Export to MP4 & Lottie", "Templates included"];
  const rows: Layer[] = [];
  rowsY.forEach((ry, i) => {
    const delay = 1.9 + i * 0.22;
    rows.push(
      shape(`Row ${i + 1}`, "rect", cx, ry, 860, 120, "#0a2b25", {
        r: 28, stroke: { color: "#16544a", width: 1.5 },
        aop: [k(delay, 0, "gentle"), k(delay + 0.4, 100, "gentle")],
        ax: [k(delay, cx + 120, "settle"), k(delay + 0.5, cx, "settle")],
      }),
    );
    rows.push(
      shape(`Row Icon ${i + 1}`, "ellipse", cx - 330, ry, 72, 72, rowColors[i], {
        effects: [glow(rowColors[i], 0.9)],
        aop: [k(delay + 0.1, 0, "gentle"), k(delay + 0.45, 100, "gentle")],
        as: [k(delay + 0.1, 0, "overshoot"), k(delay + 0.6, 100, "overshoot")],
      }),
    );
    rows.push(
      text(`Row Label ${i + 1}`, rowText[i], cx - 30, ry - 4, 38, 600, "#e7edff", {
        aop: [k(delay + 0.15, 0, "gentle"), k(delay + 0.5, 100, "gentle")],
      }),
    );
  });
  // Bottom CTA.
  const cta = shape("CTA", "rect", cx, 1740, 760, 110, "#14b8a6", {
    r: 55, effects: [glow("#14b8a6", 1.1)],
    as: [k(2.9, 0, "overshoot"), k(3.5, 100, "overshoot")],
  });
  const ctaLabel = text("CTA Label", "Get started", cx, 1740, 40, 700, "#04211c", {
    aop: [k(3.2, 0, "gentle"), k(3.6, 100, "gentle")],
  });
  return doc("App Onboarding", 1080, 1920, DUR, "#04211c", [
    bg, halo, icon, glyph, title, body, ...rows, cta, ctaLabel,
  ]);
}

/** 3 — Metrics Dashboard reveal (16:9, 6.5s). */
function metricsDashboard(): SceneDocument {
  const DUR = 6.5;
  const bg = shape("Backdrop", "rect", 960, 540, 1920, 1080, "#0b1220", {
    gradientTo: "#0f2133", gradientAngle: 120,
  });
  // Faint grid of dots.
  const grid = shape("Grid", "ellipse", 960, 540, 5, 5, "#22304f", {
    opacity: 50,
    cloner: clonerOf({ mode: "grid", cols: 16, rows: 9, spacingX: 118, spacingY: 118, stagger: 0 }),
  });
  const title = text("Title", "Q3 Performance", 560, 150, 64, 800, "#ffffff", {
    aop: [k(0.1, 0, "gentle"), k(0.6, 100, "gentle")], ax: [k(0.1, 510, "settle"), k(0.6, 560, "settle")],
  });
  const subtitle = text("Subtitle", "Live metrics overview", 560, 212, 30, 500, "#7d8db0", {
    aop: [k(0.3, 0, "gentle"), k(0.8, 100, "gentle")],
  });

  // Four KPI cards with counters.
  const cardX = [430, 860, 1290, 1720];
  const kpis = [
    { label: "Revenue", to: 128400, prefix: "$", suffix: "", color: "#22d3ee" },
    { label: "New Users", to: 9320, prefix: "", suffix: "", color: "#34d399" },
    { label: "Conversion", to: 24, prefix: "", suffix: "%", color: "#fbbf24" },
    { label: "Sessions", to: 56100, prefix: "", suffix: "", color: "#f472b6" },
  ];
  const cards: Layer[] = [];
  kpis.forEach((kp, i) => {
    const delay = 0.7 + i * 0.18;
    cards.push(
      shape(`Card ${i + 1}`, "rect", cardX[i], 470, 380, 260, "#131d33", {
        r: 28, stroke: { color: "#243453", width: 1.5 }, effects: [shadow()],
        aop: [k(delay, 0, "gentle"), k(delay + 0.4, 100, "gentle")],
        as: [k(delay, 70, "overshoot"), k(delay + 0.6, 100, "overshoot")],
        ay: [k(delay, 510, "settle"), k(delay + 0.6, 470, "settle")],
      }),
    );
    cards.push(
      text(`KPI Label ${i + 1}`, kp.label.toUpperCase(), cardX[i], 400, 24, 700, kp.color, {
        letter: 4, aop: [k(delay + 0.2, 0, "gentle"), k(delay + 0.5, 100, "gentle")],
      }),
    );
    cards.push(
      text(`KPI Value ${i + 1}`, "0", cardX[i], 480, 64, 800, "#ffffff", {
        counter: { from: 0, to: kp.to, prefix: kp.prefix, suffix: kp.suffix, separator: true },
        aop: [k(delay + 0.3, 0, "gentle"), k(delay + 0.6, 100, "gentle")],
      }),
    );
  });

  // Bar chart that grows from the baseline (anchorY = 1).
  const baseY = 940;
  const heights = [120, 200, 160, 280, 230, 320, 260];
  const bars: Layer[] = [];
  heights.forEach((hgt, i) => {
    const bx = 360 + i * 200;
    const delay = 1.8 + i * 0.1;
    bars.push(
      shape(`Bar ${i + 1}`, "rect", bx, baseY, 96, hgt, "#22d3ee", {
        r: 14, anchorY: 1,
        gradientTo: "#0ea5e9", gradientAngle: 0,
        asy: [k(delay, 0, "settle"), k(delay + 0.6, 100, "settle")],
      }),
    );
  });
  const axis = shape("Axis", "rect", 960, baseY + 4, 1480, 3, "#2a3a5c", {
    anchorX: 0.5, asx: [k(1.7, 0, "snappy"), k(2.3, 100, "snappy")],
  });

  return doc("Metrics Dashboard", 1920, 1080, DUR, "#0b1220", [
    bg, grid, title, subtitle, ...cards, axis, ...bars,
  ]);
}

/** 4 — Logo Sting (1:1 square, 5s). */
function logoSting(): SceneDocument {
  const DUR = 5;
  const c = 540;
  const bg = shape("Backdrop", "rect", c, c, 1080, 1080, "#0a0800", {
    gradientTo: "#2e1f06", gradientAngle: 135,
  });
  // Radial burst of shards springing out then fading.
  const shard = shape("Burst", "rect", c, c, 14, 90, "#fbbf24", {
    r: 7,
    cloner: clonerOf({ mode: "radial", count: 18, radius: 300, faceOut: true, stepOpacity: 0, stagger: 0.012 }),
    effects: [glow("#f59e0b", 1.2)],
    as: [k(0.5, 0, "overshoot"), k(1.1, 100, "overshoot"), k(2.0, 100, "gentle"), k(2.8, 0, "easeIn")],
    aop: [k(0.5, 0, "gentle"), k(0.9, 100, "gentle"), k(2.2, 100, "gentle"), k(2.9, 0, "gentle")],
  });
  // Draw-on ring.
  const ring = shape("Ring", "ellipse", c, c, 360, 360, "#0a0800", {
    stroke: { color: "#fcd34d", width: 10, cap: "round" },
    trimEnd: [k(0.4, 0, "settle"), k(1.6, 100, "settle")],
    effects: [glow("#f59e0b", 1.0)],
  });
  // Monogram that pops in with overshoot.
  const mark = text("Monogram", "LM", c, c + 12, 200, 800, "#ffffff", {
    letter: -6,
    as: [k(1.2, 0, "overshoot"), k(1.9, 100, "overshoot")],
    aop: [k(1.2, 0, "gentle"), k(1.6, 100, "gentle")],
    arot: [k(1.2, -12, "overshoot"), k(1.9, 0, "overshoot")],
  });
  const sweep = shape("Sweep", "rect", c, c, 360, 360, "#ffffff", {
    opacity: 0, blend: "add", r: 180,
    aop: [k(1.9, 0, "gentle"), k(2.1, 55, "gentle"), k(2.5, 0, "gentle")],
  });
  // Tagline reveal.
  const tag = text("Tagline", "MOTION, MADE SIMPLE", c, c + 230, 34, 600, "#e0c587", {
    letter: 10,
    aop: [k(2.4, 0, "gentle"), k(3.0, 100, "gentle")],
    ay: [k(2.4, c + 270, "settle"), k(3.0, c + 230, "settle")],
  });
  const tagLine = shape("Underline", "rect", c, c + 290, 0, 4, "#fbbf24", {
    r: 2, asx: [k(2.7, 0, "snappy"), k(3.3, 100, "snappy")], anchorX: 0.5,
    // width animated via scaleX from a 360px base:
  });
  tagLine.shape!.width = 360;
  return doc("Logo Sting", 1080, 1080, DUR, "#0a0800", [bg, shard, ring, mark, sweep, tag, tagLine]);
}

/** 5 — Broadcast Lower Third (16:9, 6s; slides in, holds, slides out). */
function lowerThird(): SceneDocument {
  const DUR = 6;
  // Transparent-ish dark so it could overlay footage; we give it a subtle bg.
  const bg = shape("Backdrop", "rect", 960, 540, 1920, 1080, "#10131c", {
    gradientTo: "#0b0d14", gradientAngle: 90, opacity: 100,
  });
  const photoHint = text("Scene Hint", "your footage here", 960, 300, 40, 500, "#2c3140", {
    aop: [k(0.2, 0, "gentle"), k(1, 60, "gentle")],
  });
  // Accent block wipes in first.
  // Main bar slides in from the left (left edge anchored).
  const bar = shape("Bar", "rect", 230, 820, 900, 156, "#151a26", {
    r: 16, anchorX: 0, stroke: { color: "#283143", width: 1.5 }, effects: [shadow()],
    ax: [k(0.3, 230 - 1100, "settle"), k(1.0, 230, "settle"), k(4.8, 230, "gentle"), k(5.5, 230 - 1100, "easeIn")],
    aop: [k(0.3, 0, "gentle"), k(0.7, 100, "gentle"), k(4.9, 100, "gentle"), k(5.5, 0, "gentle")],
  });
  // Accent block wipes in at the bar's left edge.
  const accent = shape("Accent", "rect", 282, 820, 16, 156, "#ef4444", {
    anchorY: 0.5, effects: [glow("#ef4444", 1.0)],
    asy: [k(0.5, 0, "settle"), k(1.0, 100, "settle"), k(4.9, 100, "gentle"), k(5.4, 0, "easeIn")],
    aop: [k(0.4, 0, "gentle"), k(0.7, 100, "gentle"), k(4.9, 100, "gentle"), k(5.5, 0, "gentle")],
  });
  const name = text("Name", "Avery Cole", 560, 794, 56, 800, "#ffffff", {
    aop: [k(0.9, 0, "gentle"), k(1.3, 100, "gentle"), k(4.9, 100, "gentle"), k(5.4, 0, "gentle")],
    ax: [k(0.9, 520, "settle"), k(1.3, 560, "settle")],
  });
  const role = text("Role", "Lead Motion Designer", 560, 858, 32, 500, "#9aa6c0", {
    aop: [k(1.1, 0, "gentle"), k(1.5, 100, "gentle"), k(4.9, 100, "gentle"), k(5.4, 0, "gentle")],
    ax: [k(1.1, 530, "settle"), k(1.5, 560, "settle")],
  });
  // Animated underline (grows from the left, under the name).
  const underline = shape("Underline", "rect", 410, 832, 300, 4, "#ef4444", {
    anchorX: 0,
    asx: [k(1.4, 0, "snappy"), k(2.0, 100, "snappy"), k(4.9, 100, "gentle"), k(5.3, 0, "easeIn")],
    aop: [k(1.4, 0, "gentle"), k(1.7, 100, "gentle"), k(4.9, 100, "gentle"), k(5.4, 0, "gentle")],
  });
  return doc("Broadcast Lower Third", 1920, 1080, DUR, "#10131c", [
    bg, photoHint, accent, bar, name, role, underline,
  ]);
}

/** 6 — Kinetic Quote (16:9, 6.5s). */
function kineticQuote(): SceneDocument {
  const DUR = 6.5;
  const bg = shape("Backdrop", "rect", 960, 540, 1920, 1080, "#160d12", {
    gradientTo: "#341622", gradientAngle: 135,
  });
  const blob = shape("Glow", "ellipse", 960, 540, 1100, 1100, "#fb7185", {
    opacity: 24, blend: "screen", effects: [bloom(1.6)],
    as: [k(0, 70, "settle"), k(2, 100, "settle")], behaviors: [wiggle("position", 0.2, 40)],
  });
  const quoteMark = text("Quote Mark", "“", 360, 360, 320, 800, "#fb7185", {
    aop: [k(0.1, 0, "gentle"), k(0.7, 70, "gentle")],
    as: [k(0.1, 60, "overshoot"), k(0.8, 100, "overshoot")],
  });
  // Big multi-line quote, revealed word by word.
  const line1 = text("Line 1", "Design is not just", 960, 430, 96, 800, "#ffffff", {
    animator: { kind: "fade-up", unit: "word", stagger: 0.09, duration: 0.55, start: 0.5 },
  });
  const line2 = text("Line 2", "what it looks like.", 960, 560, 96, 800, "#ffffff", {
    animator: { kind: "fade-up", unit: "word", stagger: 0.09, duration: 0.55, start: 1.2 },
  });
  const line3 = text("Line 3", "It's how it moves.", 960, 690, 96, 800, "#fb7185", {
    animator: { kind: "fade-up", unit: "word", stagger: 0.1, duration: 0.6, start: 2.1 },
  });
  const rule = shape("Rule", "rect", 960, 820, 360, 4, "#fb7185", {
    anchorX: 0.5, asx: [k(3.1, 0, "snappy"), k(3.7, 100, "snappy")],
  });
  const author = text("Author", "— The Motion Manifesto", 960, 880, 34, 500, "#d9a8b4", {
    letter: 4, aop: [k(3.4, 0, "gentle"), k(4.0, 100, "gentle")], ay: [k(3.4, 910, "settle"), k(4.0, 880, "settle")],
  });
  return doc("Kinetic Quote", 1920, 1080, DUR, "#160d12", [
    bg, blob, quoteMark, line1, line2, line3, rule, author,
  ]);
}

/* ------------------------------ registry --------------------------------- */

interface TemplateDef {
  id: string;
  name: string;
  blurb: string;
  tools: string[];
  build: () => SceneDocument;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "tpl-aurora-promo",
    name: "Aurora Product Promo",
    blurb: "A full 16:9 product launch — glowing card, particle field and a word-by-word headline.",
    tools: ["Gradient", "Bloom", "Cloner", "Kinetic text", "Spring"],
    build: auroraPromo,
  },
  {
    id: "tpl-app-onboarding",
    name: "App Onboarding",
    blurb: "Vertical 9:16 onboarding — hero icon pop, staggered feature rows and a CTA.",
    tools: ["9:16", "Stagger", "Glow", "Spring"],
    build: appOnboarding,
  },
  {
    id: "tpl-metrics-dashboard",
    name: "Metrics Dashboard",
    blurb: "KPI cards with live number counters and a bar chart that grows from the baseline.",
    tools: ["Counters", "Bar chart", "Stagger", "Cloner"],
    build: metricsDashboard,
  },
  {
    id: "tpl-logo-sting",
    name: "Logo Sting",
    blurb: "A 1:1 logo reveal — radial shard burst, draw-on ring and a monogram pop.",
    tools: ["Trim paths", "Radial cloner", "Glow", "Overshoot"],
    build: logoSting,
  },
  {
    id: "tpl-lower-third",
    name: "Broadcast Lower Third",
    blurb: "A name/title bar that slides in, holds, then slides out — drop it over footage.",
    tools: ["Slide in/out", "Draw-on", "Glow"],
    build: lowerThird,
  },
  {
    id: "tpl-kinetic-quote",
    name: "Kinetic Quote",
    blurb: "Bold three-line typography revealed word by word over a drifting glow.",
    tools: ["Kinetic text", "Bloom", "Wiggle"],
    build: kineticQuote,
  },
];

/** Public gallery entries (category "Showcase"). */
export const TEMPLATE_PROJECTS: ExampleProject[] = TEMPLATES.map((t) => ({
  ...t,
  category: "Showcase",
}));
