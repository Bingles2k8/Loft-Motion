"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useStore, kfKey, type KfRef } from "@/lib/store/useStore";
import { evalAnimatable } from "@/lib/anim/evaluate";
import { layerLevelFor } from "@/lib/capability/engine";
import { getChannel, type ChannelDef } from "@/lib/scene/paths";
import { kf as makeKf } from "@/lib/scene/factory";
import { LABEL_COLORS, type Layer } from "@/lib/scene/schema";
import { CompatBadge } from "@/components/ui/compat";
import { Splitter } from "@/components/ui/Splitter";
import { GraphEditor } from "@/components/timeline/GraphEditor";
import {
  ROW_H,
  RULER_H,
  fmtTime,
  layerChannels,
  niceStep,
  startDrag,
} from "@/components/timeline/shared";
import {
  IconAdjust,
  IconChevron,
  IconEye,
  IconEyeOff,
  IconGraph,
  IconImage,
  IconLoop,
  IconNull,
  IconPause,
  IconPlay,
  IconSquare,
  IconStopwatch,
  IconStop,
  IconText,
} from "@/components/ui/icons";
import type { LayerType } from "@/lib/scene/schema";

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A small glyph indicating a layer's type, AE-style. */
function LayerTypeIcon({ type }: { type: LayerType }) {
  const cls = "shrink-0 text-haze-500";
  switch (type) {
    case "text":
      return <IconText width={12} height={12} className={cls} />;
    case "image":
      return <IconImage width={12} height={12} className={cls} />;
    case "null":
      return <IconNull width={12} height={12} className={cls} />;
    case "adjustment":
      return <IconAdjust width={12} height={12} className={cls} />;
    default:
      return <IconSquare width={12} height={12} className={cls} />;
  }
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
  const graphMode = useStore((s) => s.graphMode);
  const toggleGraphMode = useStore((s) => s.toggleGraphMode);
  const labelW = useStore((s) => s.sizes.timelineLabels);
  const setPanelSize = useStore((s) => s.setPanelSize);
  const selectedKeys = useStore((s) => s.selectedKeys);

  const duration = scene.composition.duration;
  const fps = scene.composition.fps;

  const areaRef = useRef<HTMLDivElement>(null);
  const [areaW, setAreaW] = useState(800);
  // Horizontal view: zoom (1 = fit-to-width) + scroll offset in px. Scroll is
  // allowed to overshoot past the composition's start/end by OVERSCROLL px.
  const [zoom, setZoom] = useState(1);
  const [scrollPx, setScrollPx] = useState(0);
  const OVERSCROLL = 300;

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaW(el.clientWidth));
    ro.observe(el);
    setAreaW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const basePxPerSec = areaW / duration;
  const pxPerSec = basePxPerSec * zoom;
  const contentW = duration * pxPerSec;
  const maxScroll = Math.max(0, contentW - areaW) + OVERSCROLL;
  const clampScroll = (s: number) => Math.max(-OVERSCROLL, Math.min(maxScroll, s));

  const timeToX = (t: number) => t * pxPerSec - scrollPx;
  const xToTime = (clientX: number) => {
    const rect = areaRef.current!.getBoundingClientRect();
    return (clientX - rect.left + scrollPx) / pxPerSec;
  };

  // Ruler scrubbing (the ONLY place the playhead moves by click/drag).
  const scrubRuler = (clientX: number) =>
    setTime(snap(Math.max(0, Math.min(duration, xToTime(clientX))), fps));
  const onRulerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    scrubRuler(e.clientX);
    startDrag((ev) => scrubRuler(ev.clientX));
  };

  // Wheel: horizontal scroll; Ctrl/Cmd = zoom about the cursor.
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const rect = areaRef.current!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const tAtCursor = (cursorX + scrollPx) / pxPerSec;
      const nextZoom = Math.max(0.25, Math.min(40, zoom * (e.deltaY < 0 ? 1.15 : 0.87)));
      const nextPxPerSec = basePxPerSec * nextZoom;
      setZoom(nextZoom);
      setScrollPx(clampScroll(tAtCursor * nextPxPerSec - cursorX));
    } else {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setScrollPx((s) => clampScroll(s + d));
    }
  };

  const zoomBy = (factor: number) =>
    setZoom((z) => Math.max(0.25, Math.min(40, z * factor)));
  const zoomFit = () => {
    setZoom(1);
    setScrollPx(0);
  };

  const step = niceStep(pxPerSec);
  const ticks: number[] = [];
  const tStart = Math.max(0, Math.floor(scrollPx / pxPerSec / step) * step);
  const tEnd = Math.min(duration, (scrollPx + areaW) / pxPerSec);
  for (let t = tStart; t <= tEnd + 1e-6; t += step) ticks.push(t);

  return (
    <div className="flex h-full flex-col bg-ink-850 lm-noselect">
      {/* Transport bar */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-ink-700 px-2.5">
        <TransportButton active={playing} onClick={togglePlay} title={playing ? "Pause (Space)" : "Play (Space)"}>
          {playing ? <IconPause /> : <IconPlay />}
        </TransportButton>
        <TransportButton
          onClick={() => {
            pause();
            setTime(0);
          }}
          title="Go to start (Home)"
        >
          <IconStop />
        </TransportButton>
        <TransportButton active={loop} onClick={toggleLoop} title="Loop">
          <IconLoop />
        </TransportButton>

        <div className="mx-1 h-4 w-px bg-ink-700" />

        {/* Frame step */}
        <TransportButton
          onClick={() => setTime(Math.max(0, time - 1 / fps))}
          title="Previous frame (←)"
        >
          <span className="text-xs leading-none">◂</span>
        </TransportButton>
        <TransportButton
          onClick={() => setTime(Math.min(duration, time + 1 / fps))}
          title="Next frame (→)"
        >
          <span className="text-xs leading-none">▸</span>
        </TransportButton>

        <div className="ml-2 font-mono text-xs tabular-nums">
          <span className="text-haze-200">{fmtTime(time)}</span>
          <span className="text-haze-500"> / {fmtTime(duration)}</span>
        </div>

        <div className="flex-1" />

        {selectedKeys.length > 0 && (
          <span className="mr-1 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-300">
            {selectedKeys.length} key{selectedKeys.length === 1 ? "" : "s"} selected
          </span>
        )}

        {/* Zoom controls */}
        <div className="mr-1 flex items-center gap-0.5">
          <TransportButton onClick={() => zoomBy(0.8)} title="Zoom out">
            <span className="text-sm leading-none">−</span>
          </TransportButton>
          <button
            onClick={zoomFit}
            title="Fit to width"
            className="rounded px-1.5 py-1 text-[10px] font-medium tabular-nums text-haze-400 transition hover:bg-ink-700 hover:text-haze-200"
          >
            {Math.round(zoom * 100)}%
          </button>
          <TransportButton onClick={() => zoomBy(1.25)} title="Zoom in">
            <span className="text-sm leading-none">+</span>
          </TransportButton>
        </div>

        <button
          onClick={toggleGraphMode}
          title="Graph editor (Shift+G)"
          className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition ${
            graphMode
              ? "bg-brand-500/20 text-brand-300"
              : "text-haze-300 hover:bg-ink-700 hover:text-haze-200"
          }`}
        >
          <IconGraph width={14} height={14} />
          Graph
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left label column */}
        <div
          className="flex shrink-0 flex-col overflow-hidden border-r border-ink-700 bg-ink-850"
          style={{ width: labelW }}
        >
          <div className="flex h-[26px] shrink-0 items-center border-b border-ink-700 px-2 text-[10px] font-semibold uppercase tracking-wider text-haze-500">
            Layers
          </div>
          <div className="flex-1 overflow-y-auto" id="lm-timeline-labels">
            {scene.layers.length === 0 && (
              <div className="px-3 py-4 text-xs text-haze-500">
                No layers yet. Add one from the toolbar or Project panel.
              </div>
            )}
            {scene.layers
              .slice()
              .reverse()
              .map((layer) => (
                <LayerLabel key={layer.id} layer={layer} expanded={!!expanded[layer.id]} />
              ))}
          </div>
        </div>

        <Splitter
          orientation="vertical"
          value={labelW}
          min={160}
          max={520}
          onChange={(v) => setPanelSize("timelineLabels", v)}
        />

        {/* Right: ruler + tracks (or graph) */}
        <div className="relative flex min-w-0 flex-1 flex-col" onWheel={onWheel}>
          {/* Ruler — the only scrub surface */}
          <div
            className="relative h-[26px] shrink-0 cursor-ew-resize overflow-hidden border-b border-ink-700 bg-ink-800 lm-noselect"
            onPointerDown={onRulerDown}
            ref={areaRef}
          >
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex h-[26px] items-center border-l border-ink-700 pl-1 text-[10px] text-haze-500"
                style={{ left: timeToX(t) }}
              >
                {step < 1 ? t.toFixed(1) : t.toFixed(0)}s
              </div>
            ))}
            {/* End-of-composition marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-ink-600"
              style={{ left: timeToX(duration) }}
            />
            {/* CTI head */}
            <div
              className="pointer-events-none absolute top-0 z-30"
              style={{ left: timeToX(time) }}
            >
              <div className="absolute -left-[6px] top-0 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-brand-400" />
            </div>
          </div>

          {/* Content */}
          {graphMode ? (
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <PlayheadLine x={timeToX(time)} />
              <GraphEditor timeToX={timeToX} xToTime={xToTime} duration={duration} />
            </div>
          ) : (
            <DopeSheet
              pxPerSec={pxPerSec}
              duration={duration}
              timeToX={timeToX}
              xToTime={xToTime}
              areaRef={areaRef}
              playheadX={timeToX(time)}
              contentW={contentW}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TransportButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`grid h-7 w-7 place-items-center rounded transition ${
        active
          ? "bg-brand-500/20 text-brand-300"
          : "text-haze-300 hover:bg-ink-700 hover:text-haze-200"
      }`}
    >
      {children}
    </button>
  );
}

function PlayheadLine({ x }: { x: number }) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-brand-400/80"
      style={{ left: x }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Left column                                                               */
/* -------------------------------------------------------------------------- */

function LayerLabel({ layer, expanded }: { layer: Layer; expanded: boolean }) {
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const selectLayer = useStore((s) => s.selectLayer);
  const toggleExpanded = useStore((s) => s.toggleExpanded);
  const updateLayer = useStore((s) => s.updateLayer);
  const toggleLayerSolo = useStore((s) => s.toggleLayerSolo);
  const toggleLayerLock = useStore((s) => s.toggleLayerLock);
  const setLayerLabel = useStore((s) => s.setLayerLabel);
  const activeTarget = useStore((s) => s.activeTarget);
  const solo = useStore((s) => s.soloChannels[layer.id]);
  const selected = selectedLayerId === layer.id;

  const channels = layerChannels(layer).filter(
    (ch) => !solo || solo.length === 0 || solo.includes(ch.path),
  );

  return (
    <div className={selected ? "bg-brand-tint/40" : ""}>
      <div
        className="relative flex items-center gap-1.5 border-b border-ink-800 pl-2.5 pr-2"
        style={{ height: ROW_H }}
        onClick={() => selectLayer(layer.id)}
      >
        {/* Label-colour stripe (click to cycle through label colours). */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setLayerLabel(layer.id, (layer.label + 1) % LABEL_COLORS.length);
          }}
          title="Label colour"
          className="absolute left-0 top-0 h-full w-1"
          style={{ background: LABEL_COLORS[layer.label] }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded(layer.id);
          }}
          className={`grid h-4 w-4 place-items-center text-haze-500 transition hover:text-haze-200 ${
            expanded ? "rotate-90" : ""
          }`}
        >
          <IconChevron width={11} height={11} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateLayer(layer.id, (l) => {
              l.visible = !l.visible;
            });
          }}
          className="text-haze-500 transition hover:text-haze-200"
        >
          {layer.visible ? <IconEye width={13} height={13} /> : <IconEyeOff width={13} height={13} />}
        </button>
        {/* Solo */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLayerSolo(layer.id);
          }}
          title="Solo"
          className={`grid h-4 w-4 place-items-center rounded text-[9px] font-bold transition ${
            layer.solo ? "bg-amber-400/20 text-amber-300" : "text-haze-600 hover:text-haze-300"
          }`}
        >
          S
        </button>
        {/* Lock */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLayerLock(layer.id);
          }}
          title="Lock"
          className={`grid h-4 w-4 place-items-center rounded text-[9px] font-bold transition ${
            layer.locked ? "bg-brand-500/20 text-brand-300" : "text-haze-600 hover:text-haze-300"
          }`}
        >
          {layer.locked ? "L" : "l"}
        </button>
        <span className={`flex flex-1 items-center gap-1.5 truncate text-xs ${selected ? "text-haze-200" : "text-haze-300"} ${layer.locked ? "opacity-50" : ""}`}>
          <LayerTypeIcon type={layer.type} />
          <span className="truncate">{layer.name}</span>
        </span>
        {expanded && <SoloMenu layer={layer} />}
        <CompatBadge level={layerLevelFor(layer, activeTarget)} target={activeTarget} />
      </div>

      {expanded &&
        channels.map((ch) => (
          <ChannelLabel key={ch.path} layer={layer} channel={ch} soloed={!!solo?.includes(ch.path)} />
        ))}
    </div>
  );
}

/** A compact "show only…" menu to solo specific property rows (like AE's U/P/S/R). */
function SoloMenu({ layer }: { layer: Layer }) {
  const solo = useStore((s) => s.soloChannels[layer.id]);
  const toggleSolo = useStore((s) => s.toggleSoloChannel);
  const clearSolo = useStore((s) => s.clearSoloChannels);
  const channels = layerChannels(layer);

  return (
    <details
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onToggle={(e) => e.stopPropagation()}
    >
      <summary
        title="Show only specific properties"
        className={`flex h-4 cursor-pointer list-none items-center rounded px-1 text-[9px] font-semibold uppercase tracking-wide transition ${
          solo?.length ? "bg-brand-500/20 text-brand-300" : "text-haze-500 hover:text-haze-200"
        }`}
      >
        Show
      </summary>
      <div className="absolute right-0 top-5 z-50 w-44 rounded border border-ink-600 bg-ink-800 py-1 shadow-xl">
        <button
          onClick={() => clearSolo(layer.id)}
          className="block w-full px-2 py-1 text-left text-[11px] text-haze-300 hover:bg-ink-700"
        >
          All properties
        </button>
        <div className="my-1 border-t border-ink-700" />
        {channels.map((ch) => (
          <button
            key={ch.path}
            onClick={() => toggleSolo(layer.id, ch.path)}
            className="flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] text-haze-300 hover:bg-ink-700"
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm border ${
                solo?.includes(ch.path)
                  ? "border-brand-400 bg-brand-500"
                  : "border-ink-500"
              }`}
            />
            {ch.label}
          </button>
        ))}
      </div>
    </details>
  );
}

