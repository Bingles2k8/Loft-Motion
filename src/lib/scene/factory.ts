/**
 * Loft Motion — scene factories & defaults.
 *
 * Beautiful-by-default: new layers arrive already animating nicely with sensible
 * named easings, durations and staggers (§5). The sample scene is what greets a
 * first-time user instead of a blank canvas.
 */
import {
  SCENE_VERSION,
  type Animatable,
  type Asset,
  type AssetType,
  type Composition,
  type Effect,
  type EffectType,
  type Keyframe,
  type Layer,
  type LayerType,
  type SceneDocument,
  type ShapeKind,
  type Transform,
} from "@/lib/scene/schema";

/** Short unique id; crypto.randomUUID where available, else a fallback. */
export function uid(prefix = "id"): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

export function anim(value: number, keyframes: Keyframe[] = []): Animatable {
  return { value, keyframes };
}

export function kf(
  time: number,
  value: number,
  easing = "gentle",
): Keyframe {
  return { id: uid("kf"), time, value, easing };
}

export function defaultTransform(x = 0, y = 0): Transform {
  return {
    x: anim(x),
    y: anim(y),
    scaleX: anim(100),
    scaleY: anim(100),
    rotation: anim(0),
    opacity: anim(100),
    anchorX: anim(0.5),
    anchorY: anim(0.5),
  };
}

export function defaultComposition(): Composition {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    background: "#141414",
  };
}

export function createEffect(type: EffectType): Effect {
  const params: Record<string, Animatable> = {};
  let color: string | undefined;
  switch (type) {
    case "blur":
      params.strength = anim(8);
      break;
    case "glow":
      params.strength = anim(12);
      params.innerStrength = anim(2);
      color = "#79aede";
      break;
    case "drop-shadow":
      params.distance = anim(12);
      params.angle = anim(45);
      params.blur = anim(8);
      params.alpha = anim(60);
      color = "#000000";
      break;
  }
  return { id: uid("fx"), type, enabled: true, params, color };
}

interface LayerInit {
  name?: string;
  x?: number;
  y?: number;
}

export function createShapeLayer(
  kind: ShapeKind = "rect",
  init: LayerInit = {},
): Layer {
  const { name = cap(kind), x = 960, y = 540 } = init;
  return {
    id: uid("layer"),
    name,
    type: "shape",
    visible: true,
    locked: false,
    blendMode: "normal",
    parentId: null,
    transform: defaultTransform(x, y),
    timing: { start: 0, end: 5 },
    effects: [],
    shape: {
      kind,
      width: kind === "ellipse" ? 280 : 320,
      height: kind === "ellipse" ? 280 : 200,
      cornerRadius: kind === "rect" ? 24 : 0,
      points: 5,
      fill: { color: "#4f8fcb" },
    },
  };
}

export function createTextLayer(init: LayerInit = {}): Layer {
  const { name = "Text", x = 960, y = 540 } = init;
  return {
    id: uid("layer"),
    name,
    type: "text",
    visible: true,
    locked: false,
    blendMode: "normal",
    parentId: null,
    transform: defaultTransform(x, y),
    timing: { start: 0, end: 5 },
    effects: [],
    text: {
      content: "Loft Motion",
      fontSize: 120,
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 700,
      align: "center",
      fill: "#ffffff",
      letterSpacing: 0,
    },
  };
}

export function createImageLayer(
  src: string,
  naturalWidth: number,
  naturalHeight: number,
  init: LayerInit & { assetId?: string } = {},
): Layer {
  const { name = "Image", x = 960, y = 540, assetId } = init;
  return {
    id: uid("layer"),
    name,
    type: "image",
    visible: true,
    locked: false,
    blendMode: "normal",
    parentId: null,
    transform: defaultTransform(x, y),
    timing: { start: 0, end: 5 },
    effects: [],
    image: { assetId, src, naturalWidth, naturalHeight },
  };
}

/** Build a project asset record from an imported file's data URL + metadata. */
export function createAsset(
  type: AssetType,
  name: string,
  src: string,
  meta: { width?: number; height?: number; size?: number; duration?: number } = {},
): Asset {
  return {
    id: uid("asset"),
    name,
    type,
    src,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    size: meta.size ?? 0,
    duration: meta.duration,
  };
}

