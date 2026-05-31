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
import { GlowFilter, DropShadowFilter } from "pixi-filters";

// Pixi's barrel re-exports `./filters/index` twice, which makes some core filter
// symbols (e.g. BlurFilter) ambiguous to the type-checker even though they exist
// at runtime. Pull it off the namespace with a precise constructor type.
const BlurFilter = (Pixi as unknown as {
  BlurFilter: new (opts: { strength?: number }) => Filter;
}).BlurFilter;
import {
  evalEffectParams,
  evalTransform,
  isLayerActive,
} from "@/lib/anim/evaluate";
import type {
  Effect,
  Layer,
  SceneDocument,
  ShapePayload,
} from "@/lib/scene/schema";

interface LayerNode {
  layer: Layer;
  container: Container;
  display: Container; // the visual child (graphics/text/sprite) inside container
  width: number;
  height: number;
  filters: Map<string, Filter>; // keyed by effect id
}

function hex(color: string): number {
  return Number.parseInt(color.replace("#", ""), 16) || 0;
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
      im: l.image?.src.slice(0, 32),
      fx: l.effects.map((e) => ({ id: e.id, t: e.type, on: e.enabled, c: e.color })),
    })),
  });
}

export class SceneRenderer {
  app: Application | null = null;
  private nodes = new Map<string, LayerNode>();
  private scene: SceneDocument;
  private sig = "";
  private ready = false;

  constructor(scene: SceneDocument) {
    this.scene = scene;
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
      node.container.destroy({ children: true });
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
      if (parent) parent.container.addChild(node.container);
      else stage.addChild(node.container);
    }

    this.sig = signature(scene);
  }

  private buildNode(layer: Layer): LayerNode {
    const container = new Container();
    container.label = layer.name;
    let display: Container;
    let width = 0;
    let height = 0;

    if (layer.type === "shape" && layer.shape) {
      const g = this.drawShape(layer.shape);
      display = g;
      width = layer.shape.width;
      height = layer.shape.height;
    } else if (layer.type === "text" && layer.text) {
      const style = new TextStyle({
        fontFamily: layer.text.fontFamily,
        fontSize: layer.text.fontSize,
        fontWeight: String(layer.text.fontWeight) as TextStyle["fontWeight"],
        fill: layer.text.fill,
        align: layer.text.align,
        letterSpacing: layer.text.letterSpacing,
      });
      const text = new Text({ text: layer.text.content, style });
      display = text;
      width = text.width;
      height = text.height;
    } else if (layer.type === "image" && layer.image) {
      const sprite = new Sprite(Texture.WHITE);
      sprite.width = layer.image.naturalWidth;
      sprite.height = layer.image.naturalHeight;
      width = layer.image.naturalWidth;
      height = layer.image.naturalHeight;
      display = sprite;
      // Load the real texture asynchronously, then resize the sprite.
      void this.loadImage(layer.image.src).then((tex) => {
        if (tex) sprite.texture = tex;
        sprite.width = layer.image!.naturalWidth;
        sprite.height = layer.image!.naturalHeight;
      });
    } else {
      // group / precomp — an empty container.
      display = new Container();
    }

    container.addChild(display);

    const filters = new Map<string, Filter>();
    const filterList: Filter[] = [];
    for (const effect of layer.effects) {
      if (!effect.enabled) continue;
      const f = this.createFilter(effect);
      if (f) {
        filters.set(effect.id, f);
        filterList.push(f);
      }
    }
    if (filterList.length) container.filters = filterList;

    return { layer, container, display, width, height, filters };
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

    // Fill — solid or a best-effort linear gradient.
    const fill = shape.fill;
    if (fill.gradient) {
      try {
        const grad = makeGradient(
          w,
          h,
          fill.color,
          fill.gradient.to,
          fill.gradient.angle,
        );
        g.fill(grad);
      } catch {
        g.fill({ color: hex(fill.color) });
      }
    } else {
      g.fill({ color: hex(fill.color) });
    }

    if (shape.stroke && shape.stroke.width > 0) {
      g.stroke({ width: shape.stroke.width, color: hex(shape.stroke.color) });
    }
    return g;
  }

  private createFilter(effect: Effect): Filter | null {
    try {
      switch (effect.type) {
        case "blur":
          return new BlurFilter({ strength: effect.params.strength?.value ?? 8 });
        case "glow":
          return new GlowFilter({
            color: hex(effect.color ?? "#ffffff"),
            outerStrength: effect.params.strength?.value ?? 12,
            innerStrength: effect.params.innerStrength?.value ?? 0,
            quality: 0.3,
          });
        case "drop-shadow":
          return new DropShadowFilter({
            color: hex(effect.color ?? "#000000"),
            alpha: (effect.params.alpha?.value ?? 60) / 100,
            blur: effect.params.blur?.value ?? 8,
          });
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private async loadImage(src: string): Promise<Texture | null> {
    try {
      return await Assets.load(src);
    } catch {
      return null;
    }
  }

  /** Evaluate every layer at time `t` and apply to the Pixi graph, then draw. */
  renderAt(t: number) {
    if (!this.app) return;
    const layersById = new Map(this.scene.layers.map((l) => [l.id, l]));

    for (const layer of this.scene.layers) {
      const node = this.nodes.get(layer.id);
      if (!node) continue;
      node.layer = layer;
      const tf = evalTransform(layer.transform, t);
      const c = node.container;

      c.position.set(tf.x, tf.y);
      c.pivot.set(tf.anchorX * node.width, tf.anchorY * node.height);
      c.scale.set(tf.scaleX / 100, tf.scaleY / 100);
      c.rotation = (tf.rotation * Math.PI) / 180;
      c.alpha = tf.opacity / 100;
      c.visible = layer.visible && isLayerActive(layer, t);
      c.blendMode = layer.blendMode;

      // Update animatable filter params live.
      for (const effect of layer.effects) {
        const f = node.filters.get(effect.id);
        if (!f) continue;
        const p = evalEffectParams(effect, t);
        applyFilterParams(f, effect, p);
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
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const af = f as any;
  switch (effect.type) {
    case "blur":
      af.strength = p.strength ?? af.strength;
      break;
    case "glow":
      af.outerStrength = p.strength ?? af.outerStrength;
      af.innerStrength = p.innerStrength ?? af.innerStrength;
      break;
    case "drop-shadow":
      if (p.alpha !== undefined) af.alpha = p.alpha / 100;
      if (p.blur !== undefined) af.blur = p.blur;
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
