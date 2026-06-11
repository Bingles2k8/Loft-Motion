/**
 * Loft Motion — Agent spec compiler.
 *
 * `compileSpec` is the bridge from the LLM-facing {@link AnimationSpec} to the
 * engine's single source of truth, the {@link SceneDocument}. It expands intent
 * ("a title that fades up, three dots that pop with a stagger") into concrete,
 * Zod-valid layers with hand-tuned keyframes, behaviors and effects — the same
 * document the editor, renderer and every exporter consume.
 *
 * Pure + deterministic apart from id generation: no browser, no globals. That's
 * what lets the very same compiler run in the editor, a CLI and an MCP server.
 */
import {
  parseScene,
  SCENE_VERSION,
  type Behavior,
  type Effect,
  type EffectType,
  type Layer,
  type SceneDocument,
  type ShapeKind,
  type TextAnimKind,
  type Transform,
} from "@/lib/scene/schema";
import {
  anim,
  createBehavior,
  createEffect,
  defaultTransform,
  kf,
  uid,
} from "@/lib/scene/factory";
import {
  buildEnter,
  buildExit,
  type Base,
  type Channel,
  type ChannelKeys,
  type ChannelPoint,
  type Frame,
} from "@/lib/agent/animations";
import {
  SIZE_PRESETS,
  type AnimationSpec,
  type EffectPreset,
  type ElementSpec,
  type EmphasisPreset,
  type EnterPreset,
  type ExitPreset,
  type PositionPreset,
  type ShapeElementSpec,
  type TextElementSpec,
} from "@/lib/agent/spec";

/* -------------------------------------------------------------------------- */
/*  Placement & sizing                                                        */
/* -------------------------------------------------------------------------- */

const POSITION_FRACTIONS: Record<PositionPreset, [number, number]> = {
  center: [0.5, 0.5],
  top: [0.5, 0.18],
  bottom: [0.5, 0.82],
  left: [0.22, 0.5],
  right: [0.78, 0.5],
  "top-left": [0.22, 0.18],
  "top-right": [0.78, 0.18],
  "bottom-left": [0.22, 0.82],
  "bottom-right": [0.78, 0.82],
  title: [0.5, 0.34],
  subtitle: [0.5, 0.6],
  "lower-third": [0.3, 0.82],
};

function resolveSize(spec: AnimationSpec): { width: number; height: number } {
  const s = spec.size ?? "1080p";
  if (typeof s === "string") return { ...SIZE_PRESETS[s] };
  return { width: s.width, height: s.height };
}

function resolvePosition(
  at: ElementSpec["at"],
  frame: Frame,
): { x: number; y: number } {
  if (!at) return { x: frame.width / 2, y: frame.height / 2 };
  if (typeof at === "string") {
    const [fx, fy] = POSITION_FRACTIONS[at];
    return { x: fx * frame.width, y: fy * frame.height };
  }
  return { x: at.x, y: at.y };
}

/* -------------------------------------------------------------------------- */
/*  Normalisers for the union fields                                          */
/* -------------------------------------------------------------------------- */

function enterOf(e: ElementSpec, fallback: EnterPreset) {
  const v = e.enter;
  if (v == null) return { type: fallback, duration: undefined as number | undefined, easing: undefined as string | undefined };
  if (typeof v === "string") return { type: v, duration: undefined, easing: undefined };
  return { type: v.type, duration: v.duration, easing: v.easing };
}

function exitOf(e: ElementSpec) {
  const v = e.exit;
  if (v == null) return { type: "none" as ExitPreset, duration: undefined as number | undefined, easing: undefined as string | undefined };
  if (typeof v === "string") return { type: v, duration: undefined, easing: undefined };
  return { type: v.type, duration: v.duration, easing: v.easing };
}

function emphasisList(e: ElementSpec): { type: EmphasisPreset; strength?: number }[] {
  const v = e.emphasis;
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => (typeof x === "string" ? { type: x } : { type: x.type, strength: x.strength }));
}

interface EffectReq {
  type: EffectPreset;
  color?: string;
  color2?: string;
  params?: Record<string, number>;
}
function effectList(e: ElementSpec): EffectReq[] {
  const v = e.effects;
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => (typeof x === "string" ? { type: x } : x));
}

/* -------------------------------------------------------------------------- */
/*  Emphasis → behaviors, effect presets → catalog                            */
/* -------------------------------------------------------------------------- */

