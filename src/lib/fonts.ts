/**
 * Loft Motion — web font catalog + on-demand loading.
 *
 * A curated set of Google Fonts (the workhorses of modern motion/social design).
 * Loading injects a <link> and waits for document.fonts so PixiJS lays out with
 * the real metrics. Fully client-side; the only network call is the font CSS.
 */
export interface FontDef {
  family: string;
  /** CSS font-family stack with a safe fallback. */
  stack: string;
  weights: number[];
  category: "Sans" | "Serif" | "Display" | "Mono";
}

export const FONTS: FontDef[] = [
  { family: "Inter", stack: "Inter, system-ui, sans-serif", weights: [400, 500, 600, 700, 800], category: "Sans" },
  { family: "Poppins", stack: "Poppins, sans-serif", weights: [400, 500, 600, 700, 800], category: "Sans" },
  { family: "Montserrat", stack: "Montserrat, sans-serif", weights: [400, 600, 700, 800], category: "Sans" },
  { family: "Archivo", stack: "Archivo, sans-serif", weights: [400, 600, 700, 800], category: "Sans" },
  { family: "Space Grotesk", stack: "'Space Grotesk', sans-serif", weights: [400, 500, 700], category: "Sans" },
  { family: "Sora", stack: "Sora, sans-serif", weights: [400, 600, 700, 800], category: "Sans" },
  { family: "DM Sans", stack: "'DM Sans', sans-serif", weights: [400, 500, 700], category: "Sans" },
  { family: "Playfair Display", stack: "'Playfair Display', serif", weights: [400, 600, 700, 800], category: "Serif" },
  { family: "Fraunces", stack: "Fraunces, serif", weights: [400, 600, 700], category: "Serif" },
  { family: "Bebas Neue", stack: "'Bebas Neue', sans-serif", weights: [400], category: "Display" },
  { family: "Anton", stack: "Anton, sans-serif", weights: [400], category: "Display" },
  { family: "Pacifico", stack: "Pacifico, cursive", weights: [400], category: "Display" },
  { family: "Caveat", stack: "Caveat, cursive", weights: [400, 600, 700], category: "Display" },
  { family: "JetBrains Mono", stack: "'JetBrains Mono', monospace", weights: [400, 700], category: "Mono" },
];

const loaded = new Set<string>(["Inter"]);

/** Inject the Google Fonts stylesheet for a family and await its load. */
export async function loadFont(family: string): Promise<void> {
  if (typeof document === "undefined" || loaded.has(family)) return;
  const def = FONTS.find((f) => f.family === family);
  if (!def) return;
  loaded.add(family);
  const id = `gf-${family.replace(/\s+/g, "-")}`;
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    const weights = def.weights.join(";");
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@${weights}&display=swap`;
    document.head.appendChild(link);
  }
  try {
    await Promise.race([
      document.fonts.load(`700 32px "${family}"`),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    await document.fonts.ready;
  } catch {
    /* best effort */
  }
}

export function fontStack(family: string): string {
  return FONTS.find((f) => f.family === family)?.stack ?? family;
}
