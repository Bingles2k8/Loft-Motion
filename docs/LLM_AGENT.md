# Loft Motion for LLMs — the Agent layer

Loft Motion can be driven by a language model. You describe an animation in
words; an LLM writes a small **AnimationSpec** (JSON); Loft Motion compiles it
into a real, beautiful animation and delivers either:

- **a Loft Motion project** (`.loft.json`) the user can open and keep editing, or
- **a rendered video** (MP4 / GIF / WebM) — or a Lottie / CSS / React export.

This document is the map. The authoritative, always-in-sync contract (the system
prompt + full preset vocabulary) is generated from code:

```bash
npm run agent guide      # the LLM authoring guide (hand this to your model)
npm run agent schema     # the AnimationSpec JSON Schema (for tool/function defs)
npm run agent example    # a representative sample spec
```

## The big idea

Loft Motion's single source of truth is a Zod-validated **scene document**
(`src/lib/scene/schema.ts`). Anything that can emit a valid scene can drive the
whole engine. But a scene document is verbose — every layer has eight animatable
channels and explicit keyframe arrays. So we give the LLM a smaller, intent-level
language instead:

```
text prompt  ──►  AnimationSpec (LLM writes this)  ──►  compileSpec()  ──►  SceneDocument  ──►  project / video
```

The compiler (`src/lib/agent/compile.ts`) is pure and browser-free, so the exact
same code runs in the editor, in a CLI, and in an MCP server.

`AnimationSpec` describes **intent** with named presets — `enter: "fade-up"`,
`emphasis: "float"`, `effects: "glow"`, `at: "title"` — and the compiler supplies
the tasteful keyframes, staggers and easings. The model never writes a bezier.

## Three ways to drive it

### 1. MCP server (recommended for chat agents)

A zero-dependency [Model Context Protocol](https://modelcontextprotocol.io)
server over stdio. Point any MCP client at it:

```jsonc
// e.g. Claude Desktop — claude_desktop_config.json
{
  "mcpServers": {
    "loft-motion": {
      "command": "node",
      "args": ["/abs/path/to/Loft-Motion/mcp-server/loft-motion-mcp.mjs"]
    }
  }
}
```

Tools exposed:

| Tool | Purpose |
|---|---|
| `get_guide` | The authoring guide — read first. |
| `get_spec_schema` | JSON Schema an AnimationSpec must satisfy. |
| `get_example_spec` | A sample spec to adapt. |
| `describe_vocabulary` | Every preset name the spec accepts. |
| `create_project` | Compile a spec → a `.loft.json` project (optionally written to disk). Returns validation errors to self-correct on. |

Run it directly to try it: `npm run mcp`.

### 2. CLI (headless project generation)

```bash
npm run agent example > spec.json
npm run agent build spec.json -o teaser.loft.json
# …or pipe a spec straight in:
echo '{"elements":[{"type":"text","text":"Hello","enter":"pop"}]}' | npm run agent build
```

`build` validates and compiles a spec into a project. Invalid specs print
path-pointed errors (e.g. `elements.0.text: expected string`) and exit non-zero,
so a model can read the message and retry.

> Both the CLI and the MCP server run the project's real TypeScript via
> `scripts/loft-loader.mjs` (a tiny Node resolve hook + native type-stripping) —
> no build step and no extra dependencies.

### 3. In the browser app

The engine renders and encodes video in the browser (PixiJS + WebCodecs), so a
**video** is produced there, not in Node. Two ways to reach it:

**a) URL ingestion + auto-export.** Open the app with the spec encoded in the URL
and ask it to render:

```
https://your-host/?spec=<json|uri|base64>&export=mp4&download=1
# also accepts: project=<…>, export=gif|webm|lottie|css|sprite|react|project, autoplay=1
# put big payloads in the URL hash (#spec=…) to keep them out of server logs.
```

An automation agent (computer-use / Playwright) just navigates there; the MP4
downloads itself.

**b) `window.LoftAgent`.** A programmatic surface on the page:

```js
LoftAgent.guide                       // the authoring guide (string)
LoftAgent.schema()                    // AnimationSpec JSON Schema
LoftAgent.example()                   // a sample spec
LoftAgent.load(spec)                  // compile a spec → live scene  → { ok, notes }
LoftAgent.loadProject(loftJson)       // load a .loft.json → live scene
await LoftAgent.exportVideo("mp4")    // render + download a video
await LoftAgent.export("lottie")      // any format: mp4|gif|webm|sprite|lottie|css|react|project
await LoftAgent.saveProject()         // download the .loft.json
LoftAgent.getScene()                  // the current scene document
```

There's also a **Prompt** button in the app's toolbar: paste a spec and *Build*
it onto the stage, then export.

## AnimationSpec at a glance

```jsonc
{
  "title": "Launch Teaser",
  "size": "1080p",                 // preset or { "width": 1920, "height": 1080 }
  "fps": 30,
  "duration": 6,                   // optional — inferred from elements if omitted
  "background": "#0b0d12",         // hex, or "transparent"
  "palette": ["#4f8fcb", "#58c8d6"],
  "stagger": 0.14,                 // cascade auto-started elements
  "elements": [
    {
      "type": "shape", "shape": "circle", "size": 360, "at": "center",
      "color": "#1b2a4a", "gradientTo": "#4f8fcb",
      "enter": "zoom", "effects": "soft-glow", "emphasis": { "type": "pulse", "strength": 0.8 }
    },
    { "type": "text", "text": "Ship it.", "at": "title", "fontSize": 180, "weight": 800, "enter": "rise", "effects": "glow" },
    { "type": "text", "text": "Animation, from a sentence.", "at": "subtitle", "fontSize": 56, "enter": "fade-up", "exit": "fade" }
  ]
}
```

Run `npm run agent guide` for the full field reference and every preset name
(placements, entrances, exits, emphasis, effects, easings, sizes). The guide is
generated from the spec definitions, so it always matches the compiler.

## Delivering: project vs. video — how to choose

- The user wants to **edit / iterate / hand off a source file** → deliver the
  **project** (`create_project`, the CLI, `?export=project`, or `saveProject()`).
- The user wants a **file to post or embed** → deliver a **video** (browser:
  `?export=mp4&download=1` or `LoftAgent.exportVideo()`), or a **Lottie/CSS**
  export for the web. Note that shader effects like `glow` only survive MP4 —
  the engine reports exactly what degrades per target.
