"use client";

import { useStore, type KfRef } from "@/lib/store/useStore";
import { evalAnimatable, isAnimated, keyframeBezier } from "@/lib/anim/evaluate";
import { EASINGS, EASING_NAMES } from "@/lib/anim/easing";
import { QUICK_CURVES } from "@/lib/anim/curve";
import { analyzeScene } from "@/lib/capability/engine";
import {
  TRANSFORM_CHANNELS,
  effectChannels,
  getChannel,
  type ChannelDef,
} from "@/lib/scene/paths";
import { createEffect, kf as makeKf } from "@/lib/scene/factory";
import { EFFECT_LIST, effectDef } from "@/lib/effects/catalog";
import {
  BLEND_MODES,
  EXPORT_TARGETS,
  SHAPE_KINDS,
  TEXT_ALIGN,
  type EffectType,
  type Keyframe,
  type Layer,
  type SceneDocument,
  type ShapeKind,
} from "@/lib/scene/schema";
import { LEVEL_META, TARGET_LABEL } from "@/components/ui/compat";
import {
  ColorInput,
  Label,
  NumberInput,
  Row,
  Section,
  Select,
  TextInput,
} from "@/components/panels/fields";
import { IconKey, IconPlus, IconTrash } from "@/components/ui/icons";

type TextAlign = (typeof TEXT_ALIGN)[number];

