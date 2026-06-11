/**
 * Loft Motion — Agent AnimationSpec (the LLM-facing authoring language).
 *
 * The full {@link SceneDocument} is powerful but verbose: every layer carries a
 * complete transform with eight animatable channels, explicit keyframe arrays,
 * ids, timings and effect param maps. That's a lot of surface for a language
 * model to get right.
 *
 * `AnimationSpec` is a small, declarative, intent-level format an LLM can author
 * reliably from a text prompt. It describes *what* should happen — "a title that
 * fades up, a subtitle that slides in under it, three dots that pop with a
 * stagger" — and the compiler ({@link compileSpec}) turns that into a full,
 * Zod-valid, beautiful scene document with hand-tuned keyframes and easings.
 *
 * Everything here is pure data + Zod, with no browser dependency, so it runs in
 * the editor, in a CLI, and inside an MCP server identically.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Composition size presets                                                  */
/* -------------------------------------------------------------------------- */

/** Friendly canvas-size names → pixel dimensions. */
export const SIZE_PRESETS = {
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 },
  "720p": { width: 1280, height: 720 },
  wide: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 }, // 9:16 reels / shorts / stories
  portrait: { width: 1080, height: 1350 }, // 4:5 social
  banner: { width: 1500, height: 500 },
  thumbnail: { width: 1280, height: 720 },
} as const;
export type SizePreset = keyof typeof SIZE_PRESETS;

export const zSize = z.union([
  z.enum(Object.keys(SIZE_PRESETS) as [SizePreset, ...SizePreset[]]),
  z.object({ width: z.number().int().min(1), height: z.number().int().min(1) }),
]);
export type SizeSpec = z.infer<typeof zSize>;

/* -------------------------------------------------------------------------- */
/*  Placement                                                                 */
/* -------------------------------------------------------------------------- */

/** Named anchor points on a 3×3 grid (plus a few designer favourites). */
export const POSITION_PRESETS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "title", // upper third — where a headline sits
  "subtitle", // just below centre
  "lower-third", // broadcast-style caption band
] as const;
export type PositionPreset = (typeof POSITION_PRESETS)[number];

export const zPosition = z.union([
  z.enum(POSITION_PRESETS),
  z.object({ x: z.number(), y: z.number() }), // absolute composition px
]);
export type PositionSpec = z.infer<typeof zPosition>;

/* -------------------------------------------------------------------------- */
/*  Entrances / exits                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Named entrance animations. Each expands to keyframes on the relevant
 * transform channels (position / scale / rotation / opacity) using a tasteful
 * default easing — see `animations.ts`.
 */
export const ENTER_PRESETS = [
  "none",
  "fade",
  "fade-up",
  "fade-down",
  "from-left",
  "from-right",
  "from-top",
  "from-bottom",
  "pop", // scale up past 100% then settle (overshoot) + fade
  "scale", // gentle grow from 80%
  "zoom", // settle in from 130% — cinematic
  "rise", // a bigger fade-up, good for hero text
  "spin", // rotate + scale + fade
  "blur-in", // (handled as fade + a brief scale) — kept simple & portable
] as const;
export type EnterPreset = (typeof ENTER_PRESETS)[number];

/** Named exits — mirrors of the entrances. */
export const EXIT_PRESETS = [
  "none",
  "fade",
  "fade-up",
  "fade-down",
  "to-left",
  "to-right",
  "to-top",
  "to-bottom",
  "pop", // scale down + fade
  "scale",
  "zoom",
  "drop",
  "spin",
] as const;
export type ExitPreset = (typeof EXIT_PRESETS)[number];

const zEnter = z.union([
  z.enum(ENTER_PRESETS),
  z.object({
    type: z.enum(ENTER_PRESETS),
    /** Seconds the entrance takes. */
    duration: z.number().min(0).optional(),
    /** Override the named easing (see EASING_NAMES). */
    easing: z.string().optional(),
  }),
]);
export type EnterSpec = z.infer<typeof zEnter>;

const zExit = z.union([
  z.enum(EXIT_PRESETS),
  z.object({
    type: z.enum(EXIT_PRESETS),
    duration: z.number().min(0).optional(),
    easing: z.string().optional(),
  }),
]);
export type ExitSpec = z.infer<typeof zExit>;

/* -------------------------------------------------------------------------- */
/*  Emphasis (continuous, looping life — maps to behaviors)                   */
/* -------------------------------------------------------------------------- */

/** Continuous "alive" motions applied for the element's whole life. */
export const EMPHASIS_PRESETS = [
  "float", // slow vertical bob
  "drift", // organic 2-D wander
  "pulse", // scale throb
  "spin", // continuous rotation
  "orbit", // travels in a circle
  "sway", // gentle rotation rock
  "wiggle", // jittery position
] as const;
export type EmphasisPreset = (typeof EMPHASIS_PRESETS)[number];

const zEmphasis = z.union([
  z.enum(EMPHASIS_PRESETS),
  z.object({
    type: z.enum(EMPHASIS_PRESETS),
    /** 0.2 = subtle, 1 = default, 2.5 = strong. */
    strength: z.number().min(0).optional(),
  }),
]);
export type EmphasisSpec = z.infer<typeof zEmphasis>;

/* -------------------------------------------------------------------------- */
/*  Effects (curated, high-level → catalog)                                   */
/* -------------------------------------------------------------------------- */