/** Create an image layer that references a project asset, fit to the comp. */
export function createImageLayerFromAsset(
  asset: Asset,
  comp: Composition,
): Layer {
  const max = Math.min(comp.width, comp.height) * 0.6;
  const scale = Math.min(1, max / Math.max(asset.width || max, asset.height || max));
  return createImageLayer(
    asset.src,
    (asset.width || max) * scale,
    (asset.height || max) * scale,
    {
      name: asset.name.replace(/\.[^.]+$/, ""),
      x: comp.width / 2,
      y: comp.height / 2,
      assetId: asset.id,
    },
  );
}

export function createLayer(type: LayerType): Layer {
  switch (type) {
    case "text":
      return createTextLayer();
    case "shape":
      return createShapeLayer("rect");
    default:
      return createShapeLayer("rect");
  }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A clean, empty composition. */
export function emptyScene(): SceneDocument {
  return {
    version: SCENE_VERSION,
    name: "Untitled",
    composition: defaultComposition(),
    layers: [],
    assets: [],
  };
}

/**
 * The welcome scene: a designed little animation that shows off named easings,
 * stagger, a glow effect and a gradient — and demonstrates the export-warning
 * layer (the glow won't survive Lottie).
 */
export function sampleScene(): SceneDocument {
  const comp = { ...defaultComposition(), background: "#141414" };

  // Background panel that gently breathes in scale.
  const panel: Layer = {
    ...createShapeLayer("rect", { name: "Backdrop", x: 960, y: 540 }),
    shape: {
      kind: "rect",
      width: 1200,
      height: 700,
      cornerRadius: 32,
      points: 5,
      fill: { color: "#1e1e1e" },
      stroke: { color: "#2e2e2e", width: 2 },
    },
    transform: {
      ...defaultTransform(960, 540),
      scaleX: anim(100, [kf(0, 96, "settle"), kf(2.5, 100, "settle"), kf(5, 96, "settle")]),
      scaleY: anim(100, [kf(0, 96, "settle"), kf(2.5, 100, "settle"), kf(5, 96, "settle")]),
    },
  };

  // A trio of dots that rise and fade in with a stagger — overlapping action.
  const dotColors = ["#4f8fcb", "#58c8d6", "#d6d6d6"];
  const dots: Layer[] = [0, 1, 2].map((i) => {
    const startY = 620;
    const layer = createShapeLayer("ellipse", {
      name: `Dot ${i + 1}`,
      x: 780 + i * 180,
      y: startY,
    });
    const delay = i * 0.15; // stagger
    return {
      ...layer,
      shape: {
        kind: "ellipse",
        width: 120,
        height: 120,
        cornerRadius: 0,
        points: 5,
        fill: { color: dotColors[i] },
      },
      effects: [createEffect("glow")],
      transform: {
        ...defaultTransform(780 + i * 180, startY),
        y: anim(startY, [
          kf(delay, startY, "overshoot"),
          kf(delay + 0.9, 470, "overshoot"),
        ]),
        opacity: anim(100, [kf(delay, 0, "gentle"), kf(delay + 0.5, 100, "gentle")]),
        scaleX: anim(100, [kf(delay, 40, "overshoot"), kf(delay + 0.9, 100, "overshoot")]),
        scaleY: anim(100, [kf(delay, 40, "overshoot"), kf(delay + 0.9, 100, "overshoot")]),
      },
    };
  });

  // Title that snaps in from below.
  const title: Layer = {
    ...createTextLayer({ name: "Title", x: 960, y: 330 }),
    text: {
      content: "Loft Motion",
      fontSize: 132,
      fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: 800,
      align: "center",
      fill: "#f2f2f2",
      letterSpacing: -2,
    },
    transform: {
      ...defaultTransform(960, 330),
      y: anim(330, [kf(0.5, 400, "settle"), kf(1.2, 330, "settle")]),
      opacity: anim(100, [kf(0.5, 0, "gentle"), kf(1.1, 100, "gentle")]),
    },
  };

  return {
    version: SCENE_VERSION,
    name: "Welcome to Loft Motion",
    composition: comp,
    layers: [panel, ...dots, title],
    assets: [],
  };
}
