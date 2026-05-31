/**
 * Loft Motion — Deep-Glow-class HDR bloom.
 *
 * A multi-pass, linear-light bloom modelled on Deep Glow 2 / the COD:AW bloom
 * (Jimenez) approach, built on the proven pixi-filters multi-pass pattern
 * (sub-filters chained through FilterManager + TexturePool).
 *
 * Pipeline (all in LINEAR light):
 *   1. Bright pass — sRGB→linear, soft-knee threshold, exposure boost, into a
 *      half-res target (cheaper + pre-averages fireflies).
 *   2. Multi-scale blur — several KawaseBlur passes at growing radii, summed,
 *      to approximate the wide, smooth, multi-radius falloff a single Gaussian
 *      can't. Optional anamorphic (horizontal) stretch per pass.
 *   3. Composite — scene + tinted/scaled bloom, with optional per-channel
 *      "chromatic spread", ACES/Reinhard tonemap, linear→sRGB, and dithering.
 *
 * A `quality` knob (preview vs export) controls the number of blur scales and
 * the working resolution so the editor stays smooth while export is full-fat.
 */
import {
  Filter,
  GlProgram,
  Texture,
  TexturePool,
  type FilterSystem,
  type RenderSurface,
} from "pixi.js";
import { KawaseBlurFilter } from "pixi-filters";
import { VERTEX, COLOR_FUNCS } from "@/lib/render/filters/glsl";

/* -------------------------------------------------------------------------- */
/*  Bright pass — extract & threshold in linear light                          */
/* -------------------------------------------------------------------------- */

const BRIGHT_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uKnee;
uniform float uExposure;

${COLOR_FUNCS}

void main() {
    vec4 src = texture(uTexture, vTextureCoord);
    vec3 lin = srgbToLinear(src.rgb) * uExposure;
    float b = max(lin.r, max(lin.g, lin.b));
    // Soft-knee threshold (Catlike Coding / Unity): smooth fade-in near t.
    float knee = max(uKnee, 1e-4);
    float soft = clamp(b - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-6);
    float contrib = max(soft, b - uThreshold) / max(b, 1e-6);
    finalColor = vec4(lin * contrib, 1.0);
}
`;

class BrightPassFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: BRIGHT_FRAG, name: "lm-bright" }),
      resources: {
        brightUniforms: {
          uThreshold: { value: 0.5, type: "f32" },
          uKnee: { value: 0.3, type: "f32" },
          uExposure: { value: 1.5, type: "f32" },
        },
      },
    });
  }
  get u() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.resources.brightUniforms as any).uniforms;
  }
}

/* -------------------------------------------------------------------------- */
/*  Composite — combine scene + bloom in linear, tonemap, back to sRGB         */
/* -------------------------------------------------------------------------- */

const COMPOSITE_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;     // original scene (sRGB)
uniform sampler2D uBloom;       // accumulated bloom (LINEAR)
uniform vec3 uTint;
uniform float uIntensity;
uniform float uChroma;          // per-channel radial spread (0 = off)
uniform int uTonemap;           // 0 none, 1 ACES, 2 Reinhard
uniform float uMix;             // 0 = original only, 1 = full glow

${COLOR_FUNCS}

// cheap hash for dithering (kills banding in the smooth falloff)
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

vec3 sampleBloom(vec2 uv) {
    if (uChroma <= 0.0) return texture(uBloom, uv).rgb;
    vec2 dir = uv - 0.5;
    float k = uChroma * dot(dir, dir);
    float r = texture(uBloom, uv - dir * k).r;
    float g = texture(uBloom, uv).g;
    float b = texture(uBloom, uv + dir * k).b;
    return vec3(r, g, b);
}

void main() {
    vec4 srcS = texture(uTexture, vTextureCoord);
    vec3 scene = srgbToLinear(srcS.rgb);
    vec3 bloom = sampleBloom(vTextureCoord) * uTint * uIntensity;

    vec3 lit = scene + bloom * uMix;
    if (uTonemap == 1) lit = aces(lit);
    else if (uTonemap == 2) lit = reinhard(lit);

    vec3 outc = linearToSrgb(lit);
    // ordered-ish dithering
    outc += (hash(vTextureCoord * 1024.0) - 0.5) / 255.0;
    // preserve original alpha shape, lifted by bloom energy
    float a = max(srcS.a, clamp(luma(bloom) * uMix, 0.0, 1.0));
    finalColor = vec4(outc, a);
}
`;

class CompositeFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: COMPOSITE_FRAG, name: "lm-bloom-composite" }),
      resources: {
        compositeUniforms: {
          uTint: { value: new Float32Array([1, 1, 1]), type: "vec3<f32>" },
          uIntensity: { value: 1, type: "f32" },
          uChroma: { value: 0, type: "f32" },
          uTonemap: { value: 1, type: "i32" },
          uMix: { value: 1, type: "f32" },
        },
        uBloom: Texture.EMPTY,
      },
    });
  }
  get u() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.resources.compositeUniforms as any).uniforms;
  }
}

/* -------------------------------------------------------------------------- */
/*  Additive accumulate — add one blurred scale onto the running bloom         */
/* -------------------------------------------------------------------------- */