function emphasisToBehavior(req: { type: EmphasisPreset; strength?: number }): Behavior {
  const s = req.strength ?? 1;
  let b: Behavior;
  switch (req.type) {
    case "float":
      b = createBehavior("oscillate", "y");
      b.params = { freq: 0.5, amp: 18, phase: 0, wave: 0 };
      break;
    case "pulse":
      b = createBehavior("oscillate", "scale");
      b.params = { freq: 1.1, amp: 7, phase: 0, wave: 0 };
      break;
    case "sway":
      b = createBehavior("oscillate", "rotation");
      b.params = { freq: 0.45, amp: 6, phase: 0, wave: 0 };
      break;
    case "drift":
      b = createBehavior("wiggle", "position");
      b.params = { freq: 0.5, amp: 26, octaves: 2, seed: 7, wave: 0 };
      break;
    case "wiggle":
      b = createBehavior("wiggle", "position");
      b.params = { freq: 3, amp: 18, octaves: 1, seed: 3, wave: 0 };
      break;
    case "spin":
      b = createBehavior("spin", "rotation");
      b.params = { rate: 90 };
      break;
    case "orbit":
      b = createBehavior("orbit", "position");
      b.params = { radius: 80, rate: 60, phase: 0 };
      break;
  }
  b.strength = s;
  b.loop = req.type !== "spin" && req.type !== "orbit";
  return b;
}

const EFFECT_MAP: Record<EffectPreset, EffectType> = {
  glow: "glow",
  "soft-glow": "bloom",
  shadow: "drop-shadow",
  blur: "blur",
  vignette: "vignette",
  grain: "old-film",
  chroma: "rgb-split",
  duotone: "tint",
  outline: "outline",
};

function effectReqToEffect(req: EffectReq): Effect {
  const fx = createEffect(EFFECT_MAP[req.type]);
  if (req.color) fx.color = req.color;
  if (req.color2) fx.color2 = req.color2;
  if (req.params) {
    for (const [k, val] of Object.entries(req.params)) {
      if (fx.params[k]) fx.params[k] = anim(val);
      else fx.params[k] = anim(val);
    }
  }
  return fx;
}

/* -------------------------------------------------------------------------- */
/*  Keyframe merge                                                            */
/* -------------------------------------------------------------------------- */

