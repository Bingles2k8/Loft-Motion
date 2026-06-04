/**
 * Loft Motion — copy-paste code snippets for developers.
 *
 * - Lottie web embed: a ready <lottie-player> tag (inline or external JSON).
 * - React component: a Motion (motion.dev) component scaffold using the CSS
 *   keyframes we already generate, so devs get framework-native output.
 */
import type { SceneDocument } from "@/lib/scene/schema";
import { exportLottie } from "@/lib/export/lottie";
import { exportCss } from "@/lib/export/css";

/** A self-contained HTML snippet that plays the animation with lottie-player. */
export function lottieEmbedSnippet(scene: SceneDocument): string {
  const safe = scene.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "scene";
  return `<!-- Loft Motion — Lottie embed -->
<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>

<lottie-player
  src="./${safe}.lottie.json"
  background="transparent"
  speed="1"
  style="width: ${scene.composition.width}px; height: ${scene.composition.height}px"
  loop
  autoplay
></lottie-player>

<!-- Tip: host ${safe}.lottie.json next to this file, or inline it via the
     'src' as a data URI. Use a dotLottie host (lottiefiles.com) for production. -->`;
}

/** A React component scaffold wrapping the exported CSS @keyframes. */
export function reactSnippet(scene: SceneDocument): string {
  const { css, html } = exportCss(scene);
  const componentName =
    (scene.name.replace(/[^a-z0-9]+/gi, " ").trim().split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join("") ||
      "Animation");
  // Convert the standalone HTML into JSX-ish: class -> className.
  const jsx = html.replace(/class=/g, "className=");
  return `// Loft Motion — React component (CSS keyframes)
import "./${componentName}.css";

export function ${componentName}() {
  return (
    ${jsx.split("\n").join("\n    ")}
  );
}

/* ${componentName}.css */
/*
${css}
*/`;
}

/** Convenience: also re-export the raw lottie JSON producer for the panel. */
export { exportLottie };
