/**
 * Loft Motion — example projects gallery.
 *
 * Each is a ready-made scene document showcasing the procedural tools. They load
 * via the Examples launcher and are designed to look great instantly.
 */
import {
  SCENE_VERSION,
  type Behavior,
  type BehaviorTarget,
  type BehaviorType,
  type Cloner,
  type Layer,
  type SceneDocument,
} from "@/lib/scene/schema";
import {
  createCloner,
  createEffect,
  createShapeLayer,
  createTextLayer,
  defaultComposition,
  uid,
} from "@/lib/scene/factory";
import { defaultBehaviorParams } from "@/lib/anim/behaviors";
import type { Effect } from "@/lib/scene/schema";

/** Build an effect and override some numeric params + colour. */
function fx(
  type: Parameters<typeof createEffect>[0],
  params: Record<string, number> = {},
  color?: string,
): Effect {
  const e = createEffect(type);
  for (const [k, v] of Object.entries(params)) {
    if (e.params[k]) e.params[k].value = v;
  }
  if (color) e.color = color;
  return e;
}

function beh(
  type: BehaviorType,
  target: BehaviorTarget,
  params: Record<string, number> = {},
  opts: { strength?: number; loop?: boolean } = {},
): Behavior {
  return {
    id: uid("beh"),
    type,
    enabled: true,
    target,
    strength: opts.strength ?? 1,
    params: { ...defaultBehaviorParams(type), ...params },
    loop: opts.loop ?? (type === "wiggle" || type === "oscillate"),
  };
}

function cloner(over: Partial<Cloner>): Cloner {
  return { ...createCloner(), ...over };
}

/** Browsable template categories (Figma-style gallery filtering). */
export type ExampleCategory =
  | "Showcase"
  | "Loading"
  | "Logo & Brand"
  | "Text"
  | "Micro-interactions"
  | "Reveals"
  | "Backgrounds";

export const EXAMPLE_CATEGORIES: ExampleCategory[] = [
  "Showcase",
  "Loading",
  "Logo & Brand",
  "Text",
  "Micro-interactions",
  "Reveals",
  "Backgrounds",
];

export interface ExampleProject {
  id: string;
  name: string;
  blurb: string;
  /** Tools used, for the gallery card. */
  tools: string[];
  /** Gallery category, for filtering. */
  category: ExampleCategory;
  build: () => SceneDocument;
}

function doc(name: string, layers: Layer[], bg = "#0e0e12", duration = 5): SceneDocument {
  return {
    version: SCENE_VERSION,
    name,
    composition: { ...defaultComposition(), background: bg, duration },
    layers,
    assets: [],
    palette: { swatches: [] },
  };
}

/* -------------------------------------------------------------------------- */

