"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import { evalAnimatable } from "@/lib/anim/evaluate";
import { layerLevelFor } from "@/lib/capability/engine";
import {
  TRANSFORM_CHANNELS,
  effectChannels,
  getChannel,
  type ChannelDef,
} from "@/lib/scene/paths";
import { kf as makeKf } from "@/lib/scene/factory";
import type { Layer } from "@/lib/scene/schema";
import { CompatBadge } from "@/components/ui/compat";
import {
  IconChevron,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLoop,
  IconPause,
  IconPlay,
  IconStop,
} from "@/components/ui/icons";

const LABEL_W = 224;
const ROW_H = 30;

function startDrag(
  onMove: (e: PointerEvent) => void,
  onEnd?: (e: PointerEvent) => void,
) {
  const move = (e: PointerEvent) => onMove(e);
  const up = (e: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onEnd?.(e);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function fmt(t: number) {
  return `${t.toFixed(2)}s`;
}

export function Timeline() {
  const scene = useStore((s) => s.scene);
  const time = useStore((s) => s.time);
  const setTime = useStore((s) => s.setTime);
  const playing = useStore((s) => s.playing);
  const togglePlay = useStore((s) => s.togglePlay);
  const pause = useStore((s) => s.pause);
  const loop = useStore((s) => s.loop);
  const toggleLoop = useStore((s) => s.toggleLoop);
  const expanded = useStore((s) => s.expanded);

  const duration = scene.composition.duration;
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaW, setAreaW] = useState(800);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaW(el.clientWidth));
    ro.observe(el);
    setAreaW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pxPerSec = areaW / duration;
  const timeToX = (t: number) => t * pxPerSec;
  const xToTime = (x: number) =>
    Math.max(0, Math.min(duration, x / pxPerSec));

  const scrub = (clientX: number) => {
    const rect = areaRef.current!.getBoundingClientRect();
    setTime(xToTime(clientX - rect.left));
  };

  // Ruler tick spacing — aim for ~80px between labels.
  const niceStep = (() => {
    const target = 80 / pxPerSec;
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10];
    return steps.find((s) => s >= target) ?? 10;
  })();
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += niceStep) ticks.push(t);

  return (
    <div className="flex h-full flex-col bg-ink-850 text-sm">
      {/* Transport */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-ink-700 px-3">
        <button
          onClick={togglePlay}
          className="grid h-7 w-7 place-items-center rounded-md bg-ink-700 text-white transition hover:bg-ink-600"
          title={playing ? "Pause (Space)" : "Play (Space)"}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button
          onClick={() => {
            pause();
            setTime(0);
          }}
          className="grid h-7 w-7 place-items-center rounded-md text-haze-300 transition hover:bg-ink-700 hover:text-white"
          title="Stop"
        >
          <IconStop />
        </button>
        <button
          onClick={toggleLoop}
          className={`grid h-7 w-7 place-items-center rounded-md transition ${
            loop
              ? "bg-brand-500/20 text-brand-300"
              : "text-haze-400 hover:bg-ink-700 hover:text-white"
          }`}
          title="Loop"
        >
          <IconLoop />
        </button>
        <div className="ml-2 font-mono text-xs text-haze-300">
          <span className="text-white">{fmt(time)}</span>
          <span className="text-haze-400"> / {fmt(duration)}</span>
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-haze-400">
          {scene.layers.length} layer{scene.layers.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Body: header column + time area */}
      <div className="relative flex flex-1 overflow-y-auto overflow-x-hidden">
        {/* Left labels */}
        <div
          className="sticky left-0 z-20 shrink-0 border-r border-ink-700 bg-ink-850"
          style={{ width: LABEL_W }}
        >
          <div className="h-7 border-b border-ink-700" />
          {scene.layers.length === 0 && (
            <div className="px-3 py-4 text-xs text-haze-400">
              No layers yet. Add one from the toolbar.
            </div>
          )}
          {scene.layers
            .slice()
            .reverse()
            .map((layer) => (
              <LayerLabel key={layer.id} layer={layer} />
            ))}
        </div>

        {/* Time area */}
        <div
          ref={areaRef}
          className="relative flex-1 cursor-text select-none"
          onPointerDown={(e) => {
            scrub(e.clientX);
            startDrag((ev) => scrub(ev.clientX));
          }}
        >
          {/* Ruler */}
          <div className="sticky top-0 z-10 h-7 border-b border-ink-700 bg-ink-850">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex h-7 flex-col justify-center border-l border-ink-700/70 pl-1 text-[10px] text-haze-400"
                style={{ left: timeToX(t) }}
              >
                {t.toFixed(niceStep < 1 ? 1 : 0)}s
              </div>
            ))}
          </div>

          {/* Rows */}
          {scene.layers
            .slice()
            .reverse()
            .map((layer) => (
              <TimeRows
                key={layer.id}
                layer={layer}
                expanded={!!expanded[layer.id]}
                pxPerSec={pxPerSec}
                duration={duration}
                areaRef={areaRef}
              />
            ))}

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-brand-400"
            style={{ left: timeToX(time) }}
          >
            <div className="absolute -left-[5px] -top-0 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-brand-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Left-column labels                                                         */
