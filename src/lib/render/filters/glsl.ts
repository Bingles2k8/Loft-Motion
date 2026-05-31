/**
 * Loft Motion — shared GLSL snippets for premium effects.
 *
 * Pixi v8 filters use GLSL ES 3.0: `in`/`out`, `texture()`, and a declared
 * `out vec4 finalColor`. Pixi injects `uTexture` (the input) plus the
 * `uInputSize`/`uOutputFrame`/`uOutputTexture` uniforms used by the default
 * vertex shader. These helpers are concatenated into fragment sources.
 */

/** The default Pixi v8 filter vertex shader (matches pixi-filters/defaults). */
export const VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void ) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord( void ) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}
void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

/** sRGB ⇄ linear-light conversion + ACES filmic tonemap (Narkowicz approx). */
export const COLOR_FUNCS = /* glsl */ `
vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
    c = max(c, 0.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 reinhard(vec3 x) { return x / (1.0 + x); }
`;
