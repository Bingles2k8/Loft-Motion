/**
 * Loft Motion — PixiJS renderer.
 *
 * Maps the scene document to a retained-mode Pixi scene graph, then a scrubber
 * (`renderAt`) evaluates every animatable channel at time `t` and applies it.
 *
 * Crucially this is reusable headlessly: the MP4 exporter constructs the very
 * same renderer against an OffscreenCanvas so preview matches output 1:1 (§3.3).
 *
 * Structural changes (adding layers, editing a fill colour, changing text)
 * rebuild the graph; animating a channel value does NOT — it only re-applies
 * transforms, keeping playback and live drags cheap.
 */
import {
  Application,
  Container,
  FillGradient,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  Assets,
  type Filter,
} from "pixi.js";
import * as Pixi from "pixi.js";
import {
  AdjustmentFilter,
  BevelFilter,
  BulgePinchFilter,
  CRTFilter,
  ColorOverlayFilter,
  DotFilter,
  DropShadowFilter,
  GlitchFilter,
  HslAdjustmentFilter,
  MotionBlurFilter,
  OldFilmFilter,
  OutlineFilter,
  PixelateFilter,
  RadialBlurFilter,
  TwistFilter,
  ZoomBlurFilter,
} from "pixi-filters";
import { DeepGlowFilter } from "@/lib/render/filters/DeepGlowFilter";
import {
  ChromaticAberrationFilter,
  DuotoneFilter,
  FilmGradeFilter,
  VignetteFilter,
} from "@/lib/render/filters/CustomFilters";

// Pixi's barrel re-exports `./filters/index` twice, which makes some core filter
// symbols (e.g. BlurFilter, ColorMatrixFilter) ambiguous to the type-checker even
// though they exist at runtime. Pull them off the namespace with precise types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BlurFilter = (Pixi as any).BlurFilter as new (opts: {
  strength?: number;
}) => Filter;
import {
  evalEffectParams,
  evalTransform,
  isLayerActive,
} from "@/lib/anim/evaluate";
import {
  resolveColor,
  type Effect,
  type Layer,
  type SceneDocument,
  type ShapePayload,
} from "@/lib/scene/schema";
import { evalBehaviors, type CloneContext } from "@/lib/anim/behaviors";
import {
  clonerTransforms,
  cloneCount,
  type CloneTransform,
} from "@/lib/anim/cloner";

/** One rendered copy of a layer (1 per layer normally; N when cloned). */
interface CloneNode {
  container: Container; // holds the visual; carries this copy's transform
  display: Container;
  filters: Map<string, Filter>; // keyed by effect id
  clone: CloneTransform; // per-clone offset (identity when not cloning)
}

interface LayerNode {
  layer: Layer;
  outer: Container; // parented holder (no transform of its own)
  clones: CloneNode[];
  width: number;
  height: number;
}

function hex(color: string): number {
  return Number.parseInt(color.replace("#", ""), 16) || 0;
}

/** Resolve a colour (possibly a `@swatch` reference) to a hex string. */
function resolved(color: string, scene: SceneDocument): string {
  return resolveColor(color, scene.palette);
}

/** Structural signature — excludes animatable channel values so playback/drag
 *  don't trigger a rebuild, but shape/fill/text edits do. */
function signature(scene: SceneDocument): string {
  return JSON.stringify({
    c: scene.composition,
    l: scene.layers.map((l) => ({
      id: l.id,
      t: l.type,
      p: l.parentId,
      b: l.blendMode,
      sh: l.shape && {
        k: l.shape.kind,
        w: l.shape.width,
        h: l.shape.height,
        cr: l.shape.cornerRadius,
        pt: l.shape.points,
        f: l.shape.fill,
        s: l.shape.stroke,
      },
      tx: l.text,
      im: l.image && `${l.image.src.length}:${l.image.src.slice(0, 64)}`,
      fx: l.effects.map((e) => ({ id: e.id, t: e.type, on: e.enabled, c: e.color, c2: e.color2 })),
      // Cloner geometry (clone COUNT) changes the graph → rebuild; per-clone
      // step/stagger params are applied live in renderAt.
      cl: l.cloner?.enabled
        ? `${l.cloner.mode}:${l.cloner.cols}x${l.cloner.rows}:${l.cloner.count}`
        : "0",
    })),
    // Palette swatch values are baked into shape geometry at build → a re-theme
    // must rebuild the graph.
    pal: scene.palette?.swatches.map((s) => `${s.id}:${s.color}`).join(","),
  });
}