/* -------------------------------------------------------------------------- */

function LayerLabel({ layer }: { layer: Layer }) {
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const selectLayer = useStore((s) => s.selectLayer);
  const toggleExpanded = useStore((s) => s.toggleExpanded);
  const expanded = useStore((s) => !!s.expanded[layer.id]);
  const updateLayer = useStore((s) => s.updateLayer);
  const activeTarget = useStore((s) => s.activeTarget);

  const channels = [...TRANSFORM_CHANNELS, ...effectChannels(layer)];
  const selected = selectedLayerId === layer.id;

  return (
    <div className={selected ? "bg-brand-500/8" : ""}>
      <div
        className="flex h-[30px] items-center gap-1.5 border-b border-ink-800 px-2"
        onClick={() => selectLayer(layer.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded(layer.id);
          }}
          className={`grid h-4 w-4 place-items-center text-haze-400 transition hover:text-white ${
            expanded ? "rotate-90" : ""
          }`}
        >
          <IconChevron width={12} height={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateLayer(layer.id, (l) => {
              l.visible = !l.visible;
            });
          }}
          className="text-haze-400 transition hover:text-white"
        >
          {layer.visible ? (
            <IconEye width={14} height={14} />
          ) : (
            <IconEyeOff width={14} height={14} />
          )}
        </button>
        <span
          className={`flex-1 truncate text-xs ${
            selected ? "text-white" : "text-haze-300"
          }`}
        >
          {layer.name}
        </span>
        <CompatBadge level={layerLevelFor(layer, activeTarget)} target={activeTarget} />
      </div>

      {expanded &&
        channels.map((ch) => (
          <div
            key={ch.path}
            className="flex h-[30px] items-center gap-1 border-b border-ink-800 pl-8 pr-2 text-[11px] text-haze-400"
          >
            <span className="flex-1 truncate">{ch.label}</span>
            <AddKeyButton layer={layer} channel={ch} />
          </div>
        ))}
    </div>
  );
}