const EXAMPLES: Omit<ExampleProject, "category">[] = [
  {
    id: "floating-particles",
    name: "Floating Particles",
    blurb: "A drifting field of dots — Cloner + per-clone Wiggle.",
    tools: ["Cloner (grid)", "Wiggle"],
    build: () => {
      const dot = createShapeLayer("ellipse", { name: "Particle", x: 960, y: 540 });
      dot.shape = { ...dot.shape!, width: 26, height: 26, fill: { color: "#79aede" } };
      dot.cloner = cloner({ mode: "grid", cols: 9, rows: 6, spacingX: 180, spacingY: 150, stepOpacity: 0, stagger: 0.05 });
      dot.behaviors = [beh("wiggle", "position", { freq: 0.8, amp: 40 }, { loop: true })];
      dot.effects = [];
      return doc("Floating Particles", [dot]);
    },
  },
  {
    id: "pulsing-logo",
    name: "Pulsing Logo",
    blurb: "A title that breathes — Oscillate on scale + opacity.",
    tools: ["Oscillate"],
    build: () => {
      const t = createTextLayer({ name: "Logo", x: 960, y: 540 });
      t.text = { ...t.text!, content: "LOFT", fontSize: 220, fontWeight: 800, fill: "#f2f2f2" };
      t.behaviors = [
        beh("oscillate", "scale", { freq: 0.5, amp: 8 }, { loop: true }),
        beh("oscillate", "opacity", { freq: 0.5, amp: 8 }, { loop: true }),
      ];
      return doc("Pulsing Logo", [t]);
    },
  },
  {
    id: "loading-spinner",
    name: "Loading Spinner",
    blurb: "Radial dashes spinning with a trailing fade.",
    tools: ["Cloner (radial)", "Spin", "Per-clone fade"],
    build: () => {
      const dash = createShapeLayer("rect", { name: "Dash", x: 960, y: 540 });
      dash.shape = { ...dash.shape!, width: 18, height: 54, cornerRadius: 9, fill: { color: "#5ce1ff" } };
      dash.cloner = cloner({ mode: "radial", count: 12, radius: 120, faceOut: true, stepOpacity: -7, stagger: 0 });
      dash.behaviors = [beh("spin", "rotation", { rate: 200 })];
      return doc("Loading Spinner", [dash]);
    },
  },
  {
    id: "audio-bars",
    name: "Audio Bars",
    blurb: "A row of bars bouncing in a traveling wave.",
    tools: ["Cloner (line)", "Oscillate (phased)"],
    build: () => {
      const bar = createShapeLayer("rect", { name: "Bar", x: 960, y: 540 });
      bar.shape = { ...bar.shape!, width: 36, height: 200, cornerRadius: 18, fill: { color: "#4f8fcb" } };
      bar.cloner = cloner({ mode: "line", count: 13, spacingX: 56, stagger: 0.06 });
      bar.behaviors = [beh("oscillate", "scale", { freq: 1.2, amp: 60 }, { loop: true })];
      return doc("Audio Bars", [bar]);
    },
  },
  {
    id: "confetti-burst",
    name: "Confetti Burst",
    blurb: "Radial spring-out with spin and drift.",
    tools: ["Cloner (radial)", "Spring", "Spin", "Wiggle"],
    build: () => {
      const bit = createShapeLayer("rect", { name: "Confetti", x: 960, y: 540 });
      bit.shape = { ...bit.shape!, width: 30, height: 30, cornerRadius: 6, fill: { color: "#ff5c9d" } };
      bit.cloner = cloner({ mode: "radial", count: 16, radius: 360, stepRotation: 22, stagger: 0.02 });
      bit.behaviors = [
        beh("spring", "scale", { from: 100, stiffness: 160, damping: 11, delay: 0 }),
        beh("spin", "rotation", { rate: 120 }),
        beh("wiggle", "position", { freq: 1.2, amp: 20 }, { loop: true }),
      ];
      return doc("Confetti Burst", [bit]);
    },
  },
  {
    id: "orbiting-dots",
    name: "Orbiting Dots",
    blurb: "Concentric rings of dots circling the centre.",
    tools: ["Cloner (radial)", "Orbit", "Stagger radius"],
    build: () => {
      const dot = createShapeLayer("ellipse", { name: "Orbiter", x: 960, y: 540 });
      dot.shape = { ...dot.shape!, width: 28, height: 28, fill: { color: "#79aede" } };
      dot.cloner = cloner({ mode: "radial", count: 10, radius: 220, stagger: 0.04 });
      dot.behaviors = [beh("orbit", "position", { radius: 60, rate: 90 })];
      return doc("Orbiting Dots", [dot]);
    },
  },
  {
    id: "wave-text",
    name: "Wave Text",
    blurb: "Tiles bobbing in a smooth traveling wave.",
    tools: ["Cloner (line)", "Oscillate (phased)"],
    build: () => {
      const sq = createShapeLayer("rect", { name: "Tile", x: 960, y: 540 });
      sq.shape = { ...sq.shape!, width: 60, height: 60, cornerRadius: 12, fill: { color: "#5cb88a" } };
      sq.cloner = cloner({ mode: "line", count: 10, spacingX: 90, stagger: 0.1 });
      sq.behaviors = [beh("oscillate", "position", { freq: 0.8, amp: 70 }, { loop: true })];
      return doc("Wave Text", [sq]);
    },
  },
  {
    id: "wobble-blob",
    name: "Wobble Blob",
    blurb: "A soft star slowly morphing and turning.",
    tools: ["Wiggle", "Spin", "Glow"],
    build: () => {
      const blob = createShapeLayer("star", { name: "Blob", x: 960, y: 540 });
      blob.shape = { ...blob.shape!, width: 340, height: 340, points: 7, fill: { color: "#7c5cff" } };
      blob.behaviors = [
        beh("wiggle", "scale", { freq: 0.6, amp: 12 }, { loop: true }),
        beh("spin", "rotation", { rate: 20 }),
      ];
      blob.effects = [
        fx("bloom", { intensity: 1.4, threshold: 0.4, radius: 2.4, chroma: 0.2 }, "#ffffff"),
      ];
      return doc("Wobble Blob", [blob]);
    },
  },
  {
    id: "bouncy-pop",
    name: "Bouncy Pop",
    blurb: "An icon that springs in with a satisfying overshoot.",
    tools: ["Spring"],
    build: () => {
      const c = createShapeLayer("rect", { name: "Button", x: 960, y: 540 });
      c.shape = { ...c.shape!, width: 260, height: 260, cornerRadius: 60, fill: { color: "#4f8fcb" } };
      c.behaviors = [beh("spring", "scale", { from: 100, stiffness: 180, damping: 10, delay: 0.2 })];
      return doc("Bouncy Pop", [c]);
    },
  },
  {
    id: "staggered-grid",
    name: "Staggered Grid Reveal",
    blurb: "The signature cascade — a grid springs in cell by cell.",
    tools: ["Cloner (grid)", "Spring", "Stagger"],
    build: () => {
      const cell = createShapeLayer("rect", { name: "Cell", x: 960, y: 540 });
      cell.shape = { ...cell.shape!, width: 80, height: 80, cornerRadius: 14, fill: { color: "#58c8d6" } };
      cell.cloner = cloner({ mode: "grid", cols: 7, rows: 5, spacingX: 110, spacingY: 110, stagger: 0.06 });
      cell.behaviors = [beh("spring", "scale", { from: 100, stiffness: 200, damping: 13, delay: 0 })];
      return doc("Staggered Grid Reveal", [cell]);
    },
  },
  {
    id: "radial-pulse",
    name: "Radial Pulse Rings",
    blurb: "Concentric rings pulsing outward in sequence.",
    tools: ["Cloner (radial)", "Oscillate (phased)"],
    build: () => {
      const ring = createShapeLayer("ellipse", { name: "Ring", x: 960, y: 540 });
      ring.shape = {
        ...ring.shape!,
        width: 80,
        height: 80,
        fill: { color: "#0e0e12" },
        stroke: { color: "#79aede", width: 6 },
      };
      ring.cloner = cloner({ mode: "radial", count: 6, radius: 0, stepScale: 90, stagger: 0.12, stepOpacity: -10 });
      ring.behaviors = [beh("oscillate", "scale", { freq: 0.6, amp: 30 }, { loop: true })];
      return doc("Radial Pulse Rings", [ring]);
    },
  },
  {
    id: "jelly-drift",
    name: "Jelly Drift",
    blurb: "Wobbling tiles with springy scale and gentle drift.",
    tools: ["Cloner (grid)", "Spring", "Wiggle"],
    build: () => {
      const tile = createShapeLayer("ellipse", { name: "Jelly", x: 960, y: 540 });
      tile.shape = { ...tile.shape!, width: 90, height: 90, fill: { color: "#d6a14f" } };
      tile.cloner = cloner({ mode: "grid", cols: 6, rows: 4, spacingX: 150, spacingY: 150, stagger: 0.08 });
      tile.behaviors = [
        beh("spring", "scale", { from: 80, stiffness: 150, damping: 9, delay: 0 }),
        beh("wiggle", "position", { freq: 0.7, amp: 18 }, { loop: true }),
      ];
      return doc("Jelly Drift", [tile]);
    },
  },
  {
    id: "neon-orbit",
    name: "Neon Orbit",
    blurb: "Glowing dots orbiting with a long trailing stagger.",
    tools: ["Cloner (radial)", "Orbit", "Glow"],
    build: () => {
      const dot = createShapeLayer("ellipse", { name: "Neon", x: 960, y: 540 });
      dot.shape = { ...dot.shape!, width: 36, height: 36, fill: { color: "#5ce1ff" } };
      dot.cloner = cloner({ mode: "radial", count: 14, radius: 240, stagger: 0.05, stepOpacity: -3 });
      dot.behaviors = [beh("orbit", "position", { radius: 70, rate: 70 })];
      dot.effects = [fx("glow", { intensity: 1.6, threshold: 0.3, radius: 1.2 }, "#5ce1ff")];
      return doc("Neon Orbit", [dot]);
    },
  },
  {
    id: "draw-on",
    name: "Draw-On Lines",
    blurb: "Self-drawing stroked shapes — Trim Paths animating Start→End.",
    tools: ["Trim Paths", "Cloner (line)", "Stagger"],
    build: () => {
      const ring = createShapeLayer("ellipse", { name: "Stroke", x: 960, y: 540 });
      ring.shape = {
        ...ring.shape!,
        width: 220,
        height: 220,
        fill: { color: "#0e0e12" },
        stroke: { color: "#58c8d6", width: 10, cap: "round" },
        trim: {
          enabled: true,
          start: { value: 0, keyframes: [] },
          end: {
            value: 100,
            keyframes: [
              { id: uid("kf"), time: 0, value: 0, easing: "settle" },
              { id: uid("kf"), time: 1.6, value: 100, easing: "settle" },
            ],
          },
          offset: { value: -90, keyframes: [] },
        },
      };
      ring.cloner = cloner({ mode: "line", count: 4, spacingX: 280, stagger: 0.25, stepScale: -10 });
      return doc("Draw-On Lines", [ring]);
    },
  },
  {
    id: "kinetic-headline",
    name: "Kinetic Headline",
    blurb: "Caption-style text that reveals word by word.",
    tools: ["Kinetic typography", "Text"],
    build: () => {
      const t = createTextLayer({ name: "Headline", x: 960, y: 540 });
      t.text = {
        ...t.text!,
        content: "Make it move",
        fontSize: 150,
        fontWeight: 800,
        fill: "#f2f2f2",
        animator: { kind: "fade-up", unit: "word", stagger: 0.12, duration: 0.6, start: 0.1 },
      };
      return doc("Kinetic Headline", [t]);
    },
  },
  {
    id: "stat-counter",
    name: "Stat Counter",
    blurb: "An animated number counting up — perfect for stats.",
    tools: ["Number counter", "Text"],
    build: () => {
      const t = createTextLayer({ name: "Stat", x: 960, y: 540 });
      t.text = {
        ...t.text!,
        content: "0",
        fontSize: 220,
        fontWeight: 800,
        fill: "#5ce1ff",
        counter: { enabled: true, from: 0, to: 12500, decimals: 0, prefix: "", suffix: "+", separator: true },
      };
      return doc("Stat Counter", [t]);
    },
  },
  {
    id: "toggle-micro",
    name: "Toggle (micro-interaction)",
    blurb: "A pill toggle with a springy knob — UI micro-interaction.",
    tools: ["Spring", "Micro-interaction"],
    build: () => {
      const track = createShapeLayer("rect", { name: "Track", x: 960, y: 540 });
      track.shape = { ...track.shape!, width: 260, height: 110, cornerRadius: 55, fill: { color: "#4f8fcb" } };
      const knob = createShapeLayer("ellipse", { name: "Knob", x: 870, y: 540 });
      knob.shape = { ...knob.shape!, width: 84, height: 84, fill: { color: "#ffffff" } };
      knob.transform.x = {
        value: 1050,
        keyframes: [
          { id: uid("kf"), time: 0.3, value: 870, easing: "overshoot" },
          { id: uid("kf"), time: 1.0, value: 1050, easing: "overshoot" },
        ],
      };
      return doc("Toggle", [track, knob]);
    },
  },
  {
    id: "logo-reveal",
    name: "Logo Reveal",
    blurb: "A draw-on ring + pop-in mark — drop your logo in.",
    tools: ["Trim Paths", "Spring", "Logo"],
    build: () => {
      const ring = createShapeLayer("ellipse", { name: "Ring", x: 960, y: 540 });
      ring.shape = {
        ...ring.shape!,
        width: 300, height: 300,
        fill: { color: "#0e0e12" },
        stroke: { color: "#5ce1ff", width: 8, cap: "round" },
        trim: {
          enabled: true,
          start: { value: 0, keyframes: [] },
          end: { value: 100, keyframes: [
            { id: uid("kf"), time: 0, value: 0, easing: "settle" },
            { id: uid("kf"), time: 1.2, value: 100, easing: "settle" },
          ] },
          offset: { value: -90, keyframes: [] },
        },
      };
      const mark = createTextLayer({ name: "Mark", x: 960, y: 560 });
      mark.text = { ...mark.text!, content: "LM", fontSize: 120, fontWeight: 800, fill: "#f2f2f2" };
      mark.transform.scaleX = { value: 100, keyframes: [
        { id: uid("kf"), time: 0.8, value: 0, easing: "overshoot" },
        { id: uid("kf"), time: 1.5, value: 100, easing: "overshoot" },
      ] };
      mark.transform.scaleY = { value: 100, keyframes: [
        { id: uid("kf"), time: 0.8, value: 0, easing: "overshoot" },
        { id: uid("kf"), time: 1.5, value: 100, easing: "overshoot" },
      ] };
      return doc("Logo Reveal", [ring, mark]);
    },
  },
];

/** Gallery category per example id. */
const CATEGORY_BY_ID: Record<string, ExampleCategory> = {
  "floating-particles": "Backgrounds",
  "pulsing-logo": "Logo & Brand",
  "loading-spinner": "Loading",
  "audio-bars": "Loading",
  "confetti-burst": "Micro-interactions",
  "orbiting-dots": "Backgrounds",
  "wave-text": "Backgrounds",
  "wobble-blob": "Backgrounds",
  "bouncy-pop": "Micro-interactions",
  "staggered-grid": "Reveals",
  "radial-pulse": "Loading",
  "jelly-drift": "Backgrounds",
  "neon-orbit": "Backgrounds",
  "draw-on": "Reveals",
  "kinetic-headline": "Text",
  "stat-counter": "Text",
  "toggle-micro": "Micro-interactions",
  "logo-reveal": "Logo & Brand",
};

export const EXAMPLE_PROJECTS: ExampleProject[] = EXAMPLES.map((e) => ({
  ...e,
  category: CATEGORY_BY_ID[e.id] ?? "Backgrounds",
}));
