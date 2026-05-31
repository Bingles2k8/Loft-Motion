# Loft Motion

A browser-based motion design engine. **Beautiful by default**, fully
client-side, and honest about export targets: it tells you live what survives
when you ship to **MP4**, **Lottie/JSON**, or **CSS**.

> Status: **Phase 1 — the spine.** End-to-end and complete: add a shape, animate
> it with a named easing, scrub it, see a live export-compatibility badge, and
> export an MP4 (plus Lottie and CSS). Rough in places, but whole.

## What makes it different

- **Taste encoded as defaults.** New layers animate nicely out of the box using a
  named easing library (Snappy, Settle, Overshoot, …) — no raw bezier numbers
  needed. The same library drives the renderer *and* every exporter, so a curve
  means the same thing on screen, in an MP4, in Lottie and in CSS.
- **Honesty about export.** A capability engine analyses your scene against each
  target and surfaces, per-layer and pre-export, exactly what exports cleanly,
  what degrades, and what gets dropped. The engine never produces a silently
  broken export.
- **One evaluation path.** The live preview and the MP4 frame exporter share the
  exact same keyframe-evaluation + renderer code, so preview matches output 1:1.

## Architecture (the spine)

Everything hangs off a single serialisable **scene document** (`src/lib/scene`).
The renderer, timeline, exporters and capability engine all read from it.

```
            SCENE DOCUMENT (JSON, Zod-validated)   ← single source of truth
                          │
   ┌──────────────┬───────┴───────┬─────────────────┐
   ▼              ▼               ▼                 ▼
 RENDERER      TIMELINE        EXPORTERS        CAPABILITY
 (PixiJS)      (hybrid)     mp4 / lottie / css    ENGINE
```

| Area | Location | Notes |
|---|---|---|
| Scene schema | `src/lib/scene/schema.ts` | Types + Zod runtime validator. `exportCompatibility` is first-class. |
| Named easings | `src/lib/anim/easing.ts` | Feel → cubic-bezier, with a Newton-Raphson solver. |
| Keyframe eval | `src/lib/anim/evaluate.ts` | The shared, deterministic animation path. |
| Capability engine | `src/lib/capability/` | Pure scene → per-target compatibility reports. |
| Renderer | `src/lib/render/renderer.ts` | Scene → PixiJS scene graph; reusable headlessly for export. |
| Exporters | `src/lib/export/` | MP4 (WebCodecs + mediabunny), Lottie (bodymovin), CSS (@keyframes). |
| Store | `src/lib/store/useStore.ts` | Zustand, immutable updates, undo/redo. |
| UI | `src/components/` | Stage, hybrid Timeline, Properties, Export & Craft panels. |

## Tech stack

Next.js (App Router) + TypeScript · PixiJS (WebGL) · Zustand · Zod · Tailwind v4 ·
WebCodecs + [mediabunny](https://mediabunny.dev) for MP4 muxing. Hosting target:
Vercel. No backend — your work never leaves the device.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

You'll be greeted by a sample animation that shows off named easings, stagger, a
glow effect and a gradient — and demonstrates the warning layer (the glow can't
survive Lottie, and the UI says so).

### Browser support for MP4

MP4 export needs the WebCodecs video encoder: Chrome/Edge/Opera, Firefox 130+,
Safari partial. The app feature-detects and degrades gracefully — Lottie and CSS
export work everywhere. (A wasm fallback for Safari is a later consideration.)

## Roadmap

- **Phase 1 — Spine.** ✅ Scene doc, shared eval, renderer, hybrid timeline,
  capability engine + badges, MP4/Lottie/CSS export, JSON import/export.
- **Phase 2 — Breadth.** SVG import, more effects, a full curve editor, richer
  Lottie/CSS fidelity.
- **Phase 3 — Beauty pass.** Polish, onboarding, the visible principles panel.
- **Phase 4 — Product.** Accounts, saved projects, shared motion tokens.