/** Merge enter+exit channel points onto a base transform, in place. */
function applyChannels(tf: Transform, base: Base, ...maps: ChannelKeys[]) {
  const acc: Partial<Record<Channel, ChannelPoint[]>> = {};
  for (const m of maps) {
    for (const ch of Object.keys(m) as Channel[]) {
      (acc[ch] ??= []).push(...(m[ch] ?? []));
    }
  }
  const baseFor: Record<Channel, number> = {
    x: base.x,
    y: base.y,
    scaleX: base.scale,
    scaleY: base.scale,
    rotation: base.rotation,
    opacity: base.opacity,
  };
  for (const ch of Object.keys(acc) as Channel[]) {
    const pts = acc[ch]!
      .slice()
      .sort((a, b) => a.time - b.time)
      .filter((p, i, arr) => i === 0 || Math.abs(p.time - arr[i - 1].time) > 1e-3);
    tf[ch] = anim(
      baseFor[ch],
      pts.map((p) => kf(p.time, p.value, p.easing)),
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Element → Layer                                                           */
/* -------------------------------------------------------------------------- */

const DEFAULT_ELEMENT_LIFE = 4;

function buildLayer(
  e: ElementSpec,
  start: number,
  compDur: number,
  frame: Frame,
): Layer {
  const pos = resolvePosition(e.at, frame);
  const base: Base = {
    x: pos.x,
    y: pos.y,
    scale: e.scale ?? 100,
    rotation: e.rotation ?? 0,
    opacity: e.opacity ?? 100,
  };

  const end = Math.min(compDur, start + (e.duration ?? compDur - start));

  const enter = enterOf(e, e.type === "text" ? "fade-up" : "pop");
  const exit = exitOf(e);
  const enterKeys = buildEnter(enter.type, start, enter.duration ?? 0, base, frame, enter.easing);
  const exitKeys =
    exit.type === "none"
      ? {}
      : buildExit(exit.type, end, exit.duration ?? 0, base, frame, exit.easing);

  const tf = defaultTransform(base.x, base.y);
  tf.scaleX = anim(base.scale);
  tf.scaleY = anim(base.scale);
  tf.rotation = anim(base.rotation);
  tf.opacity = anim(base.opacity);
  applyChannels(tf, base, enterKeys, exitKeys);

  const behaviors = emphasisList(e).map(emphasisToBehavior);
  const effects = effectList(e).map(effectReqToEffect);

  const layer: Layer = {
    id: e.id ?? uid("layer"),
    name: e.name ?? defaultName(e),
    type: e.type === "text" ? "text" : "shape",
    visible: true,
    locked: false,
    solo: false,
    label: 0,
    blendMode: e.blend ?? "normal",
    parentId: null,
    transform: tf,
    timing: { start, end },
    effects,
    behaviors,
    masks: [],
    matte: "none",
  };

  if (e.type === "text") layer.text = buildText(e, frame);
  else layer.shape = buildShape(e);

  return layer;
}

function defaultName(e: ElementSpec): string {
  if (e.type === "text") return e.text.slice(0, 24) || "Text";
  return cap(e.shape);
}

function buildText(e: TextElementSpec, frame: Frame) {
  const auto = Math.round(Math.min(frame.width, frame.height) * 0.09);
  const fontSize = e.fontSize ?? clamp(auto, 24, 240);
  const kinetic = (e.kinetic ?? "none") as TextAnimKind;
  return {
    content: e.text,
    fontSize,
    fontFamily: e.font ?? "Inter, system-ui, sans-serif",
    fontWeight: e.weight ?? 700,
    align: e.align ?? "center",
    fill: e.color ?? "#f4f4f5",
    letterSpacing: e.letterSpacing ?? 0,
    ...(kinetic !== "none"
      ? { animator: { kind: kinetic, unit: "character" as const, stagger: 0.035, duration: 0.5, start: e.start ?? 0 } }
      : {}),
  };
}

function buildShape(e: ShapeElementSpec) {
  const kind: ShapeKind = e.shape === "circle" ? "ellipse" : e.shape === "line" ? "rect" : (e.shape as ShapeKind);
  const isLine = e.shape === "line";
  const size = e.size;
  let width = e.width ?? size ?? (kind === "ellipse" ? 280 : 320);
  let height = e.height ?? size ?? (kind === "ellipse" ? 280 : 200);
  if (e.shape === "circle") height = width;
  if (isLine) {
    width = e.width ?? 400;
    height = e.height ?? Math.max(2, e.stroke?.width ?? 8);
  }
  const color = e.color ?? "#4f8fcb";
  const wantsDrawOn = e.drawOn === true;
  const stroke = e.stroke
    ? { color: e.stroke.color, width: e.stroke.width }
    : wantsDrawOn
      ? { color, width: 8 }
      : undefined;

  const trim = wantsDrawOn && stroke
    ? {
        enabled: true,
        start: anim(0),
        end: anim(100, [kf(0, 0, "gentle"), kf(1.2, 100, "gentle")]),
        offset: anim(0),
      }
    : undefined;

  return {
    kind,
    width,
    height,
    cornerRadius: e.cornerRadius ?? (kind === "rect" && !isLine ? 16 : 0),
    points: e.points ?? 5,
    fill: e.gradientTo
      ? { color, gradient: { to: e.gradientTo, angle: e.gradientAngle ?? 90 } }
      : { color },
    ...(stroke ? { stroke } : {}),
    ...(trim ? { trim } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/*  Compile                                                                   */
/* -------------------------------------------------------------------------- */

export interface CompileResult {
  scene: SceneDocument;
  /** Non-fatal notes (e.g. an alpha-needing background on MP4). */
  notes: string[];
}

/**
 * Compile a validated {@link AnimationSpec} into a {@link SceneDocument}. The
 * result is re-parsed through the scene schema so callers always receive a
 * document the renderer/exporters can trust.
 */
export function compileSpec(spec: AnimationSpec): CompileResult {
  const notes: string[] = [];
  const frame = resolveSize(spec);
  const fps = spec.fps ?? 30;

  // Per-element effective start times (apply stagger to auto-started elements).
  const stagger = spec.stagger ?? 0;
  let autoIndex = 0;
  const starts = spec.elements.map((e) => {
    if (e.start != null) return e.start;
    const s = stagger * autoIndex;
    autoIndex += 1;
    return s;
  });

  // Infer composition duration if not given: make sure every element + its exit
  // is fully visible.
  const inferred = spec.elements.reduce((max, e, i) => {
    const life = e.duration ?? DEFAULT_ELEMENT_LIFE;
    return Math.max(max, starts[i] + life);
  }, 0);
  const compDur = round2(Math.max(spec.duration ?? inferred, 1.5));

  const layers = spec.elements.map((e, i) =>
    buildLayer(e, round2(Math.min(starts[i], compDur - 0.1)), compDur, frame),
  );

  const background = resolveBackground(spec.background, notes);

  const swatches = (spec.palette ?? []).map((c, i) => ({
    id: uid("sw"),
    name: `Color ${i + 1}`,
    color: c,
  }));

  const doc: SceneDocument = {
    version: SCENE_VERSION,
    name: spec.title ?? "Untitled",
    composition: { width: frame.width, height: frame.height, fps, duration: compDur, background },
    layers,
    assets: [],
    palette: { swatches },
  };

  // Re-validate so we never hand back a document the engine could reject.
  return { scene: parseScene(doc), notes };
}

function resolveBackground(bg: string | undefined, notes: string[]): string {
  if (!bg) return "#0e0f13";
  if (bg.toLowerCase() === "transparent") {
    notes.push(
      "Background is transparent: WebM (alpha) and Lottie/CSS keep it; MP4/GIF will render it as the dark default.",
    );
    return "#0e0f13";
  }
  return bg;
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
