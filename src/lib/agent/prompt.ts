/**
 * Loft Motion — Agent contract: the system-prompt guide + JSON Schema.
 *
 * Everything an LLM needs to author a valid {@link AnimationSpec} from a text
 * prompt, plus a machine-readable JSON Schema for tool/function definitions.
 * The vocabularies are pulled straight from the spec constants so the guide can
 * never drift from what the compiler actually accepts.
 */
import { z } from "zod";
import {
  zAnimationSpec,
  SIZE_PRESETS,
  POSITION_PRESETS,
  ENTER_PRESETS,
  EXIT_PRESETS,
  EMPHASIS_PRESETS,
  EFFECT_PRESETS,
  type AnimationSpec,
} from "@/lib/agent/spec";
import { EASING_NAMES } from "@/lib/anim/easing";

/** JSON Schema (draft 2020-12) for the AnimationSpec — use it in tool defs. */
export function specJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(zAnimationSpec, { io: "input" }) as Record<string, unknown>;
}

const list = (a: readonly string[]) => a.join(", ");

/**
 * The authoring guide. Hand this to a model as a system prompt (or include it in
 * a tool description). It is intentionally self-contained.
 */
export const LOFT_AGENT_GUIDE = `# Loft Motion — Animation authoring guide for LLMs

You are driving **Loft Motion**, a motion-design engine. You turn a user's text
prompt into an **AnimationSpec** — a small JSON document describing what should
appear and how it should move. Loft Motion compiles your spec into a real,
beautiful animation and can deliver it two ways:

1. **A Loft Motion project** (\`.loft.json\`) the user can open and keep editing.
2. **A rendered video** (MP4 / GIF / WebM) or vector/code export (Lottie / CSS).

Pick the deliverable from the user's request: if they want something to *edit*,
return the project; if they want a *file to share*, render a video.

## How to respond
Emit a single JSON object that validates against the AnimationSpec schema. Do not
include keyframes or bezier numbers — describe **intent** with the named presets
below and the engine adds tasteful keyframes, staggers and easings for you.

## AnimationSpec shape
\`\`\`jsonc
{
  "title": "string",                 // project name
  "size": "1080p",                   // preset or { "width": 1920, "height": 1080 }
  "fps": 30,                          // optional, default 30
  "duration": 6,                     // optional seconds; inferred if omitted
  "background": "#0e0f13",           // hex, or "transparent"
  "palette": ["#4f8fcb", "#58c8d6"], // optional handy swatches
  "stagger": 0.15,                   // optional: cascade auto-started elements
  "elements": [ /* see below */ ]
}
\`\`\`

### Elements (drawn back-to-front; index 0 is the bottom layer)
Common fields on every element:
- \`type\`: "text" | "shape"
- \`name\`: timeline label (optional)
- \`at\`: placement — a preset (${list(POSITION_PRESETS)}) or \`{ "x": px, "y": px }\`
- \`start\`: seconds before it appears (default 0; omit to let \`stagger\` space it)
- \`duration\`: seconds on screen (default: until the end)
- \`enter\`: entrance — ${list(ENTER_PRESETS)} (or \`{ "type", "duration", "easing" }\`)
- \`exit\`: exit — ${list(EXIT_PRESETS)}
- \`emphasis\`: continuous life — ${list(EMPHASIS_PRESETS)} (string, object, or array)
- \`effects\`: ${list(EFFECT_PRESETS)} (string, object, or array)
- \`scale\` (percent), \`rotation\` (deg), \`opacity\` (0–100), \`blend\`

**text** elements add: \`text\` (required), \`fontSize\`, \`color\`, \`weight\`
(100–900), \`align\` (left/center/right), \`font\`, \`letterSpacing\`, \`kinetic\`
(none/fade-up/fade-in/scale-in/typewriter/wave — animates per character).

**shape** elements add: \`shape\` (rect/ellipse/circle/polygon/star/line), \`size\`
or \`width\`/\`height\`, \`color\`, \`gradientTo\` (+ \`gradientAngle\`),
\`cornerRadius\`, \`points\` (polygon/star), \`stroke\` \`{ color, width }\`,
\`drawOn\` (animate a stroke drawing itself on).

### Easing names (only if you override): ${list(EASING_NAMES)}
### Size presets: ${list(Object.keys(SIZE_PRESETS))}

## Taste tips
- Default entrances are already good: text fades up, shapes pop. Override only
  with intent.
- Use \`stagger\` (0.08–0.2s) to make groups feel choreographed.
- \`glow\`/\`soft-glow\` shine on titles and neon shapes (MP4 only — they don't
  survive Lottie/CSS; the engine will tell the user).
- Keep it legible: a hero title, a supporting subtitle, a few accent shapes.

## Example
\`\`\`json
${JSON.stringify(exampleSpec(), null, 2)}
\`\`\`

Return only the JSON spec unless the user asks you to explain it.`;

/** A compact, representative spec used in the guide and as a CLI/MCP sample. */
export function exampleSpec(): AnimationSpec {
  return {
    title: "Launch Teaser",
    size: "1080p",
    fps: 30,
    background: "#0b0d12",
    palette: ["#4f8fcb", "#58c8d6", "#f4f4f5"],
    stagger: 0.14,
    elements: [
      {
        type: "shape",
        name: "Glow orb",
        shape: "circle",
        size: 360,
        at: "center",
        color: "#1b2a4a",
        gradientTo: "#4f8fcb",
        effects: "soft-glow",
        emphasis: { type: "pulse", strength: 0.8 },
        enter: "zoom",
      },
      {
        type: "text",
        name: "Title",
        text: "Ship it.",
        at: "title",
        fontSize: 180,
        weight: 800,
        color: "#f4f4f5",
        enter: "rise",
        effects: "glow",
      },
      {
        type: "text",
        name: "Subtitle",
        text: "Animation, from a sentence.",
        at: "subtitle",
        fontSize: 56,
        weight: 500,
        color: "#9fb4cc",
        enter: "fade-up",
        exit: "fade",
      },
    ],
  };
}
