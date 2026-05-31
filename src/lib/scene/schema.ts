/**
 * Loft Motion — Scene Document schema.
 *
 * This is the single source of truth for the whole engine. The renderer, the
 * timeline UI, every exporter and the capability engine all read from this one
 * serialisable model. Export-compatibility is a first-class concern baked into
 * the model from day one (see §3.1 of the build plan).
 *
 * Types + a runtime Zod validator live together so an imported JSON file can be
 * trusted before it ever reaches the renderer.
 */
import { z } from "zod";
import { EASING_NAMES } from "@/lib/anim/easing";

/* -------------------------------------------------------------------------- */
/*  Export compatibility (the honesty layer)                                  */
/* -------------------------------------------------------------------------- */

/** The three deliverables Loft Motion targets. */
export const EXPORT_TARGETS = ["mp4", "lottie", "css"] as const;
export type ExportTarget = (typeof EXPORT_TARGETS)[number];

/**
 * How well a feature survives a given export target.
 * - `full`    — exports cleanly (✅)
 * - `partial` — exports but degrades or is constrained (⚠️)
 * - `none`    — cannot be represented; dropped or baked (❌)
 */
export const COMPAT_LEVELS = ["full", "partial", "none"] as const;
export type CompatLevel = (typeof COMPAT_LEVELS)[number];

export const zCompatLevel = z.enum(COMPAT_LEVELS);

/* -------------------------------------------------------------------------- */
/*  Animatable properties & keyframes                                         */
/* -------------------------------------------------------------------------- */

export const zEasingName = z.enum(
  EASING_NAMES as unknown as [string, ...string[]],
);
export type EasingName = (typeof EASING_NAMES)[number];

/**
 * A single keyframe on a scalar channel.
 * `time` is in seconds (composition-relative). `easing` names the curve used to
 * interpolate FROM this keyframe TO the next one. `bezier`, when present, is a
 * custom cubic-bezier [x1,y1,x2,y2] that OVERRIDES the named easing — this is
 * what the Graph Editor writes when a user reshapes a curve by hand.
 */
export const zKeyframe = z.object({
  id: z.string(),
  time: z.number().min(0),
  value: z.number(),
  easing: zEasingName,
  bezier: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .optional(),
});
export type Keyframe = z.infer<typeof zKeyframe>;

/**
 * A scalar animatable property. If `keyframes` is empty the property is static
 * and `value` is used. Modelling every channel as a scalar keeps keyframe
 * evaluation and the timeline lanes dead simple; vectors (position, scale) are
 * expressed as two scalar channels (x/y) at the Transform level.
 */
export const zAnimatable = z.object({
  value: z.number(),
  keyframes: z.array(zKeyframe).default([]),
});
export type Animatable = z.infer<typeof zAnimatable>;

/* -------------------------------------------------------------------------- */
/*  Transform                                                                 */
/* -------------------------------------------------------------------------- */

export const zTransform = z.object({
  x: zAnimatable,
  y: zAnimatable,
  scaleX: zAnimatable,
  scaleY: zAnimatable,
  rotation: zAnimatable, // degrees
  opacity: zAnimatable, // 0..100
  anchorX: zAnimatable, // 0..1 (fraction of layer bounds)
  anchorY: zAnimatable,
});
export type Transform = z.infer<typeof zTransform>;

/* -------------------------------------------------------------------------- */
/*  Effects                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Effect types map to PixiJS / pixi-filters. Stored generically: each effect
 * carries keyed animatable scalar `params` plus an optional `color`, so adding
 * an effect is just a catalog entry — no schema change needed.
 */
export const EFFECT_TYPES = [
  // Blur & sharpen
  "blur",
  "motion-blur",
  "zoom-blur",
  "radial-blur",
  // Glow / shadow / edges
  "glow",
  "bloom",
  "drop-shadow",
  "outline",
  "bevel",
  // Color
  "adjust",
  "hue-saturation",
  "tint",
  "color-overlay",
  "film-grade",
  // Stylize / distort
  "rgb-split",
  "glitch",
  "crt",
  "old-film",
  "pixelate",
  "dot",
  "vignette",
  "bulge-pinch",
  "twist",
] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];

