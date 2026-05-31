"use client";

import { useStore } from "@/lib/store/useStore";
import { ColorInput, Label, NumberInput, Row, Section } from "@/components/panels/fields";

/** Common composition presets (label → w×h). */
const PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: "1080p Landscape", w: 1920, h: 1080 },
  { label: "1080p Square", w: 1080, h: 1080 },
  { label: "1080p Vertical (9:16)", w: 1080, h: 1920 },
  { label: "4K UHD", w: 3840, h: 2160 },
  { label: "Instagram Post", w: 1080, h: 1350 },
  { label: "Banner 16:9", w: 1280, h: 720 },
];

/**
 * Scene settings — every GLOBAL composition setting lives here (moved out of the
 * canvas chrome), opened from the hamburger menu. Also surfaces playback,
 * editor preferences and project actions.
 */
export function SettingsPanel() {
  const show = useStore((s) => s.showSettings);
  const setShow = useStore((s) => s.setShowSettings);
  const scene = useStore((s) => s.scene);
  const update = useStore((s) => s.update);
  const updateLive = useStore((s) => s.updateLive);
  const beginChange = useStore((s) => s.beginChange);
  const loop = useStore((s) => s.loop);
  const toggleLoop = useStore((s) => s.toggleLoop);
  const autoKeyframe = useStore((s) => s.autoKeyframe);
  const setAutoKeyframe = useStore((s) => s.setAutoKeyframe);

  if (!show) return null;
  const c = scene.composition;

  const setC = (patch: (comp: typeof c) => void, live = false) =>
    (live ? updateLive : update)((s) => patch(s.composition));

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/50"
      onClick={() => setShow(false)}
    >
      <div
        className="flex h-full w-[360px] flex-col border-r border-ink-600 bg-ink-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-ink-700 px-3">
          <h2 className="text-sm font-semibold text-haze-200">Scene Settings</h2>
          <button
            onClick={() => setShow(false)}
            className="text-haze-400 transition hover:text-haze-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Section title="Project">
            <Row>
              <Label>Name</Label>
              <input
                value={scene.name}
                onChange={(e) => update((s) => (s.name = e.target.value))}
                className="w-full rounded border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-haze-200 focus:border-brand-400 focus:outline-none"
              />
            </Row>
          </Section>

          <Section title="Composition">
            <div className="mb-1 grid grid-cols-2 gap-1">
              {PRESETS.map((p) => {
                const active = c.width === p.w && c.height === p.h;
                return (
                  <button
                    key={p.label}
                    onClick={() =>
                      update((s) => {
                        s.composition.width = p.w;
                        s.composition.height = p.h;
                      })
                    }
                    className={`rounded px-2 py-1 text-left text-[10px] transition ${
                      active
                        ? "bg-brand-500/20 text-brand-300"
                        : "bg-ink-800 text-haze-400 hover:bg-ink-700 hover:text-haze-200"
                    }`}
                  >
                    {p.label}
                    <span className="block text-[9px] text-haze-500">
                      {p.w}×{p.h}
                    </span>
                  </button>
                );
              })}
            </div>
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
              <Label>Frame rate</Label>
              <NumberInput
                value={c.fps}
                min={1}
                max={120}
                suffix="fps"
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

          <Section title="Playback & Editing">
            <Toggle label="Loop playback" value={loop} onChange={toggleLoop} />
            <Toggle
              label="Auto-keyframe"
              hint="Transforming a layer writes keyframes at the playhead."
              value={autoKeyframe}
              onChange={() => setAutoKeyframe(!autoKeyframe)}
            />
          </Section>

          <div className="px-3 py-3 text-[11px] leading-relaxed text-haze-500">
            Everything here is client-side. Use the toolbar to import media or a
            scene, and Export to render MP4 / Lottie / CSS.
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-start gap-2 text-left"
    >
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition ${
          value ? "bg-brand-500" : "bg-ink-600"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-white transition-transform ${
            value ? "translate-x-3" : ""
          }`}
        />
      </span>
      <span className="flex-1">
        <span className="text-xs text-haze-200">{label}</span>
        {hint && <span className="block text-[10px] text-haze-500">{hint}</span>}
      </span>
    </button>
  );
}
