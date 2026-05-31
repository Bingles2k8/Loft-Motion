/**
 * Loft Motion — CSS / code exporter.
 *
 * Emits `@keyframes` + transforms. Each animatable channel becomes its own
 * nested wrapper element with its own keyframes and PER-SEGMENT easing
 * (`animation-timing-function` inside the keyframe block), so named easings map
 * faithfully to `cubic-bezier()`. Anything CSS can't represent is reported by
 * the capability engine and noted in a header comment.
 *
 * Returns a self-contained HTML document the user can paste into a file and open.
 */
import { bezierToCss } from "@/lib/anim/easing";
import { isAnimated, keyframeBezier } from "@/lib/anim/evaluate";
import { analyzeScene } from "@/lib/capability/engine";
import { flattenPalette, type Animatable, type Layer, type SceneDocument } from "@/lib/scene/schema";

interface Emit {
  rules: string[]; // @keyframes blocks
  animations: string[]; // animation shorthands for this element
}

let kfCounter = 0;

/** Build a @keyframes rule for one channel plus its animation shorthand. */
function channelAnimation(
  channel: Animatable,
  duration: number,
  decl: (v: number) => string,
): Emit {
  const out: Emit = { rules: [], animations: [] };
  if (!isAnimated(channel)) return out;

  const name = `lm_${(kfCounter++).toString(36)}`;
  const kfs = channel.keyframes;
  const stops: string[] = [];

  // Hold the first value from 0% if the first keyframe starts late.
  if (kfs[0].time > 0) {
    stops.push(`  0% { ${decl(kfs[0].value)}; animation-timing-function: linear; }`);
  }
  kfs.forEach((k, i) => {
    const pct = clamp((k.time / duration) * 100, 0, 100);
    const easing = i < kfs.length - 1 ? bezierToCss(keyframeBezier(k)) : null;
    const timing = easing ? ` animation-timing-function: ${easing};` : "";
    stops.push(`  ${round(pct)}% { ${decl(k.value)};${timing} }`);
  });
  // Hold the last value to 100% if needed.
  const last = kfs[kfs.length - 1];
  if (last.time < duration) {
    stops.push(`  100% { ${decl(last.value)}; }`);
  }

  out.rules.push(`@keyframes ${name} {\n${stops.join("\n")}\n}`);
  out.animations.push(`${name} ${round(duration)}s linear infinite both`);
  return out;
}

function staticDecl(channel: Animatable, decl: (v: number) => string): string {
  return decl(channel.value);
}

function layerCss(layer: Layer, scene: SceneDocument): { html: string; css: string } {
  const dur = scene.composition.duration;
  const t = layer.transform;
  const id = layer.id;

  // Per-channel animations.
  const xA = channelAnimation(t.x, dur, (v) => `transform: translateX(${round(v)}px)`);
  const yA = channelAnimation(t.y, dur, (v) => `transform: translateY(${round(v)}px)`);
  const opA = channelAnimation(t.opacity, dur, (v) => `opacity: ${round(v / 100, 3)}`);
  const rotA = channelAnimation(t.rotation, dur, (v) => `transform: rotate(${round(v)}deg)`);
  const sxA = channelAnimation(t.scaleX, dur, (v) => `transform: scaleX(${round(v / 100, 3)})`);
  const syA = channelAnimation(t.scaleY, dur, (v) => `transform: scaleY(${round(v / 100, 3)})`);

  const rules = [
    ...xA.rules,
    ...yA.rules,
    ...opA.rules,
    ...rotA.rules,
    ...sxA.rules,
    ...syA.rules,
  ];

  // Static fallbacks for channels that aren't animated.
  const staticTransformX = isAnimated(t.x) ? "" : `translateX(${round(t.x.value)}px)`;
  const staticTransformY = isAnimated(t.y) ? "" : `translateY(${round(t.y.value)}px)`;

  // Visual element styling.
  const visual = visualStyle(layer);

  // Nested wrappers (outer→inner): x, y, opacity, rotate, scaleX, scaleY, visual.
  const css = [
    `/* ${layer.name} */`,
    `#${id}-x{position:absolute;left:0;top:0;${staticTransformX ? `transform:${staticTransformX};` : ""}${anim(xA)}}`,
    `#${id}-y{${staticTransformY ? `transform:${staticTransformY};` : ""}${anim(yA)}}`,
    `#${id}-op{${isAnimated(t.opacity) ? "" : `opacity:${round(t.opacity.value / 100, 3)};`}${anim(opA)}}`,
    `#${id}-rot{transform-origin:center;${isAnimated(t.rotation) ? "" : `transform:rotate(${round(t.rotation.value)}deg);`}${anim(rotA)}}`,
    `#${id}-sx{transform-origin:center;${isAnimated(t.scaleX) ? "" : `transform:scaleX(${round(t.scaleX.value / 100, 3)});`}${anim(sxA)}}`,
    `#${id}-sy{transform-origin:center;${isAnimated(t.scaleY) ? "" : `transform:scaleY(${round(t.scaleY.value / 100, 3)});`}${anim(syA)}}`,
    `#${id}-v{${visual.css}}`,
    ...rules,
  ].join("\n");

  const html =
    `<div id="${id}-x"><div id="${id}-y"><div id="${id}-op">` +
    `<div id="${id}-rot"><div id="${id}-sx"><div id="${id}-sy">` +
    `<div id="${id}-v">${visual.inner}</div>` +
    `</div></div></div></div></div></div>`;

  void staticDecl; // (kept for symmetry/extension)
  return { html, css };
}