export const zEffect = z.object({
  id: z.string(),
  type: z.enum(EFFECT_TYPES),
  enabled: z.boolean().default(true),
  /** Animatable scalar params keyed by name, e.g. { strength, distance }. */
  params: z.record(z.string(), zAnimatable).default({}),
  /** Static non-numeric params, e.g. a shadow/tint colour. */
  color: z.string().optional(),
  /** Optional second colour (e.g. bevel shadow, gradient end, tint white). */
  color2: z.string().optional(),
});
export type Effect = z.infer<typeof zEffect>;

/* -------------------------------------------------------------------------- */
/*  Layer payloads (discriminated by Layer.type)                              */
/* -------------------------------------------------------------------------- */

export const SHAPE_KINDS = ["rect", "ellipse", "polygon", "star"] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export const zFill = z.object({
  /** A solid colour, or the first stop of a linear gradient when `gradient`. */
  color: z.string(),
  gradient: z
    .object({
      to: z.string(),
      angle: z.number().default(90), // degrees
    })
    .optional(),
});
export type Fill = z.infer<typeof zFill>;

export const zStroke = z.object({
  color: z.string(),
  width: z.number().min(0),
});
export type Stroke = z.infer<typeof zStroke>;

export const zShapePayload = z.object({
  kind: z.enum(SHAPE_KINDS),
  width: z.number().min(0),
  height: z.number().min(0),
  cornerRadius: z.number().min(0).default(0),
  points: z.number().int().min(3).default(5), // for polygon/star
  fill: zFill,
  stroke: zStroke.optional(),
});
export type ShapePayload = z.infer<typeof zShapePayload>;

export const TEXT_ALIGN = ["left", "center", "right"] as const;
export const zTextPayload = z.object({
  content: z.string(),
  fontSize: z.number().min(1),
  fontFamily: z.string().default("Inter, system-ui, sans-serif"),
  fontWeight: z.number().int().default(600),
  align: z.enum(TEXT_ALIGN).default("left"),
  fill: z.string(),
  letterSpacing: z.number().default(0),
});
export type TextPayload = z.infer<typeof zTextPayload>;

export const zImagePayload = z.object({
  /** Reference to a project asset (preferred), or an inline data URL. */
  assetId: z.string().optional(),
  /** Data URL kept inline so the document stays self-contained / client-side. */
  src: z.string(),
  naturalWidth: z.number(),
  naturalHeight: z.number(),
});
export type ImagePayload = z.infer<typeof zImagePayload>;

/* -------------------------------------------------------------------------- */
/*  Layer                                                                     */
/* -------------------------------------------------------------------------- */

export const LAYER_TYPES = ["shape", "text", "image", "group"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "add",
  "darken",
  "lighten",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/** In/out timing of a layer's clip on the timeline, in seconds. */
export const zTiming = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
});
export type Timing = z.infer<typeof zTiming>;

/* -------------------------------------------------------------------------- */
/*  Procedural behaviors (Cavalry-style)                                       */
/* -------------------------------------------------------------------------- */

/**
 * A behavior continuously drives a transform channel over time as a pure
 * function of t — no keyframes. Behaviors STACK on a layer and add their offset
 * on top of the keyframed/static base value, so they compose with everything.
 */
export const BEHAVIOR_TYPES = [
  "wiggle",
  "oscillate",
  "spin",
  "spring",
  "orbit",
] as const;
export type BehaviorType = (typeof BEHAVIOR_TYPES)[number];

/** Which transform channel(s) a behavior targets. */
export const BEHAVIOR_TARGETS = [
  "position",
  "x",
  "y",
  "scale",
  "rotation",
  "opacity",
] as const;
export type BehaviorTarget = (typeof BEHAVIOR_TARGETS)[number];

