/**
 * Loft Motion — single-pass custom effect filters (the broad quality lift).
 *
 * Each is a Pixi v8 `Filter` with a GLSL ES 3.0 fragment shader using the same
 * convention as DeepGlow and pixi-filters (default VERTEX, `uTexture`, declared
 * `out vec4 finalColor`). They run with `padding: 0` so `vTextureCoord` maps
 * ~0..1 across the layer and centred effects can use 0.5 as the centre. Colour
 * work is done in LINEAR light (sRGB→linear→effect→sRGB) for a filmic look.
 */
import { Filter, GlProgram } from "pixi.js";
import { VERTEX, COLOR_FUNCS } from "@/lib/render/filters/glsl";

/* -------------------------------------------------------------------------- */
/*  Lens-weighted chromatic aberration                                         */
/*  Offset grows with distance² from centre (real lenses fringe at the edge).  */
/* -------------------------------------------------------------------------- */

const CA_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uAmount;     // strength
uniform float uEdge;       // 0 = uniform, 1 = fully edge-weighted

void main() {
    vec2 c = vec2(0.5);
    vec2 dir = vTextureCoord - c;
    // aspect-correct the radial falloff
    float aspect = uInputSize.x / max(uInputSize.y, 1.0);
    vec2 da = vec2(dir.x * aspect, dir.y);
    float r2 = dot(da, da);
    float k = uAmount * mix(0.02, r2 * 0.5 + 0.01, uEdge);
    vec2 off = dir * k;
    float r = texture(uTexture, vTextureCoord - off).r;
    vec4  g = texture(uTexture, vTextureCoord);
    float b = texture(uTexture, vTextureCoord + off).b;
    finalColor = vec4(r, g.g, b, g.a);
}
`;

export class ChromaticAberrationFilter extends Filter {
  constructor(amount = 8, edge = 1) {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: CA_FRAG, name: "lm-ca" }),
      resources: {
        caUniforms: {
          uAmount: { value: amount / 20, type: "f32" },
          uEdge: { value: edge, type: "f32" },
        },
      },
    });
  }
  get u() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.resources.caUniforms as any).uniforms;
  }
}

/* -------------------------------------------------------------------------- */
/*  Natural optical vignette (cos⁴-ish smoothstep falloff, in linear)          */
/* -------------------------------------------------------------------------- */

const VIGNETTE_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uAmount;     // 0..1 how dark the corners get
uniform float uSize;       // radius where darkening starts
uniform float uSoftness;   // edge feather

${COLOR_FUNCS}

void main() {
    vec4 src = texture(uTexture, vTextureCoord);
    vec2 d = vTextureCoord - 0.5;
    float aspect = uInputSize.x / max(uInputSize.y, 1.0);
    d.x *= aspect;
    float dist = length(d) / length(vec2(0.5 * aspect, 0.5));
    float v = smoothstep(uSize + uSoftness, uSize - uSoftness, dist);
    v = mix(1.0, v, uAmount);
    // multiply in linear light so it reads as natural light falloff
    vec3 lin = srgbToLinear(src.rgb) * v;
    finalColor = vec4(linearToSrgb(lin), src.a);
}
`;

export class VignetteFilter extends Filter {
  constructor(amount = 0.5, size = 0.7, softness = 0.35) {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: VIGNETTE_FRAG, name: "lm-vignette" }),
      resources: {
        vigUniforms: {
          uAmount: { value: amount, type: "f32" },
          uSize: { value: size, type: "f32" },
          uSoftness: { value: softness, type: "f32" },
        },
      },
    });
  }
  get u() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.resources.vigUniforms as any).uniforms;
  }
}

/* -------------------------------------------------------------------------- */
/*  Duotone / Tint — map luminance between two colours (a proper gradient map) */
/* -------------------------------------------------------------------------- */

const DUOTONE_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec3 uDark;        // colour for shadows (linear)
uniform vec3 uLight;       // colour for highlights (linear)
uniform float uAmount;     // blend with original

${COLOR_FUNCS}

void main() {
    vec4 src = texture(uTexture, vTextureCoord);
    vec3 lin = srgbToLinear(src.rgb);
    float l = luma(lin);
    // smooth ramp so midtones read nicely
    vec3 mapped = mix(uDark, uLight, smoothstep(0.0, 1.0, l));
    vec3 outLin = mix(lin, mapped, uAmount);
    finalColor = vec4(linearToSrgb(outLin), src.a);
}
`;

function hexToLinear(hex: string): Float32Array {
  const n = Number.parseInt(hex.replace("#", ""), 16) || 0;
  const srgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  // sRGB→linear (matches the shader's srgbToLinear)
  const lin = srgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return new Float32Array(lin);
}

export class DuotoneFilter extends Filter {
  constructor(dark = "#000000", light = "#4f8fcb", amount = 1) {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: DUOTONE_FRAG, name: "lm-duotone" }),
      resources: {
        duoUniforms: {
          uDark: { value: hexToLinear(dark), type: "vec3<f32>" },
          uLight: { value: hexToLinear(light), type: "vec3<f32>" },
          uAmount: { value: amount, type: "f32" },
        },
      },
    });
  }
  setColors(dark: string, light: string) {
    this.u.uDark = hexToLinear(dark);
    this.u.uLight = hexToLinear(light);
  }
  get u() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.resources.duoUniforms as any).uniforms;
  }
}

/* -------------------------------------------------------------------------- */
/*  Filmic color grade — exposure / contrast / saturation + ACES, in linear    */
/* -------------------------------------------------------------------------- */

const GRADE_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uTemperature;  // -1 cool .. +1 warm
uniform int uTonemap;        // 0 none, 1 ACES

${COLOR_FUNCS}

void main() {
    vec4 src = texture(uTexture, vTextureCoord);
    vec3 c = srgbToLinear(src.rgb);
    c *= uExposure;
    // white-balance: push R up / B down for warm
    c.r *= 1.0 + uTemperature * 0.15;
    c.b *= 1.0 - uTemperature * 0.15;
    // contrast around mid-grey (linear ~0.18)
    c = (c - 0.18) * uContrast + 0.18;
    c = max(c, 0.0);
    // saturation
    float l = luma(c);
    c = mix(vec3(l), c, uSaturation);
    if (uTonemap == 1) c = aces(c);
    finalColor = vec4(linearToSrgb(c), src.a);
}
`;

export class FilmGradeFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: GRADE_FRAG, name: "lm-grade" }),
      resources: {
        gradeUniforms: {
          uExposure: { value: 1, type: "f32" },
          uContrast: { value: 1, type: "f32" },
          uSaturation: { value: 1, type: "f32" },
          uTemperature: { value: 0, type: "f32" },
          uTonemap: { value: 1, type: "i32" },
        },
      },
    });
  }
  get u() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.resources.gradeUniforms as any).uniforms;
  }
}