/**
 * High-level effect names mapped to the effects catalog. Passing a bare string
 * uses tuned defaults; passing an object lets the LLM nudge params/colours.
 */
export const EFFECT_PRESETS = [
  "glow",
  "soft-glow",
  "shadow",
  "blur",
  "vignette",
  "grain",
  "chroma", // chromatic aberration
  "duotone",
  "outline",
] as const;
export type EffectPreset = (typeof EFFECT_PRESETS)[number];

const zEffectSpec = z.union([
  z.enum(EFFECT_PRESETS),
  z.object({
    type: z.enum(EFFECT_PRESETS),
    color: z.string().optional(),
    color2: z.string().optional(),
    /** Numeric param overrides keyed by catalog param name. */
    params: z.record(z.string(), z.number()).optional(),
  }),
]);
export type EffectSpecItem = z.infer<typeof zEffectSpec>;

/* -------------------------------------------------------------------------- */
/*  Elements                                                                  */
/* -------------------------------------------------------------------------- */

/** Fields shared by every element. */
const zElementBase = z.object({
  /** Optional stable id (else generated). */
  id: z.string().optional(),
  /** Timeline / layer name. */
  name: z.string().optional(),
  /** Where it sits — a named anchor or absolute {x,y}. Default "center". */
  at: zPosition.optional(),
  /** When it appears, in seconds (default 0). */
  start: z.number().min(0).optional(),
  /** How long it stays on screen (default: to the end of the comp). */
  duration: z.number().min(0).optional(),
  /** Entrance animation (default "fade-up" for text, "pop" for shapes). */
  enter: zEnter.optional(),
  /** Exit animation (default "none"). */
  exit: zExit.optional(),
  /** Continuous life — one or several. */
  emphasis: z.union([zEmphasis, z.array(zEmphasis)]).optional(),
  /** Post effects. */
  effects: z.union([zEffectSpec, z.array(zEffectSpec)]).optional(),
  /** Static overrides (percent / degrees / 0..100). */
  scale: z.number().optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(100).optional(),
  /** Blend mode. */
  blend: z
    .enum(["normal", "multiply", "screen", "overlay", "add", "darken", "lighten"])
    .optional(),
});

const zTextElement = zElementBase.extend({
  type: z.literal("text"),
  /** The words to show. */
  text: z.string(),
  fontSize: z.number().min(1).optional(),
  color: z.string().optional(),
  weight: z.number().int().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  font: z.string().optional(),
  letterSpacing: z.number().optional(),
  /** Per-character/word kinetic typography. */
  kinetic: z
    .enum(["none", "fade-up", "fade-in", "scale-in", "typewriter", "wave"])
    .optional(),
});
export type TextElementSpec = z.infer<typeof zTextElement>;

const zShapeElement = zElementBase.extend({
  type: z.literal("shape"),
  /** Which primitive. "circle" is sugar for an equal-sided ellipse. */
  shape: z.enum(["rect", "ellipse", "circle", "polygon", "star", "line"]),
  /** Square footprint shortcut. */
  size: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  color: z.string().optional(),
  /** Linear-gradient end colour (start = `color`). */
  gradientTo: z.string().optional(),
  gradientAngle: z.number().optional(),
  cornerRadius: z.number().min(0).optional(),
  /** For polygon / star. */
  points: z.number().int().min(3).optional(),
  stroke: z
    .object({ color: z.string(), width: z.number().min(0).default(8) })
    .optional(),
  /** Animate the stroke drawing on (trim paths). */
  drawOn: z.boolean().optional(),
});
export type ShapeElementSpec = z.infer<typeof zShapeElement>;

export const zElement = z.discriminatedUnion("type", [zTextElement, zShapeElement]);
export type ElementSpec = z.infer<typeof zElement>;

/* -------------------------------------------------------------------------- */
/*  The spec                                                                  */
/* -------------------------------------------------------------------------- */

export const zAnimationSpec = z.object({
  /** Project / composition name. */
  title: z.string().optional(),
  /** Canvas size — preset name or {width,height}. Default "1080p". */
  size: zSize.optional(),
  /** Frames per second. Default 30. */
  fps: z.number().min(1).max(120).optional(),
  /**
   * Total length in seconds. If omitted it's inferred from the elements so the
   * whole animation (including exits) is visible.
   */
  duration: z.number().min(0.1).optional(),
  /** Background colour (hex) or "transparent" (rendered as the comp colour). */
  background: z.string().optional(),
  /** Optional named palette — handy hex swatches the LLM can reuse. */
  palette: z.array(z.string()).optional(),
  /**
   * If set, each element's entrance is delayed by `index * stagger` seconds on
   * top of its own `start`, producing the signature overlapping cascade. The
   * compiler skips elements that set an explicit `start`.
   */
  stagger: z.number().min(0).optional(),
  /** The things on screen, drawn back-to-front (index 0 = bottom). */
  elements: z.array(zElement).min(1),
});
export type AnimationSpec = z.infer<typeof zAnimationSpec>;

/** Parse + validate an untrusted spec (e.g. LLM output). Throws on failure. */
export function parseSpec(data: unknown): AnimationSpec {
  return zAnimationSpec.parse(data);
}

/** Non-throwing variant returning a discriminated result. */
export function safeParseSpec(data: unknown) {
  return zAnimationSpec.safeParse(data);
}