export const zBehavior = z.object({
  id: z.string(),
  type: z.enum(BEHAVIOR_TYPES),
  enabled: z.boolean().default(true),
  target: z.enum(BEHAVIOR_TARGETS),
  /** Master intensity (0..1+), the one knob beginners touch. */
  strength: z.number().default(1),
  /** Type-specific numeric params, e.g. { freq, amp, octaves, seed }. */
  params: z.record(z.string(), z.number()).default({}),
  /** Seamlessly loop the behavior over the composition duration. */
  loop: z.boolean().default(false),
});
export type Behavior = z.infer<typeof zBehavior>;

/* -------------------------------------------------------------------------- */
/*  Cloner (per-layer Duplicator)                                              */
/* -------------------------------------------------------------------------- */

export const CLONER_MODES = ["grid", "radial", "line"] as const;
export type ClonerMode = (typeof CLONER_MODES)[number];

/**
 * Multiplies a layer into N copies arranged in a grid / circle / line, with a
 * per-clone incremental transform and a stagger that delays each clone's
 * behaviors — the signature procedural look.
 */
export const zCloner = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(CLONER_MODES).default("grid"),
  // grid
  cols: z.number().int().min(1).default(5),
  rows: z.number().int().min(1).default(1),
  spacingX: z.number().default(120),
  spacingY: z.number().default(120),
  // radial
  count: z.number().int().min(1).default(8),
  radius: z.number().default(220),
  startAngle: z.number().default(0),
  faceOut: z.boolean().default(false),
  // per-clone incremental transform
  stepScale: z.number().default(0), // each clone +N% scale
  stepRotation: z.number().default(0), // each clone +N°
  stepOpacity: z.number().default(0), // each clone +N% opacity (negative fades)
  /** Per-clone time delay (s) applied to this layer's behaviors → cascades. */
  stagger: z.number().default(0),
});
export type Cloner = z.infer<typeof zCloner>;

export const zLayer = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(LAYER_TYPES),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  blendMode: z.enum(BLEND_MODES).default("normal"),
  parentId: z.string().nullable().default(null),
  transform: zTransform,
  timing: zTiming,
  effects: z.array(zEffect).default([]),
  behaviors: z.array(zBehavior).default([]),
  cloner: zCloner.optional(),

  // Payloads — exactly one is present, matching `type`.
  shape: zShapePayload.optional(),
  text: zTextPayload.optional(),
  image: zImagePayload.optional(),
});
export type Layer = z.infer<typeof zLayer>;

/* -------------------------------------------------------------------------- */
/*  Composition + document                                                    */
/* -------------------------------------------------------------------------- */

export const zComposition = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  fps: z.number().min(1).max(120),
  duration: z.number().min(0.1), // seconds
  background: z.string(), // hex colour
});
export type Composition = z.infer<typeof zComposition>;

/* -------------------------------------------------------------------------- */
/*  Project assets (the Project panel)                                         */
/* -------------------------------------------------------------------------- */

export const ASSET_TYPES = ["image", "video", "audio"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/**
 * A user-supplied file, stored entirely client-side as a data URL. Nothing is
 * ever uploaded — all processing happens in the browser.
 */
export const zAsset = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(ASSET_TYPES),
  src: z.string(), // data URL
  width: z.number().default(0),
  height: z.number().default(0),
  /** Bytes, for the Project panel size column. */
  size: z.number().default(0),
  /** Seconds, for video/audio. */
  duration: z.number().optional(),
});
export type Asset = z.infer<typeof zAsset>;

export const SCENE_VERSION = 2 as const;

export const zSceneDocument = z.object({
  // Accept v1 documents too; the loader migrates them.
  version: z.union([z.literal(1), z.literal(2)]),
  name: z.string().default("Untitled"),
  composition: zComposition,
  /** Render/stacking order is array order: index 0 is the bottom layer. */
  layers: z.array(zLayer).default([]),
  assets: z.array(zAsset).default([]),
});
export type SceneDocument = z.infer<typeof zSceneDocument>;

/** Parse + validate untrusted JSON (e.g. an imported file). Throws on failure. */
export function parseScene(data: unknown): SceneDocument {
  return zSceneDocument.parse(data);
}

/** Safe variant returning a discriminated result instead of throwing. */
export function safeParseScene(data: unknown) {
  return zSceneDocument.safeParse(data);
}
