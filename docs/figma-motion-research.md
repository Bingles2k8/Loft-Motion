# Figma Motion — Research Brief & Redesign Reference

> Purpose: capture how Figma approaches motion/animation (features, UI, look, templates)
> so Loft Motion can be redesigned to closely resemble it. Compiled June 2026.

## 0. The key insight

There are **two** things people mean by "Figma motion":

1. **Figma Motion** — a brand-new native **timeline + keyframe animation tool** announced
   at **Config 2026 (June 24, 2026)**, currently in **open beta**. This is an
   After-Effects-style motion editor inside Figma Design.
2. **Prototyping + Smart Animate** — the older frame-to-frame *interaction* model
   (triggers → actions → transitions) that has existed for years.

**Implication for Loft Motion:** Loft is already modeled on After Effects (dark theme,
timeline + graph editor spine, MP4/Lottie/CSS export). Figma Motion is converging on
exactly that paradigm. So "make Loft more like Figma" is **~80% visual/ergonomic** and
**~20% feature additions** — the engine already exists.

---

## 1. Figma Motion (the new timeline tool) — closest reference

**Activation & model**
- Toggle the bottom toolbar from **Design → Motion mode**; a **timeline appears across
  the bottom of the canvas**.
- The selected frame/component is the animation subject.

**Keyframing**
- Animatable properties: **position, scale, rotation, opacity** (independent per property).
- **Manual keyframes:** move playhead → "Add keyframe" next to a property.
- **Auto-keyframe:** toggle on; changes made while scrubbing are recorded automatically.
- Drag keyframes/layers to retime; scrub to preview any moment.

**Preset animations**
- Built-in styles: **Fade, Move, Scale, Rotate, Resize**.
- A preset drops onto the timeline at the playhead as a **draggable block** with
  **duration handles** (drag to move in time, drag handles to resize duration).
- **Stack** presets to play simultaneously, or **drag to sequence** them.

**Easing**
- Presets: **Ease in, Ease out, Ease in-and-out**, plus **Custom Bézier**.
- Custom = a Bézier curve graph with draggable handles, or type `cubic-bezier(x1,y1,x2,y2)`.

**Export (native — no plugin)**
- **MP4, GIF, WebM, Animated SVG** directly from Motion files.
- **Dev Mode handoff:** read-only timeline at full fidelity; **copy animation code as
  CSS, JSON, or React / motion.dev**.

