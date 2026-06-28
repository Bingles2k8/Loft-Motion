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
/** A gentle continuous scale pulse (great for idle CTAs). */
function oscillateScale(freq = 0.8, amp = 3): Behavior {
  const b = createBehavior("oscillate", "scale");
  b.params = { ...b.params, freq, amp };
  b.loop = true;
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

/** 1 — Aurora Product Promo (16:9, 10s) — a full multi-scene product launch. */
function auroraPromo(): SceneDocument {
  const DUR = 10;
  const cx = 960;
  // Opacity in (and optional out) helper for scene transitions.
  const op = (tin: number, tout?: number): Keyframe[] =>
    tout === undefined
      ? [k(tin, 0, "gentle"), k(tin + 0.4, 100, "gentle")]
      : [k(tin, 0, "gentle"), k(tin + 0.4, 100, "gentle"), k(tout, 100, "gentle"), k(tout + 0.4, 0, "gentle")];

  /* Persistent backdrop. */
  const bg = shape("Backdrop", "rect", cx, 540, 1920, 1080, "#160a2e", {
    gradientTo: "#3b1466", gradientAngle: 120,
  });
  const blobA = shape("Aurora A", "ellipse", 560, 360, 940, 940, "#7c3aed", {
    opacity: 42, blend: "screen", effects: [bloom(1.4)], behaviors: [wiggle("position", 0.22, 70)],
  });
  const blobB = shape("Aurora B", "ellipse", 1420, 780, 860, 860, "#ec4899", {
    opacity: 38, blend: "screen", effects: [bloom(1.4)], behaviors: [wiggle("position", 0.28, 80)],
  });
  const dust = shape("Particles", "ellipse", cx, 540, 8, 8, "#e9d5ff", {
    opacity: 55,
    cloner: clonerOf({ mode: "grid", cols: 13, rows: 8, spacingX: 150, spacingY: 140, stepOpacity: -2, stagger: 0.03 }),
    behaviors: [wiggle("position", 0.5, 26)],
  });

  /* Scene A — logo intro (0–2.6s). */
  const mark = shape("Logo Mark", "rect", cx, 470, 150, 150, "#a855f7", {
    r: 38, gradientTo: "#ec4899", gradientAngle: 135, effects: [glow("#c084fc", 1.1), shadow()],
    end: 2.7, aop: op(0.1, 2.0),
    as: [k(0.2, 0, "overshoot"), k(1.0, 100, "overshoot")],
    arot: [k(0.2, -18, "overshoot"), k(1.0, 0, "overshoot")],
  });
  const glyph = text("Logo Glyph", "✦", cx, 478, 84, 800, "#ffffff", {
    end: 2.7, aop: op(0.6, 2.0), as: [k(0.6, 40, "overshoot"), k(1.1, 100, "overshoot")],
  });
  const introName = text("Brand", "LOFT MOTION", cx, 630, 40, 800, "#ffffff", {
    letter: 14, end: 2.7, aop: op(0.9, 2.0), ay: [k(0.9, 660, "settle"), k(1.3, 630, "settle")],
  });

  /* Scene B — headline (2.4–5.6s). */
  const kicker = text("Kicker", "INTRODUCING", cx, 360, 34, 700, "#c4b5fd", {
    letter: 10, start: 2.4, end: 5.7, aop: op(2.5, 5.0), ay: [k(2.5, 390, "settle"), k(2.9, 360, "settle")],
  });
  const headline = text("Headline", "Build motion that ships", cx, 490, 104, 800, "#ffffff", {
    letter: -2, start: 2.5, end: 5.7,
    animator: { kind: "fade-up", unit: "word", stagger: 0.09, duration: 0.55, start: 2.7 },
    aop: [k(2.6, 100, "gentle"), k(5.0, 100, "gentle"), k(5.5, 0, "gentle")],
  });
  const subhead = text("Subhead", "Design, animate and export — all in the browser.", cx, 620, 36, 500, "#c7b8e8", {
    start: 3.4, end: 5.7, aop: op(3.6, 5.0), ay: [k(3.6, 650, "settle"), k(4.0, 620, "settle")],
  });

  /* Scene C — product reveal (5.3s → end). */
  const card = shape("Product Card", "rect", cx, 500, 760, 440, "#1a1033", {
    r: 34, gradientTo: "#2a1a4d", gradientAngle: 135,
    stroke: { color: "#a855f7", width: 2 }, effects: [glow("#a855f7", 0.8), shadow()],
    start: 5.2, aop: op(5.3),
    as: [k(5.4, 82, "overshoot"), k(6.1, 100, "overshoot")],
    ay: [k(5.4, 640, "settle"), k(6.1, 500, "settle")],
  });
  const avatar = shape("Avatar", "ellipse", cx - 250, 388, 60, 60, "#c084fc", {
    start: 5.8, effects: [glow("#c084fc", 0.7)], aop: op(5.9),
    as: [k(5.9, 0, "overshoot"), k(6.3, 100, "overshoot")],
  });
  const titleBar = shape("App Title", "rect", cx - 200, 380, 280, 22, "#e9d5ff", {
    r: 11, anchorX: 0, start: 5.9, aop: op(6.0), asx: [k(6.0, 0, "settle"), k(6.5, 100, "settle")],
  });
  const line1 = shape("UI Line 1", "rect", cx - 280, 470, 560, 18, "#3b2a5c", {
    r: 9, anchorX: 0, start: 6.0, aop: op(6.1), asx: [k(6.1, 0, "settle"), k(6.7, 100, "settle")],
  });
  const line2 = shape("UI Line 2", "rect", cx - 280, 510, 440, 18, "#3b2a5c", {
    r: 9, anchorX: 0, start: 6.1, aop: op(6.2), asx: [k(6.2, 0, "settle"), k(6.8, 100, "settle")],
  });
  const innerBtn = shape("App Button", "rect", cx - 280, 580, 190, 56, "#a855f7", {
    r: 28, anchorX: 0, start: 6.2, effects: [glow("#a855f7", 0.7)], aop: op(6.3),
    as: [k(6.3, 0, "overshoot"), k(6.8, 100, "overshoot")],
  });

  /* Scene D — feature pills + CTA (7.0s → end). */
  const pillDefs = [
    { x: 700, w: 320, label: "MP4 · Lottie · CSS" },
    { x: 960, w: 180, label: "60 fps" },
    { x: 1230, w: 260, label: "No backend" },
  ];
  const pills: Layer[] = [];
  pillDefs.forEach((p, i) => {
    const t = 7.1 + i * 0.16;
    pills.push(
      shape(`Pill ${i + 1}`, "rect", p.x, 840, p.w, 70, "#241246", {
        r: 35, stroke: { color: "#7c3aed", width: 1.5 }, start: 7.0, aop: op(t),
        as: [k(t, 0, "overshoot"), k(t + 0.5, 100, "overshoot")],
      }),
    );
    pills.push(
      text(`Pill Label ${i + 1}`, p.label, p.x, 836, 26, 600, "#e9d5ff", {
        start: 7.0, aop: op(t + 0.1),
      }),
    );
  });
  const cta = shape("CTA", "rect", cx, 965, 340, 90, "#a855f7", {
    r: 45, effects: [glow("#c084fc", 1.2)], start: 8.0, aop: op(8.2),
    as: [k(8.2, 0, "overshoot"), k(8.8, 100, "overshoot")],
    behaviors: [oscillateScale(0.9, 2.5)],
  });
  const ctaLabel = text("CTA Label", "Start free →", cx, 965, 34, 700, "#ffffff", {
    start: 8.0, aop: op(8.5),
  });

  return doc("Aurora Product Promo", 1920, 1080, DUR, "#160a2e", [
    bg, blobA, blobB, dust,
    mark, glyph, introName,
    kicker, headline, subhead,
    card, avatar, titleBar, line1, line2, innerBtn,
    ...pills, cta, ctaLabel,
  ]);
}

/** 2 — App Onboarding (9:16, 9s) — a three-screen sliding flow. */
function appOnboarding(): SceneDocument {
  const DUR = 9;
  const cx = 540;
  // Horizontal screen slide: in from the right, hold, out to the left.
  const slide = (rx: number, tin: number, tout?: number): Keyframe[] => {
    const a = [k(tin, rx + 1180, "snappy"), k(tin + 0.55, rx, "snappy")];
    if (tout !== undefined) a.push(k(tout, rx, "gentle"), k(tout + 0.5, rx - 1180, "snappy"));
    return a;
  };
  const S1 = [0.2, 2.7] as const;
  const S2 = [2.8, 5.7] as const;
  const S3 = 5.8;

  /* Persistent backdrop + halo + page dots. */
  const bg = shape("Backdrop", "rect", cx, 960, 1080, 1920, "#04211c", {
    gradientTo: "#0b3b32", gradientAngle: 160,
  });
  const halo = shape("Halo", "ellipse", cx, 720, 820, 820, "#10b981", {
    opacity: 26, blend: "screen", effects: [bloom(1.5)],
    as: [k(0, 92, "settle"), k(2, 100, "settle"), k(5, 92, "settle"), k(8, 100, "settle")],
  });
  const dots = shape("Page Dots", "ellipse", cx - 60, 1760, 16, 16, "#2a6b5f", {
    cloner: clonerOf({ mode: "line", count: 3, spacingX: 60, stagger: 0 }),
  });
  const activeDot = shape("Active Dot", "ellipse", cx - 60, 1760, 16, 16, "#2dd4bf", {
    effects: [glow("#2dd4bf", 0.8)],
    ax: [k(0.5, cx - 60, "snappy"), k(2.9, cx - 60, "snappy"), k(3.2, cx, "snappy"),
      k(5.7, cx, "snappy"), k(6.0, cx + 60, "snappy")],
  });

  /* Screen 1 — Welcome. */
  const icon = shape("App Icon", "rect", cx, 720, 300, 300, "#14b8a6", {
    r: 72, gradientTo: "#06b6d4", gradientAngle: 135, effects: [glow("#2dd4bf", 1.2), shadow()],
    end: 3.4, ax: slide(cx, S1[0], S1[1]),
    as: [k(S1[0], 70, "overshoot"), k(S1[0] + 0.7, 100, "overshoot")],
  });
  const glyph = text("Glyph", "✦", cx, 728, 150, 800, "#ffffff", { end: 3.4, ax: slide(cx, S1[0], S1[1]) });
  const t1 = text("S1 Title", "Welcome aboard", cx, 1080, 80, 800, "#ffffff", { end: 3.4, ax: slide(cx, S1[0], S1[1]) });
  const b1 = text("S1 Body", "Swipe to see what's inside.", cx, 1180, 38, 500, "#86d6c9", { end: 3.4, ax: slide(cx, S1[0], S1[1]) });

  /* Screen 2 — Features. */
  const t2 = text("S2 Title", "Built for flow", cx, 560, 76, 800, "#ffffff", { start: 2.6, end: 6.4, ax: slide(cx, S2[0], S2[1]) });
  const rowsY = [840, 1050, 1260];
  const rowColors = ["#2dd4bf", "#34d399", "#22d3ee"];
  const rowText = ["Realtime preview", "Export to MP4 & Lottie", "Templates included"];
  const rows: Layer[] = [];
  rowsY.forEach((ry, i) => {
    const tin = S2[0] + i * 0.1;
    rows.push(shape(`Row ${i + 1}`, "rect", cx, ry, 880, 156, "#0a2b25", {
      r: 30, stroke: { color: "#16544a", width: 1.5 }, start: 2.6, end: 6.4, ax: slide(cx, tin, S2[1]),
    }));
    rows.push(shape(`Row Icon ${i + 1}`, "ellipse", cx - 320, ry, 80, 80, rowColors[i], {
      effects: [glow(rowColors[i], 0.9)], start: 2.6, end: 6.4, ax: slide(cx - 320, tin, S2[1]),
    }));
    rows.push(text(`Row Label ${i + 1}`, rowText[i], cx - 10, ry - 4, 40, 600, "#e7edff", {
      start: 2.6, end: 6.4, ax: slide(cx - 10, tin, S2[1]),
    }));
  });

  /* Screen 3 — Get started. */
  const check = shape("Check", "ellipse", cx, 720, 290, 290, "#14b8a6", {
    gradientTo: "#22d3ee", gradientAngle: 135, effects: [glow("#2dd4bf", 1.2), shadow()],
    start: 5.6, ax: slide(cx, S3),
    as: [k(S3, 65, "overshoot"), k(S3 + 0.7, 100, "overshoot")],
  });
  const tick = text("Tick", "✓", cx, 745, 150, 800, "#ffffff", {
    start: 5.6, ax: slide(cx, S3 + 0.2), aop: [k(S3 + 0.5, 0, "gentle"), k(S3 + 0.9, 100, "gentle")],
  });
  const burst = shape("Confetti", "rect", cx, 720, 22, 22, "#34d399", {
    r: 5, start: 6.0, cloner: clonerOf({ mode: "radial", count: 14, radius: 340, stagger: 0.012 }),
    as: [k(6.3, 0, "overshoot"), k(6.9, 100, "overshoot"), k(7.6, 100, "gentle"), k(8.2, 0, "easeIn")],
    aop: [k(6.3, 0, "gentle"), k(6.6, 100, "gentle"), k(7.8, 100, "gentle"), k(8.3, 0, "gentle")],
  });
  const t3 = text("S3 Title", "You're all set", cx, 1080, 80, 800, "#ffffff", { start: 5.6, ax: slide(cx, S3 + 0.15) });
  const b3 = text("S3 Body", "Start creating in seconds.", cx, 1180, 38, 500, "#86d6c9", { start: 5.6, ax: slide(cx, S3 + 0.25) });
  const cta = shape("CTA", "rect", cx, 1520, 780, 124, "#14b8a6", {
    r: 62, effects: [glow("#2dd4bf", 1.2)], start: 5.6, ax: slide(cx, S3 + 0.3),
    as: [k(S3 + 0.6, 70, "overshoot"), k(S3 + 1.2, 100, "overshoot")],
    behaviors: [oscillateScale(0.9, 2)],
  });
  const ctaLabel = text("CTA Label", "Get started", cx, 1520, 44, 700, "#04211c", {
    start: 5.6, ax: slide(cx, S3 + 0.4), aop: [k(S3 + 1.0, 0, "gentle"), k(S3 + 1.3, 100, "gentle")],
  });

  return doc("App Onboarding", 1080, 1920, DUR, "#04211c", [
    bg, halo,
    icon, glyph, t1, b1,
    t2, ...rows,
    check, burst, tick, t3, b3, cta, ctaLabel,
    dots, activeDot,
  ]);
}

/** 3 — Metrics Dashboard reveal (16:9, 6.5s). */
function metricsDashboard(): SceneDocument {
  const DUR = 9;
  const op = (tin: number): Keyframe[] => [k(tin, 0, "gentle"), k(tin + 0.4, 100, "gentle")];
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

  // Four KPI cards with counters + growth badges (revealed in beat 2).
  const cardX = [430, 860, 1290, 1720];
  const kpis = [
    { label: "Revenue", to: 128400, prefix: "$", suffix: "", color: "#22d3ee", growth: "+12.4%", up: true },
    { label: "New Users", to: 9320, prefix: "", suffix: "", color: "#34d399", growth: "+8.1%", up: true },
    { label: "Conversion", to: 24, prefix: "", suffix: "%", color: "#fbbf24", growth: "+2.3%", up: true },
    { label: "Sessions", to: 56100, prefix: "", suffix: "", color: "#f472b6", growth: "-1.2%", up: false },
  ];
  const cards: Layer[] = [];
  kpis.forEach((kp, i) => {
    const delay = 0.7 + i * 0.18;
    const badgeT = 4.4 + i * 0.14;
    cards.push(
      shape(`Card ${i + 1}`, "rect", cardX[i], 460, 380, 280, "#131d33", {
        r: 28, stroke: { color: "#243453", width: 1.5 }, effects: [shadow()],
        aop: op(delay),
        as: [k(delay, 70, "overshoot"), k(delay + 0.6, 100, "overshoot")],
        ay: [k(delay, 500, "settle"), k(delay + 0.6, 460, "settle")],
      }),
    );
    cards.push(
      text(`KPI Label ${i + 1}`, kp.label.toUpperCase(), cardX[i], 388, 24, 700, kp.color, {
        letter: 4, aop: op(delay + 0.2),
      }),
    );
    cards.push(
      text(`KPI Value ${i + 1}`, "0", cardX[i], 470, 64, 800, "#ffffff", {
        counter: { from: 0, to: kp.to, prefix: kp.prefix, suffix: kp.suffix, separator: true },
        aop: op(delay + 0.3),
      }),
    );
    cards.push(
      text(`KPI Growth ${i + 1}`, `${kp.up ? "▲" : "▼"} ${kp.growth}`, cardX[i], 560, 26, 700, kp.up ? "#34d399" : "#f87171", {
        aop: op(badgeT),
        as: [k(badgeT, 0, "overshoot"), k(badgeT + 0.5, 100, "overshoot")],
      }),
    );
  });

  // Bar chart that grows from the baseline (anchorY = 1); the peak is highlighted.
  const baseY = 940;
  const heights = [120, 200, 160, 280, 230, 320, 260];
  const peak = heights.indexOf(Math.max(...heights));
  const bars: Layer[] = [];
  heights.forEach((hgt, i) => {
    const bx = 360 + i * 200;
    const delay = 1.8 + i * 0.1;
    const isPeak = i === peak;
    bars.push(
      shape(`Bar ${i + 1}`, "rect", bx, baseY, 96, hgt, isPeak ? "#34d399" : "#22d3ee", {
        r: 14, anchorY: 1,
        gradientTo: isPeak ? "#22d3ee" : "#0ea5e9", gradientAngle: 0,
        effects: isPeak ? [glow("#34d399", 0.9)] : [],
        // grow in, then the peak pulses in beat 2
        asy: isPeak
          ? [k(delay, 0, "settle"), k(delay + 0.6, 100, "settle"), k(5.4, 100, "gentle"), k(5.7, 114, "overshoot"), k(6.1, 100, "settle")]
          : [k(delay, 0, "settle"), k(delay + 0.6, 100, "settle")],
      }),
    );
  });
  const axis = shape("Axis", "rect", 960, baseY + 4, 1480, 3, "#2a3a5c", {
    anchorX: 0.5, asx: [k(1.7, 0, "snappy"), k(2.3, 100, "snappy")],
  });
  // Peak marker + caption (beat 2).
  const peakX = 360 + peak * 200;
  const peakDot = shape("Peak Dot", "ellipse", peakX, baseY - heights[peak] - 46, 26, 26, "#34d399", {
    effects: [glow("#34d399", 1.0)], aop: op(5.5),
    as: [k(5.5, 0, "overshoot"), k(6.0, 100, "overshoot")],
  });
  const peakLabel = text("Peak Label", "Best day · +18%", peakX, baseY - heights[peak] - 92, 26, 700, "#a7f3d0", {
    aop: op(5.7), ay: [k(5.7, baseY - heights[peak] - 72, "settle"), k(6.1, baseY - heights[peak] - 92, "settle")],
  });
  // LIVE indicator (top-right, pulsing).
  const liveDot = shape("Live Dot", "ellipse", 1640, 130, 22, 22, "#34d399", {
    effects: [glow("#34d399", 1.0)], aop: op(0.3), behaviors: [oscillateScale(1.1, 18)],
  });
  const liveText = text("Live", "LIVE", 1710, 124, 30, 800, "#34d399", { letter: 4, align: "left", aop: op(0.5) });
  // Trend caption (bottom).
  const trend = text("Trend", "▲ Revenue up 18% vs last quarter", 960, 1010, 30, 600, "#86efac", {
    aop: op(6.4), ay: [k(6.4, 1035, "settle"), k(6.8, 1010, "settle")],
  });

  return doc("Metrics Dashboard", 1920, 1080, DUR, "#0b1220", [
    bg, grid, title, subtitle, ...cards, axis, ...bars,
    peakDot, peakLabel, liveDot, liveText, trend,
  ]);
}

/** 4 — Logo Sting (1:1, 6.5s) — burst, draw-on emblem, monogram, wordmark, tagline. */
function logoSting(): SceneDocument {
  const DUR = 6.5;
  const c = 540;
  const my = 400; // emblem centre (upper third)
  const bg = shape("Backdrop", "rect", c, c, 1080, 1080, "#0a0800", {
    gradientTo: "#2e1f06", gradientAngle: 135,
  });
  // Radial burst of shards springing out then fading.
  const shard = shape("Burst", "rect", c, my, 14, 88, "#fbbf24", {
    r: 7,
    cloner: clonerOf({ mode: "radial", count: 18, radius: 290, faceOut: true, stagger: 0.012 }),
    effects: [glow("#f59e0b", 1.2)],
    as: [k(0.5, 0, "overshoot"), k(1.1, 100, "overshoot"), k(2.0, 100, "gentle"), k(2.8, 0, "easeIn")],
    aop: [k(0.5, 0, "gentle"), k(0.9, 100, "gentle"), k(2.2, 100, "gentle"), k(2.9, 0, "gentle")],
  });
  // Draw-on ring emblem.
  const ring = shape("Emblem Ring", "ellipse", c, my, 320, 320, "#0a0800", {
    stroke: { color: "#fcd34d", width: 10, cap: "round" },
    trimEnd: [k(0.4, 0, "settle"), k(1.6, 100, "settle")],
    effects: [glow("#f59e0b", 1.0)],
  });
  // Monogram that pops, then idles with a gentle pulse.
  const mark = text("Monogram", "LM", c, my + 10, 176, 800, "#ffffff", {
    letter: -6,
    as: [k(1.2, 0, "overshoot"), k(1.9, 100, "overshoot")],
    aop: [k(1.2, 0, "gentle"), k(1.6, 100, "gentle")],
    arot: [k(1.2, -12, "overshoot"), k(1.9, 0, "overshoot")],
    behaviors: [oscillateScale(0.7, 1.5)],
  });
  const sweep = shape("Sweep", "rect", c, my, 320, 320, "#ffffff", {
    opacity: 0, blend: "add", r: 160,
    aop: [k(1.9, 0, "gentle"), k(2.1, 50, "gentle"), k(2.5, 0, "gentle")],
  });
  // Wordmark types in below the emblem.
  const wordmark = text("Wordmark", "LOFT MOTION", c, 660, 70, 800, "#ffffff", {
    letter: 6,
    animator: { kind: "typewriter", unit: "character", stagger: 0.045, duration: 0.25, start: 2.6 },
    aop: [k(2.5, 100, "gentle")],
  });
  // Tagline + draw-on underline.
  const tag = text("Tagline", "MOTION, MADE SIMPLE", c, 760, 30, 600, "#e0c587", {
    letter: 10, aop: [k(3.6, 0, "gentle"), k(4.1, 100, "gentle")],
    ay: [k(3.6, 790, "settle"), k(4.1, 760, "settle")],
  });
  const tagLine = shape("Underline", "rect", c, 808, 380, 4, "#fbbf24", {
    r: 2, anchorX: 0.5, asx: [k(3.9, 0, "snappy"), k(4.5, 100, "snappy")],
  });
  // Final flash + settle.
  const flash = shape("Flash", "rect", c, c, 1080, 1080, "#fff4d6", {
    opacity: 0, blend: "add", aop: [k(4.6, 0, "gentle"), k(4.75, 22, "gentle"), k(5.1, 0, "gentle")],
  });
  return doc("Logo Sting", 1080, 1080, DUR, "#0a0800", [
    bg, shard, ring, mark, sweep, wordmark, tag, tagLine, flash,
  ]);
}

/** 5 — Broadcast Lower Third (16:9, 7s) — logo bug, name/title, handle; in/hold/out. */
function lowerThird(): SceneDocument {
  const DUR = 7;
  // Whole lockup slides in from the left, holds, then slides out together.
  const sl = (rx: number, tin: number): Keyframe[] => [
    k(tin, rx - 1200, "settle"), k(tin + 0.7, rx, "settle"),
    k(5.7, rx, "gentle"), k(6.4, rx - 1200, "easeIn"),
  ];
  const fade = (tin: number): Keyframe[] => [
    k(tin, 0, "gentle"), k(tin + 0.4, 100, "gentle"), k(5.8, 100, "gentle"), k(6.3, 0, "gentle"),
  ];
  const bg = shape("Backdrop", "rect", 960, 540, 1920, 1080, "#10131c", {
    gradientTo: "#05060a", gradientAngle: 120,
  });
  const bar = shape("Bar", "rect", 230, 822, 920, 184, "#151a26", {
    r: 18, anchorX: 0, stroke: { color: "#283143", width: 1.5 }, effects: [shadow()],
    ax: sl(230, 0.3), aop: fade(0.3),
  });
  const topEdge = shape("Top Accent", "rect", 230, 732, 920, 6, "#ef4444", {
    anchorX: 0, effects: [glow("#ef4444", 0.8)], ax: sl(230, 0.4),
    asx: [k(0.7, 0, "snappy"), k(1.5, 100, "snappy")], aop: fade(0.4),
  });
  const bug = shape("Logo Bug", "ellipse", 372, 822, 116, 116, "#ef4444", {
    gradientTo: "#f59e0b", gradientAngle: 135, effects: [glow("#ef4444", 0.9)],
    ax: sl(372, 0.5), aop: fade(0.5),
    as: [k(0.6, 0, "overshoot"), k(1.2, 100, "overshoot")],
  });
  const bugMark = text("Bug Mark", "A", 372, 808, 66, 800, "#ffffff", {
    ax: sl(372, 0.6), aop: fade(0.7),
  });
  const name = text("Name", "Avery Cole", 730, 786, 58, 800, "#ffffff", {
    ax: sl(730, 0.7), aop: fade(0.7),
  });
  const role = text("Role", "Lead Motion Designer", 730, 848, 32, 500, "#9aa6c0", {
    ax: sl(730, 0.85), aop: fade(0.85),
  });
  const underline = shape("Underline", "rect", 530, 824, 280, 4, "#ef4444", {
    anchorX: 0, ax: sl(530, 1.0),
    asx: [k(1.2, 0, "snappy"), k(1.8, 100, "snappy")], aop: fade(1.0),
  });
  const handle = text("Handle", "@averycole · loftmotion.app", 730, 896, 24, 500, "#5b6577", {
    ax: sl(730, 1.0), aop: fade(1.0),
  });
  return doc("Broadcast Lower Third", 1920, 1080, DUR, "#10131c", [
    bg, bar, topEdge, bug, bugMark, name, role, underline, handle,
  ]);
}

/** 6 — Kinetic Quote (16:9, 8s) — lines build word by word, punchline emphasis, settle. */
function kineticQuote(): SceneDocument {
  const DUR = 8;
  const bg = shape("Backdrop", "rect", 960, 540, 1920, 1080, "#160d12", {
    gradientTo: "#341622", gradientAngle: 135,
  });
  const blob = shape("Glow", "ellipse", 960, 540, 1180, 1180, "#fb7185", {
    opacity: 26, blend: "screen", effects: [bloom(1.6)],
    as: [k(0, 70, "settle"), k(2, 100, "settle"), k(4.5, 92, "settle"), k(6.5, 100, "settle")],
    behaviors: [wiggle("position", 0.18, 46)],
  });
  const quoteOpen = text("Quote Open", "“", 350, 350, 300, 800, "#fb7185", {
    aop: [k(0.1, 0, "gentle"), k(0.7, 65, "gentle")],
    as: [k(0.1, 60, "overshoot"), k(0.8, 100, "overshoot")],
  });
  const quoteClose = text("Quote Close", "”", 1580, 740, 300, 800, "#fb7185", {
    aop: [k(3.0, 0, "gentle"), k(3.6, 65, "gentle")],
    as: [k(3.0, 60, "overshoot"), k(3.7, 100, "overshoot")],
  });
  // Big multi-line quote, revealed word by word.
  const line1 = text("Line 1", "Design is not just", 960, 420, 96, 800, "#ffffff", {
    animator: { kind: "fade-up", unit: "word", stagger: 0.09, duration: 0.55, start: 0.5 },
  });
  const line2 = text("Line 2", "what it looks like.", 960, 550, 96, 800, "#ffffff", {
    animator: { kind: "fade-up", unit: "word", stagger: 0.09, duration: 0.55, start: 1.3 },
  });
  // Punchline — accent colour, glow, with an extra scale-pop emphasis.
  const line3 = text("Line 3", "It's how it moves.", 960, 690, 108, 800, "#fb7185", {
    effects: [glow("#fb7185", 0.7)],
    animator: { kind: "fade-up", unit: "word", stagger: 0.1, duration: 0.6, start: 2.2 },
    as: [k(2.2, 90, "settle"), k(3.2, 104, "overshoot"), k(3.7, 100, "settle")],
  });
  const rule = shape("Rule", "rect", 960, 830, 380, 4, "#fb7185", {
    anchorX: 0.5, asx: [k(3.4, 0, "snappy"), k(4.0, 100, "snappy")],
  });
  const author = text("Author", "— The Motion Manifesto", 960, 890, 34, 500, "#d9a8b4", {
    letter: 4, aop: [k(3.7, 0, "gentle"), k(4.3, 100, "gentle")], ay: [k(3.7, 920, "settle"), k(4.3, 890, "settle")],
  });
  return doc("Kinetic Quote", 1920, 1080, DUR, "#160d12", [
    bg, blob, quoteOpen, quoteClose, line1, line2, line3, rule, author,
  ]);
}

/* ----- Figma Motion-style micro-interactions (clean, light UI) ------------ */

/** 7 — Toggle Switch (Figma-style micro-interaction, 1:1). */
function figmaToggle(): SceneDocument {
  const DUR = 3;
  const cx = 540;
  const bg = shape("Backdrop", "rect", cx, 540, 1080, 1080, "#eef1f5");
  const card = shape("Card", "rect", cx, 540, 600, 520, "#ffffff", {
    r: 44, effects: [shadow()],
    as: [k(0, 92, "settle"), k(0.4, 100, "settle")],
    aop: [k(0, 0, "gentle"), k(0.3, 100, "gentle")],
  });
  const label = text("Label", "Notifications", cx, 430, 48, 700, "#18181b", {
    aop: [k(0.15, 0, "gentle"), k(0.45, 100, "gentle")],
  });
  const trackGray = shape("Track Off", "rect", cx, 580, 240, 108, "#d1d5db", {
    r: 54, aop: [k(0.2, 0, "gentle"), k(0.45, 100, "gentle")],
  });
  const trackGreen = shape("Track On", "rect", cx, 580, 240, 108, "#22c55e", {
    r: 54, aop: [k(0.6, 0, "snappy"), k(1.0, 100, "snappy")],
  });
  const knob = shape("Knob", "ellipse", cx, 580, 84, 84, "#ffffff", {
    effects: [shadow()],
    ax: [k(0.6, cx - 66, "overshoot"), k(1.2, cx + 66, "overshoot")],
  });
  const status = text("Status", "On", cx, 700, 32, 700, "#16a34a", {
    aop: [k(1.0, 0, "gentle"), k(1.4, 100, "gentle")],
    ay: [k(1.0, 720, "settle"), k(1.4, 700, "settle")],
  });
  return doc("Toggle Switch", 1080, 1080, DUR, "#eef1f5", [
    bg, card, label, trackGray, trackGreen, knob, status,
  ]);
}

/** 8 — Button Press (Figma-style micro-interaction, 1:1). */
function figmaButtonPress(): SceneDocument {
  const DUR = 3;
  const cx = 540;
  const bg = shape("Backdrop", "rect", cx, 540, 1080, 1080, "#eef1f5");
  const press = [
    k(0, 100, "gentle"), k(0.7, 100, "gentle"), k(0.85, 93, "sharp"),
    k(1.0, 93, "gentle"), k(1.25, 100, "overshoot"),
  ];
  const button = shape("Button", "rect", cx, 540, 460, 140, "#2563eb", {
    r: 70, effects: [shadow()], as: press,
  });
  const label = text("Label", "Add to cart", cx, 540, 40, 700, "#ffffff", { as: press });
  const ripple = shape("Ripple", "ellipse", cx, 540, 200, 200, "#eef1f5", {
    stroke: { color: "#2563eb", width: 8 },
    as: [k(0.85, 30, "gentle"), k(1.5, 380, "gentle")],
    aop: [k(0.85, 70, "gentle"), k(1.5, 0, "gentle")],
  });
  const done = text("Confirm", "Added to cart ✓", cx, 710, 30, 600, "#16a34a", {
    aop: [k(1.3, 0, "gentle"), k(1.7, 100, "gentle")],
    ay: [k(1.3, 730, "settle"), k(1.7, 710, "settle")],
  });
  return doc("Button Press", 1080, 1080, DUR, "#eef1f5", [bg, button, label, ripple, done]);
}

/** 9 — Loading Spinner (Figma's signature trim-path loader, 1:1). */
function figmaLoader(): SceneDocument {
  const DUR = 2.4;
  const cx = 540;
  const bg = shape("Backdrop", "rect", cx, 540, 1080, 1080, "#f3f4f6");
  const card = shape("Card", "rect", cx, 540, 520, 520, "#ffffff", { r: 40, effects: [shadow()] });
  const ring = shape("Spinner", "ellipse", cx, 540, 240, 240, "#ffffff", {
    stroke: { color: "#6366f1", width: 18, cap: "round" },
    trimEnd: [k(0, 8, "gentle"), k(1.2, 78, "gentle"), k(2.4, 8, "gentle")],
    behaviors: [spin(220)],
  });
  const label = text("Label", "Loading…", cx, 770, 30, 600, "#6b7280");
  return doc("Loading Spinner", 1080, 1080, DUR, "#f3f4f6", [bg, card, ring, label]);
}

/** 10 — Notification Toast (Figma-style, 16:9; slide up, hold, slide out). */
function figmaToast(): SceneDocument {
  const DUR = 4;
  const bg = shape("Backdrop", "rect", 960, 540, 1920, 1080, "#eaecef");
  // Shared slide-in/out for the toast and everything riding on it.
  const slide = (ry: number): Keyframe[] => [
    k(0.3, ry + 360, "settle"), k(1.0, ry, "settle"),
    k(2.8, ry, "gentle"), k(3.5, ry + 360, "easeIn"),
  ];
  const fade: Keyframe[] = [
    k(0.3, 0, "gentle"), k(0.7, 100, "gentle"), k(3.0, 100, "gentle"), k(3.5, 0, "gentle"),
  ];
  const toast = shape("Toast", "rect", 960, 820, 760, 150, "#ffffff", {
    r: 28, effects: [shadow()], ay: slide(820), aop: fade,
  });
  const check = shape("Check", "ellipse", 680, 820, 84, 84, "#16a34a", {
    ay: slide(820),
    as: [k(1.0, 0, "overshoot"), k(1.5, 100, "overshoot")],
    aop: [k(1.0, 0, "gentle"), k(1.3, 100, "gentle"), k(3.0, 100, "gentle"), k(3.4, 0, "gentle")],
  });
  const tick = text("Tick", "✓", 680, 812, 46, 800, "#ffffff", {
    ay: slide(812),
    aop: [k(1.2, 0, "gentle"), k(1.5, 100, "gentle"), k(3.0, 100, "gentle"), k(3.4, 0, "gentle")],
  });
  const title = text("Title", "Payment successful", 1015, 793, 38, 700, "#18181b", {
    ay: slide(793), aop: fade,
  });
  const subtitle = text("Subtitle", "Your order is confirmed.", 1015, 848, 26, 400, "#6b7280", {
    ay: slide(848), aop: fade,
  });
  return doc("Notification Toast", 1920, 1080, DUR, "#eaecef", [
    bg, toast, check, tick, title, subtitle,
  ]);
}

/** 11 — Card Hover Lift (Figma-style, 16:9; lift on hover, hold, settle). */
function figmaCardHover(): SceneDocument {
  const DUR = 4;
  const bg = shape("Backdrop", "rect", 960, 540, 1920, 1080, "#e9ebef");
  // Uniform lift (translateY) so the whole card moves together without parenting.
  const lift = (ry: number): Keyframe[] => [
    k(0.8, ry, "settle"), k(1.4, ry - 48, "settle"),
    k(2.8, ry - 48, "gentle"), k(3.4, ry, "settle"),
  ];
  const fin: Keyframe[] = [k(0, 0, "gentle"), k(0.4, 100, "gentle")];
  const card = shape("Card", "rect", 960, 560, 520, 680, "#ffffff", {
    r: 28, effects: [shadow()], ay: lift(560), aop: fin,
  });
  const header = shape("Header", "rect", 960, 360, 476, 220, "#6366f1", {
    r: 18, gradientTo: "#a855f7", gradientAngle: 120, ay: lift(360), aop: fin,
  });
  const title = text("Title", "Aurora Headphones", 960, 540, 34, 700, "#18181b", {
    ay: lift(540), aop: fin,
  });
  const price = text("Price", "$249", 960, 600, 30, 700, "#6366f1", { ay: lift(600), aop: fin });
  const meta = text("Meta", "Wireless · 40h battery", 960, 650, 24, 400, "#9ca3af", {
    ay: lift(650), aop: fin,
  });
  const button = shape("Button", "rect", 960, 790, 360, 76, "#2563eb", {
    r: 38, ay: lift(790), aop: fin,
  });
  const buttonLabel = text("Button Label", "Add to cart", 960, 790, 28, 700, "#ffffff", {
    ay: lift(790), aop: fin,
  });
  return doc("Card Hover", 1920, 1080, DUR, "#e9ebef", [
    bg, card, header, title, price, meta, button, buttonLabel,
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

/**
 * Full templates — finished, multi-scene animations you open and customise.
 * These are sequences with real beats (build → reveal → resolve), not single
 * states. (The single-trick UI micro-interactions live in MICRO_PRESETS below.)
 */
const FULL_TEMPLATES: TemplateDef[] = [
  {
    id: "tpl-aurora-promo",
    name: "Aurora Product Promo",
    blurb: "A full product-launch sequence — logo intro, headline build, glowing product reveal, feature highlights and a CTA.",
    tools: ["16:9", "Multi-scene", "Bloom", "Kinetic text", "Spring"],
    build: auroraPromo,
  },
  {
    id: "tpl-app-onboarding",
    name: "App Onboarding Flow",
    blurb: "A vertical three-screen onboarding that slides between Welcome, Features and Get-started.",
    tools: ["9:16", "Screen transitions", "Stagger", "Spring"],
    build: appOnboarding,
  },
  {
    id: "tpl-metrics-dashboard",
    name: "Metrics Dashboard",
    blurb: "A dashboard that builds itself — cards count up, bars grow, a trend draws on and a KPI updates live.",
    tools: ["Counters", "Trend line", "Stagger", "Cloner"],
    build: metricsDashboard,
  },
  {
    id: "tpl-logo-sting",
    name: "Logo Sting",
    blurb: "A punchy logo reveal — shard burst, draw-on ring, monogram pop, wordmark and tagline with a light sweep.",
    tools: ["Trim paths", "Radial cloner", "Glow", "Overshoot"],
    build: logoSting,
  },
  {
    id: "tpl-lower-third",
    name: "Broadcast Lower Third",
    blurb: "A broadcast name/title bar with logo bug and handle that slides in, holds, then slides out.",
    tools: ["Slide in/out", "Draw-on", "Glow"],
    build: lowerThird,
  },
  {
    id: "tpl-kinetic-quote",
    name: "Kinetic Quote",
    blurb: "Dynamic typography — lines build word by word with emphasis and colour shifts, then resolve to the author.",
    tools: ["Kinetic text", "Bloom", "Emphasis"],
    build: kineticQuote,
  },
];

/** Single-concept UI micro-interactions — presets, not full templates. */
const MICRO_PRESETS: TemplateDef[] = [
  {
    id: "tpl-toggle",
    name: "Toggle Switch",
    blurb: "A clean UI toggle that springs on — knob slides with overshoot as the track turns green.",
    tools: ["Micro-interaction", "Spring", "Light UI"],
    build: figmaToggle,
  },
  {
    id: "tpl-button-press",
    name: "Button Press",
    blurb: "A button that presses in and springs back with a ripple and a confirmation.",
    tools: ["Micro-interaction", "Ripple", "Overshoot"],
    build: figmaButtonPress,
  },
  {
    id: "tpl-loader",
    name: "Loading Spinner",
    blurb: "Figma's signature loader — a trim-path arc that grows and shrinks while it spins.",
    tools: ["Trim paths", "Spin", "Loop"],
    build: figmaLoader,
  },
  {
    id: "tpl-toast",
    name: "Notification Toast",
    blurb: "A success toast that slides up, pops a check, holds, then slides away.",
    tools: ["Slide in/out", "Spring", "Light UI"],
    build: figmaToast,
  },
  {
    id: "tpl-card-hover",
    name: "Card Hover",
    blurb: "A product card that lifts on hover and settles back — soft, deliberate motion.",
    tools: ["Hover lift", "Ease-out", "Light UI"],
    build: figmaCardHover,
  },
];

/** Full templates — the "Templates" tab of the gallery. */
export const TEMPLATE_PROJECTS: ExampleProject[] = FULL_TEMPLATES.map((t) => ({
  ...t,
  category: "Showcase",
}));

/** Micro-interaction presets — folded into the "Presets" tab of the gallery. */
export const MICRO_PRESET_PROJECTS: ExampleProject[] = MICRO_PRESETS.map((t) => ({
  ...t,
  category: "Micro-interactions",
}));