export class SceneRenderer {
  app: Application | null = null;
  private nodes = new Map<string, LayerNode>();
  private scene: SceneDocument;
  private sig = "";
  private ready = false;
  private lastTime = 0;
  /** "preview" trades bloom passes for editor smoothness; "high" is full-fat. */
  private quality: "preview" | "high";

  constructor(scene: SceneDocument, quality: "preview" | "high" = "preview") {
    this.scene = scene;
    this.quality = quality;
  }

  async init(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<void> {
    const app = new Application();
    await app.init({
      canvas: canvas as HTMLCanvasElement,
      width: this.scene.composition.width,
      height: this.scene.composition.height,
      background: this.scene.composition.background,
      antialias: true,
      autoDensity: false,
      resolution: 1,
      preference: "webgl",
    });
    // We drive rendering manually on scrub/play for determinism.
    app.ticker.stop();
    this.app = app;
    this.ready = true;
    this.rebuild(this.scene);
  }

  get isReady() {
    return this.ready;
  }

  /** Swap in a new scene; rebuilds the graph only if structure changed. */
  setScene(scene: SceneDocument) {
    this.scene = scene;
    if (!this.app) return;
    const sig = signature(scene);
    if (sig !== this.sig) {
      this.rebuild(scene);
    } else {
      // Keep node.layer references current so renderAt reads fresh values.
      for (const layer of scene.layers) {
        const node = this.nodes.get(layer.id);
        if (node) node.layer = layer;
      }
    }
  }

  private rebuild(scene: SceneDocument) {
    if (!this.app) return;
    const stage = this.app.stage;
    // Tear down old nodes.
    for (const node of this.nodes.values()) {
      node.outer.destroy({ children: true });
    }
    this.nodes.clear();
    stage.removeChildren();

    if (
      this.app.renderer &&
      (this.app.renderer.width !== scene.composition.width ||
        this.app.renderer.height !== scene.composition.height)
    ) {
      this.app.renderer.resize(
        scene.composition.width,
        scene.composition.height,
      );
    }
    this.app.renderer.background.color = hex(scene.composition.background);

    // Build a node per layer in stacking order.
    for (const layer of scene.layers) {
      const node = this.buildNode(layer);
      this.nodes.set(layer.id, node);
    }
    // Parent them (nested transform inheritance); fall back to stage.
    for (const layer of scene.layers) {
      const node = this.nodes.get(layer.id)!;
      const parent = layer.parentId ? this.nodes.get(layer.parentId) : null;
      if (parent) parent.outer.addChild(node.outer);
      else stage.addChild(node.outer);
    }

    this.sig = signature(scene);
  }

  /** Build the visual display object for a layer (one per clone). */
  private buildDisplay(layer: Layer): { display: Container; width: number; height: number } {
    let display: Container;
    let width = 0;
    let height = 0;

    if (layer.type === "shape" && layer.shape) {
      display = this.drawShape(layer.shape);
      width = layer.shape.width;
      height = layer.shape.height;
    } else if (layer.type === "text" && layer.text) {
      const style = new TextStyle({
        fontFamily: layer.text.fontFamily,
        fontSize: layer.text.fontSize,
        fontWeight: String(layer.text.fontWeight) as TextStyle["fontWeight"],
        fill: resolved(layer.text.fill, this.scene),
        align: layer.text.align,
        letterSpacing: layer.text.letterSpacing,
      });
      const text = new Text({ text: layer.text.content, style });
      display = text;
      width = text.width;
      height = text.height;
    } else if (layer.type === "image" && layer.image) {
      const sprite = new Sprite(Texture.EMPTY);
      const w0 = layer.image.naturalWidth;
      const h0 = layer.image.naturalHeight;
      width = w0;
      height = h0;
      display = sprite;
      void this.loadImage(layer.image.src).then((tex) => {
        if (!tex) return;
        sprite.texture = tex;
        sprite.setSize(w0, h0);
        this.renderAt(this.lastTime);
      });
    } else {
      display = new Container();
    }
    return { display, width, height };
  }

  private buildFilters(layer: Layer): { filters: Map<string, Filter>; list: Filter[] } {
    const filters = new Map<string, Filter>();
    const list: Filter[] = [];
    for (const effect of layer.effects) {
      if (!effect.enabled) continue;
      const f = this.createFilter(effect);
      if (f) {
        filters.set(effect.id, f);
        list.push(f);
      }
    }
    return { filters, list };
  }

  private buildNode(layer: Layer): LayerNode {
    const outer = new Container();
    outer.label = layer.name;

    // Per-clone transforms (identity single clone when the cloner is off).
    const cloneTfs: CloneTransform[] =
      layer.cloner?.enabled
        ? clonerTransforms(layer.cloner)
        : [{ index: 0, dx: 0, dy: 0, rotation: 0, scaleMul: 1, opacityMul: 1 }];

    let width = 0;
    let height = 0;
    const clones: CloneNode[] = cloneTfs.map((clone) => {
      const container = new Container();
      const { display, width: w, height: h } = this.buildDisplay(layer);
      width = w;
      height = h;
      container.addChild(display);
      const { filters, list } = this.buildFilters(layer);
      if (list.length) container.filters = list;
      outer.addChild(container);
      return { container, display, filters, clone };
    });

    return { layer, outer, clones, width, height };
  }

  private drawShape(shape: ShapePayload): Graphics {
    const g = new Graphics();
    const { width: w, height: h } = shape;

    switch (shape.kind) {
      case "rect":
        if (shape.cornerRadius > 0)
          g.roundRect(0, 0, w, h, Math.min(shape.cornerRadius, w / 2, h / 2));
        else g.rect(0, 0, w, h);
        break;
      case "ellipse":
        g.ellipse(w / 2, h / 2, w / 2, h / 2);
        break;
      case "polygon":
        g.poly(regularPolygon(w, h, shape.points, false));
        break;
      case "star":
        g.star(w / 2, h / 2, shape.points, Math.min(w, h) / 2);
        break;
    }

    // Fill — solid or a best-effort linear gradient (swatch refs resolved).
    const fill = shape.fill;
    const fillColor = resolved(fill.color, this.scene);
    if (fill.gradient) {
      try {
        const grad = makeGradient(
          w,
          h,
          fillColor,
          resolved(fill.gradient.to, this.scene),
          fill.gradient.angle,
        );
        g.fill(grad);
      } catch {
        g.fill({ color: hex(fillColor) });
      }
    } else {
      g.fill({ color: hex(fillColor) });
    }

    if (shape.stroke && shape.stroke.width > 0) {
      g.stroke({ width: shape.stroke.width, color: hex(resolved(shape.stroke.color, this.scene)) });
    }
    return g;
  }

  private createFilter(effect: Effect): Filter | null {
    const p = (k: string, d = 0) => effect.params[k]?.value ?? d;
    const c1 = hex(resolved(effect.color ?? "#ffffff", this.scene));
    const c2 = hex(resolved(effect.color2 ?? "#000000", this.scene));
    try {
      switch (effect.type) {
        case "blur":
          return new BlurFilter({ strength: p("strength", 8) });
        case "motion-blur": {
          const a = (p("angle") * Math.PI) / 180;
          const len = p("length", 30);
          return new MotionBlurFilter({
            velocity: { x: Math.cos(a) * len, y: Math.sin(a) * len },
          });
        }
        case "zoom-blur":
          return new ZoomBlurFilter({
            strength: p("strength", 0.2),
            innerRadius: p("innerRadius", 0),
            center: { x: this.cx(), y: this.cy() },
          });
        case "radial-blur":
          return new RadialBlurFilter({
            angle: p("angle", 12),
            center: { x: this.cx(), y: this.cy() },
          });
        case "glow":
        case "bloom":
          return new DeepGlowFilter(this.glowOptions(effect));
        case "drop-shadow": {
          const a = (p("angle", 45) * Math.PI) / 180;
          const dist = p("distance", 12);
          return new DropShadowFilter({
            color: c1,
            offset: { x: Math.cos(a) * dist, y: Math.sin(a) * dist },
            alpha: p("alpha", 60) / 100,
            blur: p("blur", 8),
          });
        }
        case "outline":
          return new OutlineFilter({ thickness: p("thickness", 3), color: c1 });
        case "bevel":
          return new BevelFilter({
            rotation: p("rotation", 45),
            thickness: p("thickness", 2),
            lightColor: c1,
            shadowColor: c2,
          });
        case "adjust":
          return new AdjustmentFilter({
            brightness: p("brightness", 1),
            contrast: p("contrast", 1),
            saturation: p("saturation", 1),
            gamma: p("gamma", 1),
          });
        case "hue-saturation":
          return new HslAdjustmentFilter({
            hue: p("hue", 0),
            saturation: p("saturation", 0),
            lightness: p("lightness", 0),
            colorize: false,
            alpha: 1,
          });
        case "tint":
          return new DuotoneFilter(
            resolved(effect.color ?? "#101830", this.scene),
            resolved(effect.color2 ?? "#5ce1ff", this.scene),
            p("amount", 100) / 100,
          );
        case "film-grade": {
          const f = new FilmGradeFilter();
          f.u.uExposure = p("exposure", 1);
          f.u.uContrast = p("contrast", 1.1);
          f.u.uSaturation = p("saturation", 1.1);
          f.u.uTemperature = p("temperature", 0);
          return f;
        }
        case "color-overlay":
          return new ColorOverlayFilter({ color: c1, alpha: p("alpha", 100) / 100 });
        case "rgb-split":
          return new ChromaticAberrationFilter(p("amount", 8), p("edge", 1));
        case "glitch":
          return new GlitchFilter({
            slices: Math.round(p("slices", 6)),
            offset: p("offset", 80),
          });
        case "crt":
          return new CRTFilter({
            curvature: p("curvature", 1),
            lineWidth: p("lineWidth", 1),
            noise: p("noise", 0.2),
            vignetting: p("vignetting", 0.3),
          });
        case "old-film":
          return new OldFilmFilter({
            sepia: p("sepia", 0.3),
            noise: p("noise", 0.3),
            scratch: p("scratch", 0.5),
            vignetting: p("vignetting", 0.3),
          });
        case "pixelate":
          return new PixelateFilter(Math.max(1, p("size", 10)));
        case "dot":
          return new DotFilter({
            scale: p("scale", 1),
            angle: (p("angle", 5) * Math.PI) / 180,
          });
        case "vignette":
          return new VignetteFilter(
            p("amount", 0.55),
            p("size", 0.7),
            p("softness", 0.4),
          );
        case "bulge-pinch":
          return new BulgePinchFilter({
            strength: p("strength", 0.5),
            radius: p("radius", 200),
            center: { x: this.cx(), y: this.cy() },
          });
        case "twist":
          return new TwistFilter({
            angle: p("angle", 4),
            radius: p("radius", 200),
            offset: { x: this.cx() * this.scene.composition.width, y: this.cy() * this.scene.composition.height },
          });
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private cx() {
    return 0.5;
  }
  private cy() {
    return 0.5;
  }

  /** Map a glow/bloom effect's params onto DeepGlow options for this quality. */
  private glowOptions(effect: Effect) {
    const p = (k: string, d = 0) => effect.params[k]?.value ?? d;
    const tintHex = resolved(effect.color ?? "#ffffff", this.scene);
    const n = Number.parseInt(tintHex.replace("#", ""), 16) || 0xffffff;
    const tint: [number, number, number] = [
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255,
    ];
    return {
      intensity: p("intensity", 1.2),
      threshold: p("threshold", 0.5),
      knee: p("knee", 0.4),
      radius: p("radius", 1.5),
      exposure: p("exposure", 1.6),
      chroma: p("chroma", 0),
      anamorphic: p("anamorphic", 0),
      tint,
      tonemap: 1 as const,
      mix: 1,
      quality: this.quality,
    };
  }

  private async loadImage(src: string): Promise<Texture | null> {
    // Decode via an HTMLImageElement — robust for data URLs across Pixi
    // versions — then wrap it in a Texture.
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      await img.decode();
      return Texture.from(img);
    } catch {
      // Fall back to the Assets loader.
      try {
        return await Assets.load(src);
      } catch {
        return null;
      }
    }
  }

  /** Evaluate every layer at time `t` and apply to the Pixi graph, then draw. */
  renderAt(t: number) {
    if (!this.app) return;
    this.lastTime = t;
    const layersById = new Map(this.scene.layers.map((l) => [l.id, l]));

    const dur = this.scene.composition.duration;
    // Solo: if any layer is soloed, only soloed layers render.
    const anySolo = this.scene.layers.some((l) => l.solo);

    for (const layer of this.scene.layers) {
      const node = this.nodes.get(layer.id);
      if (!node) continue;
      node.layer = layer;

      const tf = evalTransform(layer.transform, t);
      const active =
        layer.visible && isLayerActive(layer, t) && (!anySolo || layer.solo);
      const count = layer.cloner?.enabled ? cloneCount(layer.cloner) : 1;
      const stagger = layer.cloner?.enabled ? layer.cloner.stagger : 0;

      for (const cn of node.clones) {
        const cl = cn.clone;
        // Per-clone behavior cascade (index drives the stagger delay).
        const ctx: CloneContext = { index: cl.index, count, stagger };
        const beh = evalBehaviors(layer.behaviors ?? [], t, dur, ctx);

        const c = cn.container;
        c.position.set(tf.x + cl.dx + beh.x, tf.y + cl.dy + beh.y);
        c.pivot.set(tf.anchorX * node.width, tf.anchorY * node.height);
        const sc = (tf.scaleX / 100) * cl.scaleMul + beh.scale / 100;
        const scY = (tf.scaleY / 100) * cl.scaleMul + beh.scale / 100;
        c.scale.set(sc, scY);
        c.rotation = ((tf.rotation + cl.rotation + beh.rotation) * Math.PI) / 180;
        c.alpha = Math.max(
          0,
          Math.min(1, (tf.opacity / 100) * cl.opacityMul + beh.opacity / 100),
        );
        c.visible = active;
        c.blendMode = layer.blendMode;

        // Update animatable filter params live.
        for (const effect of layer.effects) {
          const f = cn.filters.get(effect.id);
          if (!f) continue;
          const p = evalEffectParams(effect, t);
          applyFilterParams(f, effect, p, t);
        }
      }
      void layersById; // (parent-opacity folding handled by Pixi nesting)
    }

    this.app.renderer.render(this.app.stage);
  }

  resizeView(displayWidth: number, displayHeight: number) {
    if (!this.app?.canvas) return;
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
  }

  /** Pull a frame as a bitmap for export pipelines. */
  get canvas(): HTMLCanvasElement | OffscreenCanvas | undefined {
    return this.app?.canvas;
  }

  destroy() {
    this.ready = false;
    this.nodes.clear();
    this.app?.destroy(true, { children: true, texture: true });
    this.app = null;
  }
}

function applyFilterParams(
  f: Filter,
  effect: Effect,
  p: Record<string, number>,
  t: number,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const af = f as any;
  const set = (k: string, v: number | undefined) => {
    if (v !== undefined) af[k] = v;
  };
  switch (effect.type) {
    case "blur":
      set("strength", p.strength);
      break;
    case "motion-blur": {
      const a = ((p.angle ?? 0) * Math.PI) / 180;
      const len = p.length ?? 0;
      af.velocity = { x: Math.cos(a) * len, y: Math.sin(a) * len };
      break;
    }
    case "zoom-blur":
      set("strength", p.strength);
      set("innerRadius", p.innerRadius);
      break;
    case "radial-blur":
      set("angle", p.angle);
      break;
    case "glow":
    case "bloom": {
      // DeepGlowFilter — update its options object live.
      const o = af.options;
      if (o) {
        if (p.intensity !== undefined) o.intensity = p.intensity;
        if (p.threshold !== undefined) o.threshold = p.threshold;
        if (p.knee !== undefined) o.knee = p.knee;
        if (p.radius !== undefined) o.radius = p.radius;
        if (p.exposure !== undefined) o.exposure = p.exposure;
        if (p.chroma !== undefined) o.chroma = p.chroma;
        if (p.anamorphic !== undefined) o.anamorphic = p.anamorphic;
      }
      break;
    }
    case "drop-shadow": {
      const a = ((p.angle ?? 45) * Math.PI) / 180;
      const dist = p.distance ?? 12;
      af.offset = { x: Math.cos(a) * dist, y: Math.sin(a) * dist };
      if (p.alpha !== undefined) af.alpha = p.alpha / 100;
      set("blur", p.blur);
      break;
    }
    case "outline":
      set("thickness", p.thickness);
      break;
    case "bevel":
      set("rotation", p.rotation);
      set("thickness", p.thickness);
      break;
    case "adjust":
      set("brightness", p.brightness);
      set("contrast", p.contrast);
      set("saturation", p.saturation);
      set("gamma", p.gamma);
      break;
    case "hue-saturation":
      set("hue", p.hue);
      set("saturation", p.saturation);
      set("lightness", p.lightness);
      break;
    case "tint":
      if (af.u && p.amount !== undefined) af.u.uAmount = p.amount / 100;
      break;
    case "film-grade":
      if (af.u) {
        if (p.exposure !== undefined) af.u.uExposure = p.exposure;
        if (p.contrast !== undefined) af.u.uContrast = p.contrast;
        if (p.saturation !== undefined) af.u.uSaturation = p.saturation;
        if (p.temperature !== undefined) af.u.uTemperature = p.temperature;
      }
      break;
    case "color-overlay":
      if (p.alpha !== undefined) af.alpha = p.alpha / 100;
      break;
    case "rgb-split":
      if (af.u) {
        if (p.amount !== undefined) af.u.uAmount = p.amount / 20;
        if (p.edge !== undefined) af.u.uEdge = p.edge;
      }
      break;
    case "vignette":
      if (af.u) {
        if (p.amount !== undefined) af.u.uAmount = p.amount;
        if (p.size !== undefined) af.u.uSize = p.size;
        if (p.softness !== undefined) af.u.uSoftness = p.softness;
      }
      break;
    case "glitch":
      if (p.slices !== undefined) af.slices = Math.round(p.slices);
      set("offset", p.offset);
      af.seed = (t * 2) % 1; // animate the glitch a little over time
      break;
    case "crt":
      set("curvature", p.curvature);
      set("lineWidth", p.lineWidth);
      set("noise", p.noise);
      set("vignetting", p.vignetting);
      af.time = t * 10;
      break;
    case "old-film":
      set("sepia", p.sepia);
      set("noise", p.noise);
      set("scratch", p.scratch);
      set("vignetting", p.vignetting);
      af.seed = Math.random();
      break;
    case "pixelate":
      if (p.size !== undefined) af.size = Math.max(1, p.size);
      break;
    case "dot":
      set("scale", p.scale);
      if (p.angle !== undefined) af.angle = (p.angle * Math.PI) / 180;
      break;
    case "bulge-pinch":
      set("strength", p.strength);
      set("radius", p.radius);
      break;
    case "twist":
      set("angle", p.angle);
      set("radius", p.radius);
      break;
  }
}

function regularPolygon(
  w: number,
  h: number,
  points: number,
  _star: boolean,
): number[] {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

function makeGradient(
  w: number,
  h: number,
  from: string,
  to: string,
  angleDeg: number,
): FillGradient {
  const a = (angleDeg * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const dx = Math.cos(a) * w * 0.5;
  const dy = Math.sin(a) * h * 0.5;
  // Object form is the current Pixi v8 API.
  return new FillGradient({
    type: "linear",
    start: { x: cx - dx, y: cy - dy },
    end: { x: cx + dx, y: cy + dy },
    colorStops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
    textureSpace: "local",
  });
}