function anim(e: Emit): string {
  return e.animations.length ? `animation:${e.animations.join(",")};` : "";
}

function visualStyle(layer: Layer): { css: string; inner: string } {
  // Center the visual on its wrapper origin (assumes anchor ≈ centre).
  const base = "position:absolute;transform:translate(-50%,-50%);";
  if (layer.type === "shape" && layer.shape) {
    const s = layer.shape;
    const fill = s.fill.gradient
      ? `background:linear-gradient(${s.fill.gradient.angle}deg, ${s.fill.color}, ${s.fill.gradient.to});`
      : `background:${s.fill.color};`;
    const radius =
      s.kind === "ellipse"
        ? "border-radius:50%;"
        : s.cornerRadius
          ? `border-radius:${s.cornerRadius}px;`
          : "";
    const border = s.stroke ? `border:${s.stroke.width}px solid ${s.stroke.color};` : "";
    return {
      css: `${base}width:${s.width}px;height:${s.height}px;${fill}${radius}${border}`,
      inner: "",
    };
  }
  if (layer.type === "text" && layer.text) {
    const tx = layer.text;
    return {
      css:
        `${base}color:${tx.fill};font-family:${tx.fontFamily};font-size:${tx.fontSize}px;` +
        `font-weight:${tx.fontWeight};text-align:${tx.align};letter-spacing:${tx.letterSpacing}px;white-space:nowrap;`,
      inner: escapeHtml(tx.content),
    };
  }
  if (layer.type === "image" && layer.image) {
    return {
      css: `${base}`,
      inner: `<img src="${layer.image.src}" width="${layer.image.naturalWidth}" height="${layer.image.naturalHeight}" alt=""/>`,
    };
  }
  return { css: base, inner: "" };
}

export interface CssExport {
  html: string;
  css: string;
  /** Full standalone HTML document. */
  document: string;
}

export function exportCss(rawScene: SceneDocument): CssExport {
  const scene = flattenPalette(rawScene);
  kfCounter = 0;
  const report = analyzeScene(scene).css;
  const warnings = report.issues
    .map((i) => ` *   - ${i.layerName}: ${i.label} — ${i.note ?? i.level}`)
    .join("\n");

  const layerOut = scene.layers.map((l) => layerCss(l, scene));
  const body = layerOut.map((l) => l.html).join("\n");
  const rules = layerOut.map((l) => l.css).join("\n\n");

  const comp = scene.composition;
  const header =
    `/* Exported from Loft Motion — "${scene.name}"\n` +
    ` * ${comp.width}×${comp.height} @ ${comp.fps}fps, ${comp.duration}s\n` +
    (warnings
      ? ` *\n * Export notes (CSS can't fully represent these):\n${warnings}\n`
      : "") +
    ` */`;

  const css = `${header}
.lm-stage{position:relative;width:${comp.width}px;height:${comp.height}px;background:${comp.background};overflow:hidden}
.lm-stage>div{position:absolute;left:0;top:0}
${rules}`;

  const html = `<div class="lm-stage">\n${body}\n</div>`;

  const document = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(scene.name)} — Loft Motion</title>
<style>
body{margin:0;display:grid;place-items:center;min-height:100vh;background:#111}
${css}
</style>
</head>
<body>
${html}
</body>
</html>`;

  return { html, css, document };
}

/* helpers */
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function round(v: number, p = 2) {
  const f = 10 ** p;
  return Math.round(v * f) / f;
}
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