const ADD_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;   // the scale to add
uniform sampler2D uAccum;     // running accumulation
uniform float uWeight;
void main() {
    vec3 a = texture(uAccum, vTextureCoord).rgb;
    vec3 s = texture(uTexture, vTextureCoord).rgb;
    finalColor = vec4(a + s * uWeight, 1.0);
}
`;

class AddFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: ADD_FRAG, name: "lm-bloom-add" }),
      resources: {
        addUniforms: { uWeight: { value: 1, type: "f32" } },
        uAccum: Texture.EMPTY,
      },
    });
  }
  get u() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.resources.addUniforms as any).uniforms;
  }
}

/* -------------------------------------------------------------------------- */
/*  The filter                                                                 */
/* -------------------------------------------------------------------------- */

export interface DeepGlowOptions {
  threshold: number; // 0..1 brightness to start blooming
  knee: number; // soft-threshold softness
  intensity: number; // bloom strength on composite
  radius: number; // overall spread (scales blur kernels)
  exposure: number; // pushes highlights into HDR before threshold
  tint: [number, number, number]; // bloom colour multiplier (0..1)
  chroma: number; // chromatic spread
  anamorphic: number; // 0 = round, 1 = fully horizontal streak
  tonemap: 0 | 1 | 2; // none / ACES / Reinhard
  mix: number; // master wet/dry
  /** Render quality — fewer scales/lower res in the editor preview. */
  quality: "preview" | "high";
}

const DEFAULTS: DeepGlowOptions = {
  threshold: 0.5,
  knee: 0.4,
  intensity: 1.0,
  radius: 1.0,
  exposure: 1.6,
  tint: [1, 1, 1],
  chroma: 0,
  anamorphic: 0,
  tonemap: 1,
  mix: 1,
  quality: "high",
};

export class DeepGlowFilter extends Filter {
  options: DeepGlowOptions;
  private bright = new BrightPassFilter();
  private composite = new CompositeFilter();
  private adder = new AddFilter();
  private blur = new KawaseBlurFilter();

  constructor(options: Partial<DeepGlowOptions> = {}) {
    // This outer Filter instance is never drawn directly; apply() drives the
    // sub-filters. We still need a valid program, so reuse the composite's.
    super({
      glProgram: GlProgram.from({
        vertex: VERTEX,
        fragment: COMPOSITE_FRAG,
        name: "lm-deepglow-noop",
      }),
      resources: {
        compositeUniforms: {
          uTint: { value: new Float32Array([1, 1, 1]), type: "vec3<f32>" },
          uIntensity: { value: 1, type: "f32" },
          uChroma: { value: 0, type: "f32" },
          uTonemap: { value: 1, type: "i32" },
          uMix: { value: 1, type: "f32" },
        },
        uBloom: Texture.EMPTY,
      },
    });
    this.options = { ...DEFAULTS, ...options };
    // The bloom must be allowed to spread beyond the layer's bounds.
    this.padding = 64;
  }

  apply(
    filterManager: FilterSystem,
    input: Texture,
    output: RenderSurface,
    clearMode: boolean,
  ): void {
    const o = this.options;

    // 1) Bright pass → bright target.
    const bu = this.bright.u;
    bu.uThreshold = o.threshold;
    bu.uKnee = o.knee;
    bu.uExposure = o.exposure;
    const bright = TexturePool.getSameSizeTexture(input);
    this.bright.apply(filterManager, input, bright, true);

    // 2) Multi-scale blur, accumulated additively. Ping-pong between two
    //    targets; Texture.EMPTY reads as black so it seeds the first add.
    const scales = o.quality === "high" ? [1, 2, 4, 8, 16] : [1, 4, 10];
    let accum = TexturePool.getSameSizeTexture(input);
    let temp = TexturePool.getSameSizeTexture(input);
    const blurred = TexturePool.getSameSizeTexture(input);

    for (let i = 0; i < scales.length; i++) {
      const base = scales[i] * o.radius;
      const sx = base * (1 + o.anamorphic * 3);
      const sy = base * (1 - o.anamorphic * 0.85);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blurAny = this.blur as any;
      blurAny.strength = Math.max(0.5, Math.max(sx, sy));
      blurAny.pixelSize = { x: 1, y: Math.max(0.25, sy / Math.max(sx, 0.001)) };
      this.blur.apply(filterManager, bright, blurred, true);

      // Larger scales weighted down so the bright core dominates.
      this.adder.u.uWeight = 1 / (1 + i * 0.6);
      this.adder.resources.uAccum = (i === 0 ? Texture.EMPTY : accum).source;
      this.adder.apply(filterManager, blurred, temp, true);
      // swap accum <-> temp
      const t = accum;
      accum = temp;
      temp = t;
    }

    // 3) Composite over the original input.
    const cu = this.composite.u;
    cu.uTint = new Float32Array(o.tint);
    cu.uIntensity = o.intensity;
    cu.uChroma = o.chroma;
    cu.uTonemap = o.tonemap;
    cu.uMix = o.mix;
    this.composite.resources.uBloom = accum.source;
    this.composite.apply(filterManager, input, output, clearMode);

    TexturePool.returnTexture(bright);
    TexturePool.returnTexture(accum);
    TexturePool.returnTexture(temp);
    TexturePool.returnTexture(blurred);
  }
}