export function PropertiesPanel() {
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const selectedKeys = useStore((s) => s.selectedKeys);
  const scene = useStore((s) => s.scene);
  const layer = scene.layers.find((l) => l.id === selectedLayerId) ?? null;

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-ink-700 bg-ink-850">
      {selectedKeys.length > 0 && <KeyframeEditor />}
      {layer ? <LayerProperties layer={layer} /> : <CompositionProperties />}
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Keyframe / easing editor — works on the whole current selection            */
/* -------------------------------------------------------------------------- */

function resolveKey(scene: SceneDocument, ref: KfRef): Keyframe | null {
  const layer = scene.layers.find((l) => l.id === ref.layerId);
  if (!layer) return null;
  const ch = getChannel(layer, ref.channelPath);
  return ch?.keyframes.find((k) => k.id === ref.kfId) ?? null;
}

function KeyframeEditor() {
  const scene = useStore((s) => s.scene);
  const selectedKeys = useStore((s) => s.selectedKeys);
  const updateKeyframe = useStore((s) => s.updateKeyframe);
  const setEasingForSelection = useStore((s) => s.setEasingForSelection);
  const setBezierForSelection = useStore((s) => s.setBezierForSelection);
  const deleteSelection = useStore((s) => s.deleteSelection);
  const beginChange = useStore((s) => s.beginChange);

  const refs = selectedKeys;
  const single = refs.length === 1 ? resolveKey(scene, refs[0]) : null;
  const multi = refs.length > 1;

  // Determine a representative easing label for the selection.
  const keys = refs.map((r) => resolveKey(scene, r)).filter(Boolean) as Keyframe[];
  const allCustom = keys.length > 0 && keys.every((k) => k.bezier);
  const sameEasing =
    keys.length > 0 && keys.every((k) => !k.bezier && k.easing === keys[0].easing)
      ? keys[0].easing
      : "";
  const easingDef = sameEasing ? EASINGS[sameEasing as keyof typeof EASINGS] : null;

  return (
    <Section
      title={multi ? `${refs.length} keyframes` : "Keyframe"}
      right={
        <button
          onClick={deleteSelection}
          className="text-haze-400 transition hover:text-rose-300"
          title="Delete selected keyframe(s)"
        >
          <IconTrash width={14} height={14} />
        </button>
      }
    >
      {single && (
        <>
          <Row>
            <Label>Value</Label>
            <NumberInput
              value={single.value}
              onCommitStart={beginChange}
              onChange={(v, live) =>
                updateKeyframe(refs[0].layerId, refs[0].channelPath, refs[0].kfId, { value: v }, live)
              }
            />
          </Row>
          <Row>
            <Label>Time</Label>
            <NumberInput
              value={single.time}
              step={0.05}
              min={0}
              suffix="s"
              onCommitStart={beginChange}
              onChange={(v, live) =>
                updateKeyframe(refs[0].layerId, refs[0].channelPath, refs[0].kfId, { time: v }, live)
              }
            />
          </Row>
        </>
      )}

      <Row>
        <Label>Easing</Label>
        <Select
          value={allCustom ? "__custom__" : sameEasing}
          onChange={(v) => v && v !== "__custom__" && setEasingForSelection(v)}
          options={[
            ...(allCustom || !sameEasing
              ? [{ value: allCustom ? "__custom__" : "", label: allCustom ? "Custom curve" : "Mixed" }]
              : []),
            ...EASING_NAMES.map((n) => ({ value: n, label: EASINGS[n].label })),
          ]}
        />
      </Row>

      {/* Quick curve presets (also reachable in the graph editor). */}
      <div className="flex flex-wrap gap-1">
        {QUICK_CURVES.map((c) => (
          <button
            key={c.label}
            onClick={() => setBezierForSelection(c.bezier)}
            className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-haze-300 transition hover:bg-ink-600 hover:text-haze-200"
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Curve preview of the (single/representative) keyframe. */}
      {single && (
        <div className="flex items-center gap-2 pt-1">
          <CurveThumb bezier={keyframeBezier(single)} />
          <p className="text-[11px] leading-snug text-haze-500">
            {single.bezier
              ? "Custom curve — reshape it in the Graph editor."
              : easingDef?.blurb}
          </p>
        </div>
      )}
      {multi && (
        <p className="text-[11px] leading-relaxed text-haze-500">
          Set an easing or quick curve to apply it to all {refs.length} selected
          keyframes. Drag to marquee-select more in the timeline.
        </p>
      )}
    </Section>
  );
}

function CurveThumb({ bezier }: { bezier: [number, number, number, number] }) {
  const [x1, y1, x2, y2] = bezier;
  const W = 44;
  const H = 44;
  const pad = 6;
  const sx = (x: number) => pad + x * (W - 2 * pad);
  const sy = (y: number) => H - pad - y * (H - 2 * pad);
  return (
    <svg width={W} height={H} className="shrink-0 rounded bg-ink-900 ring-1 ring-ink-700">
      <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(0)} stroke="#2b2b2b" />
      <line x1={sx(0)} y1={sy(1)} x2={sx(1)} y2={sy(1)} stroke="#2b2b2b" />
      <path
        d={`M ${sx(0)} ${sy(0)} C ${sx(x1)} ${sy(y1)}, ${sx(x2)} ${sy(y2)}, ${sx(1)} ${sy(1)}`}
        fill="none"
        stroke="#4f8fcb"
        strokeWidth={1.5}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

function ChannelField({ layer, channel }: { layer: Layer; channel: ChannelDef }) {
  const time = useStore((s) => s.time);
  const updateLayer = useStore((s) => s.updateLayer);
  const addKeyframe = useStore((s) => s.addKeyframe);
  const removeKeyframe = useStore((s) => s.removeKeyframe);
  const updateKeyframe = useStore((s) => s.updateKeyframe);
  const beginChange = useStore((s) => s.beginChange);

  const ch = getChannel(layer, channel.path);
  if (!ch) return null;

  const animated = isAnimated(ch);
  const value = evalAnimatable(ch, time);
  const keyAtTime = ch.keyframes.find((k) => Math.abs(k.time - time) < 1e-3);

  const onChange = (v: number, live: boolean) => {
    if (ch.keyframes.length > 0) {
      if (keyAtTime) {
        updateKeyframe(layer.id, channel.path, keyAtTime.id, { value: v }, live);
      } else {
        addKeyframe(layer.id, channel.path, makeKf(time, v, "gentle"));
      }
    } else {
      updateLayer(
        layer.id,
        (l) => {
          const c = getChannel(l, channel.path);
          if (c) c.value = v;
        },
        live,
      );
    }
  };

  const toggleKey = () => {
    if (keyAtTime) {
      removeKeyframe(layer.id, channel.path, keyAtTime.id);
    } else {
      addKeyframe(layer.id, channel.path, makeKf(time, value, "gentle"));
    }
  };

  return (
    <Row>
      <button
        onClick={toggleKey}
        title={keyAtTime ? "Remove keyframe here" : "Add keyframe here"}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded transition ${
          keyAtTime
            ? "bg-brand-500/25 text-brand-300"
            : animated
              ? "text-brand-300/60 hover:bg-ink-700"
              : "text-haze-500 hover:bg-ink-700 hover:text-haze-300"
        }`}
      >
        <IconKey width={11} height={11} />
      </button>
      <span className="w-16 shrink-0 text-[11px] text-haze-400">
        {channel.label.replace("Position ", "Pos ")}
      </span>
      <NumberInput
        value={value}
        step={channel.step}
        min={channel.min}
        max={channel.max}
        suffix={channel.unit}
        onCommitStart={beginChange}
        onChange={onChange}
      />
    </Row>
  );
}

/* -------------------------------------------------------------------------- */

function LayerProperties({ layer }: { layer: Layer }) {
  const updateLayer = useStore((s) => s.updateLayer);
  const removeLayer = useStore((s) => s.removeLayer);
  const duplicateLayer = useStore((s) => s.duplicateLayer);
  const scene = useStore((s) => s.scene);

  const set = (patch: (l: Layer) => void) => updateLayer(layer.id, patch);
  const shape = layer.shape;
  const text = layer.text;

  return (
    <>
      <Section
        title="Layer"
        right={
          <div className="flex gap-1">
            <button
              onClick={() => duplicateLayer(layer.id)}
              className="text-haze-400 transition hover:text-white"
              title="Duplicate"
            >
              <IconPlus width={14} height={14} />
            </button>
            <button
              onClick={() => removeLayer(layer.id)}
              className="text-haze-400 transition hover:text-rose-300"
              title="Delete layer"
            >
              <IconTrash width={14} height={14} />
            </button>
          </div>
        }
      >
        <Row>
          <Label>Name</Label>
          <TextInput value={layer.name} onChange={(v) => set((l) => (l.name = v))} />
        </Row>
        <Row>
          <Label>Blend</Label>
          <Select
            value={layer.blendMode}
            onChange={(v) => set((l) => (l.blendMode = v as Layer["blendMode"]))}
            options={BLEND_MODES.map((b) => ({ value: b, label: cap(b) }))}
          />
        </Row>
        <Row>
          <Label>Clip</Label>
          <NumberInput
            value={layer.timing.start}
            step={0.1}
            min={0}
            suffix="s"
            onChange={(v, live) => updateLayer(layer.id, (l) => (l.timing.start = v), live)}
          />
          <NumberInput
            value={layer.timing.end}
            step={0.1}
            min={0}
            suffix="s"
            onChange={(v, live) => updateLayer(layer.id, (l) => (l.timing.end = v), live)}
          />
        </Row>
      </Section>

      <Section title="Transform">
        {TRANSFORM_CHANNELS.map((c) => (
          <ChannelField key={c.path} layer={layer} channel={c} />
        ))}
      </Section>

      {layer.type === "shape" && shape && (
        <Section title="Shape">
          <Row>
            <Label>Kind</Label>
            <Select
              value={shape.kind}
              onChange={(v) => set((l) => l.shape && (l.shape.kind = v as ShapeKind))}
              options={SHAPE_KINDS.map((k) => ({ value: k, label: cap(k) }))}
            />
          </Row>
          <Row>
            <Label>Size</Label>
            <NumberInput
              value={shape.width}
              min={1}
              onChange={(v, live) =>
                updateLayer(layer.id, (l) => l.shape && (l.shape.width = v), live)
              }
            />
            <NumberInput
              value={shape.height}
              min={1}
              onChange={(v, live) =>
                updateLayer(layer.id, (l) => l.shape && (l.shape.height = v), live)
              }
            />
          </Row>
          {shape.kind === "rect" && (
            <Row>
              <Label>Radius</Label>
              <NumberInput
                value={shape.cornerRadius}
                min={0}
                onChange={(v, live) =>
                  updateLayer(layer.id, (l) => l.shape && (l.shape.cornerRadius = v), live)
                }
              />
            </Row>
          )}
          {(shape.kind === "star" || shape.kind === "polygon") && (
            <Row>
              <Label>Points</Label>
              <NumberInput
                value={shape.points}
                min={3}
                onChange={(v, live) =>
                  updateLayer(
                    layer.id,
                    (l) => l.shape && (l.shape.points = Math.round(v)),
                    live,
                  )
                }
              />
            </Row>
          )}
          <Row>
            <Label>Fill</Label>
            <ColorInput
              value={shape.fill.color}
              onChange={(v) => set((l) => l.shape && (l.shape.fill.color = v))}
            />
          </Row>
          <Row>
            <Label>Gradient</Label>
            <label className="flex flex-1 items-center gap-2 text-xs text-haze-300">
              <input
                type="checkbox"
                checked={!!shape.fill.gradient}
                onChange={(e) =>
                  set((l) => {
                    if (!l.shape) return;
                    if (e.target.checked)
                      l.shape.fill.gradient = { to: "#ff5c9d", angle: 90 };
                    else l.shape.fill.gradient = undefined;
                  })
                }
              />
              {shape.fill.gradient ? "On" : "Off"}
            </label>
          </Row>
          {shape.fill.gradient && (
            <>
              <Row>
                <Label>To</Label>
                <ColorInput
                  value={shape.fill.gradient.to}
                  onChange={(v) =>
                    set((l) => {
                      const g = l.shape?.fill.gradient;
                      if (g) g.to = v;
                    })
                  }
                />
              </Row>
              <Row>
                <Label>Angle</Label>
                <NumberInput
                  value={shape.fill.gradient.angle}
                  suffix="°"
                  onChange={(v, live) =>
                    updateLayer(
                      layer.id,
                      (l) => {
                        const g = l.shape?.fill.gradient;
                        if (g) g.angle = v;
                      },
                      live,
                    )
                  }
                />
              </Row>
            </>
          )}
        </Section>
      )}

      {layer.type === "text" && text && (
        <Section title="Text">
          <Row>
            <Label>Content</Label>
            <TextInput
              value={text.content}
              onChange={(v) => set((l) => l.text && (l.text.content = v))}
            />
          </Row>
          <Row>
            <Label>Size</Label>
            <NumberInput
              value={text.fontSize}
              min={1}
              onChange={(v, live) =>
                updateLayer(layer.id, (l) => l.text && (l.text.fontSize = v), live)
              }
            />
          </Row>
          <Row>
            <Label>Weight</Label>
            <Select
              value={String(text.fontWeight)}
              onChange={(v) => set((l) => l.text && (l.text.fontWeight = Number(v)))}
              options={[400, 500, 600, 700, 800].map((w) => ({
                value: String(w),
                label: String(w),
              }))}
            />
          </Row>
          <Row>
            <Label>Align</Label>
            <Select
              value={text.align}
              onChange={(v) => set((l) => l.text && (l.text.align = v as TextAlign))}
              options={TEXT_ALIGN.map((a) => ({ value: a, label: cap(a) }))}
            />
          </Row>
          <Row>
            <Label>Fill</Label>
            <ColorInput
              value={text.fill}
              onChange={(v) => set((l) => l.text && (l.text.fill = v))}
            />
          </Row>
        </Section>
      )}

      <EffectsSection layer={layer} />
      <CapabilitySection layer={layer} scene={scene} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function EffectsSection({ layer }: { layer: Layer }) {
  const update = useStore((s) => s.update);

  const addFx = (type: EffectType) =>
    update((s) => {
      const l = s.layers.find((x) => x.id === layer.id);
      l?.effects.push(createEffect(type));
    });

  return (
    <Section
      title="Effects"
      right={
        <Select
          value=""
          onChange={(v) => v && addFx(v as EffectType)}
          options={[
            { value: "", label: "+ Add" },
            ...EFFECT_LIST.map((e) => ({ value: e.type, label: e.label })),
          ]}
        />
      }
    >
      {layer.effects.length === 0 && (
        <p className="text-[11px] text-haze-500">
          No effects. Browse the Effects panel (top-left) to add some — watch the
          export badges; most shader effects render in MP4 only.
        </p>
      )}
      {layer.effects.map((fx) => {
        const def = effectDef(fx.type);
        const setColor = (field: "color" | "color2", v: string) =>
          update((s) => {
            const f = s.layers
              .find((x) => x.id === layer.id)
              ?.effects.find((y) => y.id === fx.id);
            if (f) f[field] = v;
          });
        return (
          <div key={fx.id} className="rounded border border-ink-700 p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-haze-200">{def.label}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[10px] text-haze-400">
                  <input
                    type="checkbox"
                    checked={fx.enabled}
                    onChange={(e) =>
                      update((s) => {
                        const f = s.layers
                          .find((x) => x.id === layer.id)
                          ?.effects.find((y) => y.id === fx.id);
                        if (f) f.enabled = e.target.checked;
                      })
                    }
                  />
                  on
                </label>
                <button
                  onClick={() =>
                    update((s) => {
                      const l = s.layers.find((x) => x.id === layer.id);
                      if (l) l.effects = l.effects.filter((y) => y.id !== fx.id);
                    })
                  }
                  className="text-haze-400 transition hover:text-rose-300"
                >
                  <IconTrash width={13} height={13} />
                </button>
              </div>
            </div>
            {def.colors?.map((cdef) => (
              <Row key={cdef.field}>
                <Label>{cdef.label}</Label>
                <ColorInput
                  value={(cdef.field === "color" ? fx.color : fx.color2) ?? cdef.default}
                  onChange={(v) => setColor(cdef.field, v)}
                />
              </Row>
            ))}
            {effectChannels(layer)
              .filter((c) => c.path.includes(fx.id))
              .map((c) => (
                <ChannelField key={c.path} layer={layer} channel={c} />
              ))}
          </div>
        );
      })}
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

function CapabilitySection({
  layer,
  scene,
}: {
  layer: Layer;
  scene: SceneDocument;
}) {
  const report = analyzeScene(scene);
  return (
    <Section title="Export compatibility">
      <div className="space-y-2">
        {EXPORT_TARGETS.map((target) => {
          const lr = report[target].layers.find((l) => l.layerId === layer.id);
          if (!lr) return null;
          const m = LEVEL_META[lr.level];
          const issues = lr.findings.filter((f) => f.level !== "full");
          return (
            <div key={target} className="rounded-md border border-ink-700 p-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
                <span className="text-xs font-semibold text-haze-200">
                  {TARGET_LABEL[target]}
                </span>
                <span className={`ml-auto text-[10px] ${m.color}`}>{m.label}</span>
              </div>
              {issues.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {issues.map((f, i) => (
                    <li key={i} className="text-[10px] leading-snug text-haze-500">
                      <span className="text-haze-300">{f.label}:</span>{" "}
                      {f.note ?? f.level}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

function CompositionProperties() {
  const scene = useStore((s) => s.scene);
  const update = useStore((s) => s.update);
  const updateLive = useStore((s) => s.updateLive);
  const beginChange = useStore((s) => s.beginChange);
  const c = scene.composition;

  const setC = (patch: (comp: typeof c) => void, live = false) =>
    (live ? updateLive : update)((s) => patch(s.composition));

  return (
    <>
      <Section title="Composition">
        <Row>
          <Label>Width</Label>
          <NumberInput
            value={c.width}
            min={1}
            suffix="px"
            onCommitStart={beginChange}
            onChange={(v, live) => setC((x) => (x.width = Math.round(v)), live)}
          />
        </Row>
        <Row>
          <Label>Height</Label>
          <NumberInput
            value={c.height}
            min={1}
            suffix="px"
            onCommitStart={beginChange}
            onChange={(v, live) => setC((x) => (x.height = Math.round(v)), live)}
          />
        </Row>
        <Row>
          <Label>FPS</Label>
          <NumberInput
            value={c.fps}
            min={1}
            max={120}
            onCommitStart={beginChange}
            onChange={(v, live) => setC((x) => (x.fps = Math.round(v)), live)}
          />
        </Row>
        <Row>
          <Label>Duration</Label>
          <NumberInput
            value={c.duration}
            min={0.1}
            step={0.5}
            suffix="s"
            onCommitStart={beginChange}
            onChange={(v, live) => setC((x) => (x.duration = v), live)}
          />
        </Row>
        <Row>
          <Label>Background</Label>
          <ColorInput
            value={c.background}
            onChange={(v) => setC((x) => (x.background = v))}
          />
        </Row>
      </Section>
      <div className="px-3 py-4 text-[11px] leading-relaxed text-haze-500">
        Select a layer to edit it, or add one from the toolbar. Tip: press{" "}
        <kbd className="rounded bg-ink-700 px-1">Space</kbd> to play.
      </div>
    </>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}