function ChannelLabel({
  layer,
  channel,
  soloed,
}: {
  layer: Layer;
  channel: ChannelDef;
  soloed: boolean;
}) {
  const addKeyframe = useStore((s) => s.addKeyframe);
  const ch = getChannel(layer, channel.path);
  const animated = (ch?.keyframes.length ?? 0) > 0;
  return (
    <div
      className={`flex items-center gap-1.5 border-b border-ink-800 pl-7 pr-2 text-[11px] ${
        soloed ? "bg-brand-tint/20 text-haze-300" : "text-haze-400"
      }`}
      style={{ height: ROW_H }}
    >
      <button
        title={animated ? "Animated" : "Click to keyframe at playhead"}
        onClick={(e) => {
          e.stopPropagation();
          const { time, scene } = useStore.getState();
          const live = scene.layers.find((l) => l.id === layer.id);
          if (!live) return;
          const c = getChannel(live, channel.path);
          if (!c) return;
          addKeyframe(layer.id, channel.path, makeKf(time, evalAnimatable(c, time), "gentle"));
        }}
        className={`transition ${animated ? "text-brand-400" : "text-haze-600 hover:text-haze-300"}`}
      >
        <IconStopwatch width={12} height={12} />
      </button>
      <span className="flex-1 truncate">{channel.label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dope sheet (right tracks)                                                  */
/* -------------------------------------------------------------------------- */

function DopeSheet({
  duration,
  timeToX,
  xToTime,
  areaRef,
  playheadX,
  contentW,
}: {
  pxPerSec: number;
  duration: number;
  timeToX: (t: number) => number;
  xToTime: (clientX: number) => number;
  areaRef: React.RefObject<HTMLDivElement | null>;
  playheadX: number;
  contentW: number;
}) {
  const scene = useStore((s) => s.scene);
  const expanded = useStore((s) => s.expanded);
  const soloChannels = useStore((s) => s.soloChannels);
  const selectKeyframes = useStore((s) => s.selectKeyframes);
  const clearSel = useStore((s) => s.clearKeyframeSelection);
  const tracksRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  // Marquee selection: drag in empty track space to rubber-band select keys.
  // Coordinates are content-relative (include scrollTop) so the rectangle and
  // hit-testing stay correct when the track list is scrolled.
  const onTracksDown = (e: React.PointerEvent) => {
    const el = tracksRef.current!;
    const rect = el.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top + el.scrollTop;
    if (!e.shiftKey) clearSel();
    let moved = false;
    startDrag(
      (ev) => {
        moved = true;
        const x1 = ev.clientX - rect.left;
        const y1 = ev.clientY - rect.top + el.scrollTop;
        const m = { x0: ox, y0: oy, x1, y1 };
        setMarquee(m);
        // Compute which keyframes fall inside.
        const refs = keysInRect(scene, expanded, soloChannels, timeToX, m);
        selectKeyframes(refs);
      },
      () => {
        setMarquee(null);
        if (!moved) clearSel();
      },
    );
  };

  return (
    <div
      ref={tracksRef}
      className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      onPointerDown={onTracksDown}
    >
      <PlayheadLine x={playheadX} />
      {/* End-of-composition shade */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 z-0 bg-ink-950/40"
        style={{ left: timeToX(duration), right: 0 }}
      />

      {scene.layers
        .slice()
        .reverse()
        .map((layer) => (
          <TrackGroup
            key={layer.id}
            layer={layer}
            expanded={!!expanded[layer.id]}
            solo={soloChannels[layer.id]}
            duration={duration}
            timeToX={timeToX}
            xToTime={xToTime}
          />
        ))}
      <div style={{ width: contentW }} />

      {marquee && (
        <div
          className="pointer-events-none absolute z-40 border border-brand-400/70 bg-brand-400/10"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
    </div>
  );
}

function TrackGroup({
  layer,
  expanded,
  solo,
  duration,
  timeToX,
  xToTime,
}: {
  layer: Layer;
  expanded: boolean;
  solo: string[] | undefined;
  duration: number;
  timeToX: (t: number) => number;
  xToTime: (clientX: number) => number;
}) {
  const channels = layerChannels(layer).filter(
    (ch) => !solo || solo.length === 0 || solo.includes(ch.path),
  );
  return (
    <div>
      <ClipBar layer={layer} timeToX={timeToX} duration={duration} xToTime={xToTime} />
      {expanded &&
        channels.map((ch) => (
          <KeyframeLane
            key={ch.path}
            layer={layer}
            channel={ch}
            timeToX={timeToX}
            xToTime={xToTime}
            duration={duration}
          />
        ))}
    </div>
  );
}

function ClipBar({
  layer,
  timeToX,
  duration,
  xToTime,
}: {
  layer: Layer;
  timeToX: (t: number) => number;
  duration: number;
  xToTime: (clientX: number) => number;
}) {
  const updateLayer = useStore((s) => s.updateLayer);
  const beginChange = useStore((s) => s.beginChange);
  const selectLayer = useStore((s) => s.selectLayer);
  const selected = useStore((s) => s.selectedLayerId === layer.id);

  const dragBody = (e: React.PointerEvent) => {
    e.stopPropagation();
    selectLayer(layer.id);
    beginChange();
    const startT = xToTime(e.clientX);
    const s0 = layer.timing.start;
    const len = layer.timing.end - layer.timing.start;
    startDrag((ev) => {
      const dt = xToTime(ev.clientX) - startT;
      let ns = Math.max(0, s0 + dt);
      if (ns + len > duration) ns = duration - len;
      updateLayer(layer.id, (l) => {
        l.timing.start = ns;
        l.timing.end = ns + len;
      }, true);
    });
  };

  const dragEdge = (side: "start" | "end") => (e: React.PointerEvent) => {
    e.stopPropagation();
    beginChange();
    startDrag((ev) => {
      const t = xToTime(ev.clientX);
      updateLayer(layer.id, (l) => {
        if (side === "start") l.timing.start = Math.min(t, l.timing.end - 0.1);
        else l.timing.end = Math.max(t, l.timing.start + 0.1);
      }, true);
    });
  };

  const left = timeToX(layer.timing.start);
  const width = Math.max(4, timeToX(layer.timing.end) - timeToX(layer.timing.start));

  return (
    <div className="relative border-b border-ink-800" style={{ height: ROW_H }}>
      <div
        onPointerDown={dragBody}
        className={`absolute top-1.5 cursor-grab rounded border active:cursor-grabbing ${
          selected
            ? "border-brand-400/60 bg-brand-500/25"
            : "border-ink-500 bg-ink-650 hover:bg-ink-600"
        }`}
        style={{ left, width, height: ROW_H - 12 }}
      >
        <div
          onPointerDown={dragEdge("start")}
          className="lm-resize-x absolute left-0 top-0 h-full w-1.5 rounded-l bg-white/15"
        />
        <div
          onPointerDown={dragEdge("end")}
          className="lm-resize-x absolute right-0 top-0 h-full w-1.5 rounded-r bg-white/15"
        />
      </div>
    </div>
  );
}

function KeyframeLane({
  layer,
  channel,
  timeToX,
  xToTime,
  duration,
}: {
  layer: Layer;
  channel: ChannelDef;
  timeToX: (t: number) => number;
  xToTime: (clientX: number) => number;
  duration: number;
}) {
  const updateKeyframe = useStore((s) => s.updateKeyframe);
  const beginChange = useStore((s) => s.beginChange);
  const selectKeyframe = useStore((s) => s.selectKeyframe);
  const addKeyframe = useStore((s) => s.addKeyframe);
  const selectedKeys = useStore((s) => s.selectedKeys);

  const ch = getChannel(layer, channel.path);
  const kfs = ch?.keyframes ?? [];

  const dragKf = (kfId: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const ref: KfRef = { layerId: layer.id, channelPath: channel.path, kfId };
    if (!useStore.getState().isKeyframeSelected(ref)) {
      selectKeyframe(ref, e.shiftKey);
    }
    beginChange();
    startDrag((ev) => {
      updateKeyframe(layer.id, channel.path, kfId, { time: xToTime(ev.clientX) }, true);
    });
  };

  const addAt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ch) return;
    const t = Math.max(0, Math.min(duration, xToTime(e.clientX)));
    addKeyframe(layer.id, channel.path, makeKf(t, evalAnimatable(ch, t), "gentle"));
  };

  return (
    <div
      className="relative border-b border-ink-800/60 bg-ink-900/40"
      style={{ height: ROW_H }}
      onDoubleClick={addAt}
      data-kf-lane={`${layer.id}|${channel.path}`}
    >
      {kfs.length > 1 && (
        <div
          className="absolute top-1/2 h-px bg-brand-400/25"
          style={{
            left: timeToX(kfs[0].time),
            width: timeToX(kfs[kfs.length - 1].time) - timeToX(kfs[0].time),
          }}
        />
      )}
      {kfs.map((k) => {
        const ref: KfRef = { layerId: layer.id, channelPath: channel.path, kfId: k.id };
        const isSel = selectedKeys.some((r) => kfKey(r) === kfKey(ref));
        return (
          <button
            key={k.id}
            onPointerDown={dragKf(k.id)}
            title={`${channel.label}: ${k.value.toFixed(1)} @ ${k.time.toFixed(2)}s · ${k.bezier ? "custom" : k.easing}`}
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border transition ${
              isSel
                ? "border-white bg-brand-300"
                : "border-brand-300 bg-brand-500 hover:bg-brand-400"
            }`}
            style={{ left: timeToX(k.time) }}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

function snap(t: number, fps: number) {
  return Math.round(t * fps) / fps;
}

/** Map the visual row layout to find keyframes inside a marquee rectangle. */
function keysInRect(
  scene: ReturnType<typeof useStore.getState>["scene"],
  expanded: Record<string, boolean>,
  soloChannels: Record<string, string[]>,
  timeToX: (t: number) => number,
  m: Marquee,
): KfRef[] {
  const x0 = Math.min(m.x0, m.x1);
  const x1 = Math.max(m.x0, m.x1);
  const y0 = Math.min(m.y0, m.y1);
  const y1 = Math.max(m.y0, m.y1);

  const refs: KfRef[] = [];
  let y = 0;
  for (const layer of scene.layers.slice().reverse()) {
    y += ROW_H; // clip bar row
    if (expanded[layer.id]) {
      const solo = soloChannels[layer.id];
      const channels = layerChannels(layer).filter(
        (ch) => !solo || solo.length === 0 || solo.includes(ch.path),
      );
      for (const ch of channels) {
        const rowTop = y;
        const rowBottom = y + ROW_H;
        const channel = getChannel(layer, ch.path);
        if (channel && rowBottom > y0 && rowTop < y1) {
          for (const k of channel.keyframes) {
            const kx = timeToX(k.time);
            if (kx >= x0 && kx <= x1) {
              refs.push({ layerId: layer.id, channelPath: ch.path, kfId: k.id });
            }
          }
        }
        y += ROW_H;
      }
    }
  }
  return refs;
}