**Design-system + AI**
- Animate a component once → motion travels across files (motion as a design-system primitive).
- **Figma agent** builds motion on the timeline from a prompt (mirrors Loft's AgentBridge).

**Plans (open beta):** Starter = limited exports; Full seat = primitives + export;
publishing animated components / AI motion / hi-res video = paid Full seat.

---

## 2. Prototyping + Smart Animate (the interaction model)

- **Smart Animate** auto-tweens matching (same-name) layers between frames —
  interpolates position, size, rotation, opacity, fill color.
- **Triggers:** On Click/Tap, On Drag (L/R/U/D), While Hovering, While Pressing,
  Mouse Enter/Leave/Up/Down, After Delay, Key/Gamepad.
- **Actions:** Navigate to, Open/Swap/Close overlay, Back, Scroll to, Set variable,
  Conditional, Open link.
- **Transitions:** Instant, Dissolve, Move/Push/Slide in-out, Smart Animate — each with
  easing (linear/ease/custom bezier) **and Spring curves**.
- **Spring presets: Gentle, Quick, Bouncy, Slow**, tunable via **Stiffness, Damping,
  Mass** with a live animated graph.
- **Variables + conditionals + expressions:** store state in variables, modify with
  **Set variable**, branch with **Conditional (if/else)**, compute with **expressions**.
- **Scroll/overflow:** per-frame overflow (V/H/both/none); per-object **Scroll / Fixed /
  Sticky**; **preserve scroll position** across transitions.

---

## 3. Export landscape

- Native Figma Design export = static only (PNG/JPG/SVG/PDF).
- Motion/video historically required **plugins**: LottieFiles (dotLottie/JSON/GIF/MP4/
  WebM/MOV), Protonix, Export Prototype to GIF/Video, Lottielab (4K MP4), Magic Animator (AI).
- **Figma Motion now makes MP4/GIF/WebM/SVG native.** Loft already exports
  MP4/Lottie/CSS/GIF/WebM/Sprite/React — ahead here.

---

## 4. Templates & presets

- **Figma Community** is the template engine — free starter files like *Figma Animation
  Examples* (pull-to-refresh, swipe actions, loading screens, mobile menus, page
  transitions, sliding tabs) and *Free Animations for Design/Prototype*.
- Motion presets are increasingly **governed design-system primitives** (shared easing
  curves, animation presets, brand assets).
- **For Loft:** expand `examples.ts` into a *browsable, categorized gallery*
  (Loading, Transitions, Micro-interactions, Text, Logo).

---

## 5. The look & UI ("UI3", shipped to everyone Oct 2024)

### Layout
```
┌───────────────────────────────────────────────────────────┐
│  (menu / file name — minimal top bar)                      │
├──────────────┬─────────────────────────────┬──────────────┤
│ LEFT SIDEBAR │                             │ RIGHT SIDEBAR│
│  • File/Pages│         CANVAS              │ [Design][Proto]
│  • Layers    │      (work front & center)  │  ▸ properties│
│  • Assets    │                             │              │
├──────────────┴─────────────────────────────┴──────────────┤
│         ⌗ slim floating TOOLBAR (bottom-center)            │
│   ── Motion mode: TIMELINE at bottom ──                    │
└───────────────────────────────────────────────────────────┘
```

- **Left sidebar:** Pages + Layers tree, Assets.
- **Right sidebar = properties panel with two tabs: `Design` and `Prototype`**
  (toggle **Shift+E**).
- **Bottom toolbar:** slim, **floating, bottom-center**. Hosts the **Design ⇄ Motion**
  toggle. Signature UI3 element.
- **Interactions** added by dragging the blue **"+"** node to a destination → opens the
  **Interaction Details modal** (trigger + action + animation + easing).

### Visual design language (UI3)
- **Rounded corners** throughout; **backgrounds on inputs**; **borders around dropdowns**.
- **200 expressive, hand-drawn icons** (softer than typical engineering icon sets).
- **Resizable, fixed panels** (Figma tried floating "marshmallow" panels, reverted to
  fixed after negative feedback → **don't float the panels**).
- **Default theme is LIGHT** — white/light-gray chrome; the canvas is the brightest focal
  element. Dark mode exists but light is the default identity.
- Single restrained **blue accent** for selection/interaction nodes; neutral grays,
  lots of whitespace.

> Biggest visual gap vs Loft: Loft is dark/dense/AE-Spectrum (`--color-ink-900: #1b1b1b`,
> steel-blue accent). Figma is light/airy/rounded/friendly.

---

## 6. Keyboard shortcuts (prototyping/motion)

| Action | Shortcut |
|---|---|
| Toggle Design ⇄ Prototype tab | Shift + E |
| Present prototype | ⌘⌥↵ / Ctrl+Alt+Enter |
| Inline preview | Shift + Space |
| Next frame (in play) | → / Space / N |
| Previous frame | ← |
| Restart flow | R |
| Cycle scale options (present) | Z |

Other surfaces: **Figma Slides** has per-object slide animations; **Figma Sites** uses the
Interactions panel (Hover/Press effects) powered by Motion; **FigJam** is lighter. Config
2026 also shipped code layers, shader fills/effects, and an upgraded agent alongside Motion.

---

## 7. Loft Motion gap analysis → concrete redesign moves

| Figma pattern | Loft today | Move |
|---|---|---|
| Light, rounded, airy UI3 chrome | Dark AE/Spectrum theme | Light **default** theme; round corners; input backgrounds + dropdown borders; whitespace |
| Slim floating bottom toolbar + Design⇄Motion toggle | Top toolbar, always-on timeline | Bottom-center floating bar; gate timeline behind **Motion mode** |
| Right sidebar Design/Prototype tabs | Single PropertiesPanel | Tabbed right panel |
| Preset animation blocks (stack/sequence) | Keyframes + behaviors | Draggable preset blocks with duration handles |
| Auto-keyframe toggle | `autoKeyframe` exists in store | Surface in timeline UI |
| Spring presets (Gentle/Quick/Bouncy/Slow + stiffness/damping/mass) | Named bezier easings | Add spring physics family + live graph |
| Interaction Details modal | Behaviors panel | Optional interactions model |
| Dev Mode copy CSS/JSON/React | Export panel | Surface "copy code" inline |
| Browsable community template gallery | 6 examples | Categorized gallery |
| 200 friendly hand-drawn icons | icons.tsx | Soften/round icon set |

**Bottom line:** Loft already has Figma Motion's engine (timeline, keyframes, easing,
multi-format export, AI generation). The redesign is mostly visual/ergonomic, plus a few
feature additions (preset-block timeline model, springs, interactions, template gallery).

---

## Sources

- [Introducing Figma Motion (blog)](https://www.figma.com/blog/introducing-figma-motion/)
- [Explore Figma Motion (help)](https://help.figma.com/hc/en-us/articles/41274629073303-Explore-Figma-Motion)
- [Use the Figma Motion timeline](https://help.figma.com/hc/en-us/articles/41405906446999-Use-the-Figma-Motion-timeline)
- [Add, select, delete keyframes](https://help.figma.com/hc/en-us/articles/41307938657559-Add-select-and-delete-keyframes)
- [Quickly add motion with preset animations](https://help.figma.com/hc/en-us/articles/41307886266135-Quickly-add-motion-with-preset-animations)
- [Adjust an animation's easing](https://help.figma.com/hc/en-us/articles/41414048690839-Adjust-an-animation-s-easing)
- [Smart animate layers between frames](https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames)
- [Prototype easing and spring animations](https://help.figma.com/hc/en-us/articles/360051748654-Prototype-easing-and-spring-animations)
- [Prototype triggers](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers)
- [Use variables in prototypes](https://help.figma.com/hc/en-us/articles/14506587589399-Use-variables-in-prototypes)
- [Multiple actions and conditionals](https://help.figma.com/hc/en-us/articles/15253220891799-Multiple-actions-and-conditionals)
- [Prototype scroll and overflow behavior](https://help.figma.com/hc/en-us/articles/360039818734-Prototype-scroll-and-overflow-behavior)
- [Design/prototype in the right sidebar](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar)
- [View layers and pages in the left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-left-sidebar)
- [Our approach to designing UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/)
- [Behind our redesign (UI3)](https://www.figma.com/blog/behind-our-redesign-ui3/)
- [Config 2026 recap](https://www.figma.com/blog/config-2026-recap/)
- [Play your prototypes](https://help.figma.com/hc/en-us/articles/360040318013-Play-your-prototypes)
- [LottieFiles for Figma](https://lottiefiles.com/plugins/figma)