function AddKeyButton({ layer, channel }: { layer: Layer; channel: ChannelDef }) {
  const addKeyframe = useStore((s) => s.addKeyframe);
  return (
    <button
      title="Add keyframe at playhead"
      onClick={(e) => {
        e.stopPropagation();
        const { time, scene } = useStore.getState();
        const live = scene.layers.find((l) => l.id === layer.id);
        if (!live) return;
        const ch = getChannel(live, channel.path);
        if (!ch) return;
        const value = evalAnimatable(ch, time);
        addKeyframe(layer.id, channel.path, makeKf(time, value, "gentle"));
      }}
      className="grid h-4 w-4 place-items-center rounded text-haze-500 transition hover:bg-ink-700 hover:text-brand-300"
    >
      <IconKey width={11} height={11} />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Right-column rows (clip bar + keyframe lanes)                              */
/* -------------------------------------------------------------------------- */

function TimeRows({
  layer,
  expanded,
  pxPerSec,
  duration,
  areaRef,
}: {
  layer: Layer;
  expanded: boolean;
  pxPerSec: number;
  duration: number;
  areaRef: React.RefObject<HTMLDivElement | null>;
}) {
  const channels = [...TRANSFORM_CHANNELS, ...effectChannels(layer)];
  return (
    <div>
      <ClipBar
        layer={layer}
        pxPerSec={pxPerSec}
        duration={duration}
        areaRef={areaRef}
      />
      {expanded &&
        channels.map((ch) => (
          <KeyframeLane
            key={ch.path}
            layer={layer}
            channel={ch}
            pxPerSec={pxPerSec}
            duration={duration}
            areaRef={areaRef}
          />
        ))}
    </div>
  );
}

function ClipBar({
  layer,
  pxPerSec,
  duration,
  areaRef,
}: {
  layer: Layer;
  pxPerSec: number;
  duration: number;
  areaRef: React.RefObject<HTMLDivElement | null>;
}) {
  const updateLayer = useStore((s) => s.updateLayer);
  const beginChange = useStore((s) => s.beginChange);
  const selectLayer = useStore((s) => s.selectLayer);
  const selected = useStore((s) => s.selectedLayerId === layer.id);

  const xToTime = (clientX: number) => {
    const rect = areaRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (clientX - rect.left) / pxPerSec));
  };

  const dragBody = (e: React.PointerEvent) => {
    e.stopPropagation();
    selectLayer(layer.id);
    beginChange();
    const startT = xToTime(e.clientX);
    const s0 = layer.timing.start;
    const e0 = layer.timing.end;
    const len = e0 - s0;
    startDrag((ev) => {
      const dt = xToTime(ev.clientX) - startT;
      let ns = Math.max(0, s0 + dt);
      if (ns + len > duration) ns = duration - len;
      updateLayer(
        layer.id,
        (l) => {
          l.timing.start = ns;
          l.timing.end = ns + len;
        },
        true,
      );
    });
  };

  const dragEdge = (side: "start" | "end") => (e: React.PointerEvent) => {
    e.stopPropagation();
    beginChange();
    startDrag((ev) => {
      const t = xToTime(ev.clientX);
      updateLayer(
        layer.id,
        (l) => {
          if (side === "start") l.timing.start = Math.min(t, l.timing.end - 0.1);
          else l.timing.end = Math.max(t, l.timing.start + 0.1);
        },
        true,
      );
    });
  };

  const left = layer.timing.start * pxPerSec;
  const width = Math.max(4, (layer.timing.end - layer.timing.start) * pxPerSec);

  return (
    <div className="relative h-[30px] border-b border-ink-800">
      <div
        onPointerDown={dragBody}
        className={`absolute top-1.5 h-[18px] cursor-grab rounded-md border active:cursor-grabbing ${
          selected
            ? "border-brand-400/60 bg-brand-500/30"
            : "border-ink-500 bg-ink-600/70 hover:bg-ink-600"
        }`}
        style={{ left, width }}
      >
        <div
          onPointerDown={dragEdge("start")}
          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l-md bg-white/20"
        />
        <div
          onPointerDown={dragEdge("end")}
          className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r-md bg-white/20"
        />
      </div>
    </div>
  );
}

function KeyframeLane({
  layer,
  channel,
  pxPerSec,
  duration,
  areaRef,
}: {
  layer: Layer;
  channel: ChannelDef;
  pxPerSec: number;
  duration: number;
  areaRef: React.RefObject<HTMLDivElement | null>;
}) {
  const updateKeyframe = useStore((s) => s.updateKeyframe);
  const beginChange = useStore((s) => s.beginChange);
  const selectKeyframe = useStore((s) => s.selectKeyframe);
  const addKeyframe = useStore((s) => s.addKeyframe);
  const selectedKf = useStore((s) => s.selectedKeyframe);

  const ch = getChannel(layer, channel.path);
  const kfs = ch?.keyframes ?? [];

  const xToTime = (clientX: number) => {
    const rect = areaRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (clientX - rect.left) / pxPerSec));
  };

  const dragKf = (kfId: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    selectKeyframe({ layerId: layer.id, channelPath: channel.path, kfId });
    beginChange();
    startDrag((ev) => {
      updateKeyframe(
        layer.id,
        channel.path,
        kfId,
        { time: xToTime(ev.clientX) },
        true,
      );
    });
  };

  const addAt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ch) return;
    const t = xToTime(e.clientX);
    addKeyframe(layer.id, channel.path, makeKf(t, evalAnimatable(ch, t), "gentle"));
  };

  return (
    <div
      className="relative h-[30px] border-b border-ink-800/60 bg-ink-900/30"
      onDoubleClick={addAt}
    >
      {/* connecting line between keyframes */}
      {kfs.length > 1 && (
        <div
          className="absolute top-1/2 h-px bg-brand-400/30"
          style={{
            left: kfs[0].time * pxPerSec,
            width: (kfs[kfs.length - 1].time - kfs[0].time) * pxPerSec,
          }}
        />
      )}
      {kfs.map((k) => {
        const isSel =
          selectedKf?.kfId === k.id && selectedKf?.layerId === layer.id;
        return (
          <button
            key={k.id}
            onPointerDown={dragKf(k.id)}
            title={`${channel.label}: ${k.value.toFixed(1)} @ ${k.time.toFixed(2)}s · ${k.easing}`}
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border transition ${
              isSel
                ? "border-white bg-white"
                : "border-brand-300 bg-brand-400 hover:bg-brand-300"
            }`}
            style={{ left: ROW_H ? k.time * pxPerSec : 0 }}
          />
        );
      })}
    </div>
  );
}
