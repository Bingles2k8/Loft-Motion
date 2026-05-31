"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore, kfKey, type KfRef } from "@/lib/store/useStore";
import { keyframeBezier } from "@/lib/anim/evaluate";
import { sampleCurve, type Bezier } from "@/lib/anim/curve";
import { getChannel } from "@/lib/scene/paths";
import { layerChannels, startDrag } from "@/components/timeline/shared";
import type { Keyframe } from "@/lib/scene/schema";

/**
 * The Graph Editor — AE-style value curves with draggable bezier handles.
 *
 * X axis = time (shared with the timeline ruler). Y axis = property value,
 * auto-fit to the visible animated channels. Each keyframe is a point; selecting
 * one reveals its outgoing/incoming bezier handles. Dragging a handle reshapes
 * the segment's easing (writing a custom `bezier` onto the keyframe), which the
 * shared evaluation path and every exporter honour.
 */

interface ChannelCurve {
  layerId: string;
  channelPath: string;
  label: string;
  color: string;
  keyframes: Keyframe[];
}

const CHANNEL_COLORS = [
  "#4f8fcb",
  "#58c8d6",
  "#d6a14f",
  "#5cb88a",
  "#d96a8f",
  "#b6b6b6",
];

export function GraphEditor({ timeToX }: { timeToX: (t: number) => number }) {
  const scene = useStore((s) => s.scene);
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const soloChannels = useStore((s) => s.soloChannels);
  const selectedKeys = useStore((s) => s.selectedKeys);
  const selectKeyframe = useStore((s) => s.selectKeyframe);
  const updateKeyframe = useStore((s) => s.updateKeyframe);
  const beginChange = useStore((s) => s.beginChange);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 240 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Build the curves to display: animated channels of the selected layer, or of
  // all layers whose keyframes are currently selected.
  const curves: ChannelCurve[] = useMemo(() => {
    const out: ChannelCurve[] = [];
    let colorIdx = 0;
    const layersToShow = selectedLayerId
      ? scene.layers.filter((l) => l.id === selectedLayerId)
      : scene.layers;
    for (const layer of layersToShow) {
      const solo = soloChannels[layer.id];
      for (const ch of layerChannels(layer)) {
        if (solo && solo.length > 0 && !solo.includes(ch.path)) continue;
        const channel = getChannel(layer, ch.path);
        if (channel && channel.keyframes.length > 1) {
          out.push({
            layerId: layer.id,
            channelPath: ch.path,
            label: `${layer.name} · ${ch.label}`,
            color: CHANNEL_COLORS[colorIdx % CHANNEL_COLORS.length],
            keyframes: channel.keyframes,
          });
          colorIdx++;
        }
      }
    }
    return out;
  }, [scene, selectedLayerId, soloChannels]);

  // Auto-fit value range across all displayed curves.
  const valueRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const c of curves) {
      for (const k of c.keyframes) {
        min = Math.min(min, k.value);
        max = Math.max(max, k.value);
      }
    }
    if (!isFinite(min)) {
      min = 0;
      max = 100;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.12;
    return { min: min - pad, max: max + pad };
  }, [curves]);

  const padTop = 16;
  const padBottom = 16;
  const plotH = Math.max(40, size.h - padTop - padBottom);

  const valueToY = (v: number) =>
    padTop + plotH - ((v - valueRange.min) / (valueRange.max - valueRange.min)) * plotH;

  if (curves.length === 0) {
    return (
      <div
        ref={wrapRef}
        className="relative flex h-full items-center justify-center text-xs text-haze-500"
      >
        Select a layer with keyframes to shape its curves here.
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative h-full overflow-hidden lm-noselect">
      <svg
        width={size.w}
        height={size.h}
        className="absolute inset-0"
      >
        {/* horizontal value gridlines */}
        {gridLines(valueRange).map((v) => (
          <g key={v}>
            <line
              x1={0}
              x2={size.w}
              y1={valueToY(v)}
              y2={valueToY(v)}
              stroke="#2b2b2b"
            />
            <text x={4} y={valueToY(v) - 2} fill="#6e6e6e" fontSize={9}>
              {Math.round(v)}
            </text>
          </g>
        ))}

        {curves.map((c) => (
          <CurvePath
            key={`${c.layerId}|${c.channelPath}`}
            curve={c}
            timeToX={timeToX}
            valueToY={valueToY}
          />
        ))}

        {/* Segment handles — drawn when EITHER endpoint of the segment is
            selected, so selecting any keyframe reveals the handles touching it. */}
        {curves.map((c) =>
          c.keyframes.slice(0, -1).map((kf, i) => {
            const next = c.keyframes[i + 1];
            const refA: KfRef = { layerId: c.layerId, channelPath: c.channelPath, kfId: kf.id };
            const refB: KfRef = { layerId: c.layerId, channelPath: c.channelPath, kfId: next.id };
            const aSel = selectedKeys.some((r) => kfKey(r) === kfKey(refA));
            const bSel = selectedKeys.some((r) => kfKey(r) === kfKey(refB));
            if (!aSel && !bSel) return null;
            return (
              <SegmentHandles
                key={`seg_${kf.id}`}
                kf={kf}
                next={next}
                color={c.color}
                timeToX={timeToX}
                valueToY={valueToY}
                onHandle={(bezier, live) =>
                  updateKeyframe(refA.layerId, refA.channelPath, refA.kfId, { bezier }, live)
                }
                onHandleStart={beginChange}
              />
            );
          }),
        )}

        {/* Keyframe diamonds (on top of handles). */}
        {curves.map((c) =>
          c.keyframes.map((kf) => {
            const ref: KfRef = { layerId: c.layerId, channelPath: c.channelPath, kfId: kf.id };
            const selected = selectedKeys.some((r) => kfKey(r) === kfKey(ref));
            const x = timeToX(kf.time);
            const y = valueToY(kf.value);
            return (
              <rect
                key={kf.id}
                x={x - 4}
                y={y - 4}
                width={8}
                height={8}
                transform={`rotate(45 ${x} ${y})`}
                fill={selected ? c.color : "#1b1b1b"}
                stroke={c.color}
                strokeWidth={1.5}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  selectKeyframe(ref, e.shiftKey);
                }}
              />
            );
          }),
        )}
      </svg>

      <div className="pointer-events-none absolute left-2 top-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {curves.map((c) => (
          <span
            key={`${c.layerId}|${c.channelPath}`}
            className="flex items-center gap-1 text-[10px] text-haze-400"
          >
            <span
              className="inline-block h-1.5 w-3 rounded-full"
              style={{ background: c.color }}
            />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CurvePath({
  curve,
  timeToX,
  valueToY,
}: {
  curve: ChannelCurve;
  timeToX: (t: number) => number;
  valueToY: (v: number) => number;
}) {
  const kfs = curve.keyframes;
  let d = "";
  for (let i = 0; i < kfs.length - 1; i++) {
    const k0 = kfs[i];
    const k1 = kfs[i + 1];
    const bez = keyframeBezier(k0);
    const samples = sampleCurve(bez, 20);
    samples.forEach(([p, e], si) => {
      const t = k0.time + (k1.time - k0.time) * p;
      const v = k0.value + (k1.value - k0.value) * e;
      const x = timeToX(t);
      const y = valueToY(v);
      d += `${i === 0 && si === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
    });
  }
  return <path d={d} fill="none" stroke={curve.color} strokeWidth={1.5} />;
}

/**
 * The two bezier influence handles for one segment (kf → next). cp1 controls
 * the ease-out of `kf`, cp2 the ease-in of `next`. They're expressed in the
 * segment's normalised [0,1] space (time × progress), matching CSS cubic-bezier.
 */
function SegmentHandles({
  kf,
  next,
  color,
  timeToX,
  valueToY,
  onHandle,
  onHandleStart,
}: {
  kf: Keyframe;
  next: Keyframe;
  color: string;
  timeToX: (t: number) => number;
  valueToY: (v: number) => number;
  onHandle: (bezier: Bezier, live: boolean) => void;
  onHandleStart: () => void;
}) {
  const bez = keyframeBezier(kf);
  const segDx = next.time - kf.time;
  const segDv = next.value - kf.value;
  const x0 = timeToX(kf.time);
  const v0 = valueToY(kf.value);
  const pxPerNormX = timeToX(kf.time + segDx) - x0;
  const pxPerNormY = valueToY(kf.value + segDv) - v0;

  const cp1x = timeToX(kf.time + bez[0] * segDx);
  const cp1y = valueToY(kf.value + bez[1] * segDv);
  const cp2x = timeToX(kf.time + bez[2] * segDx);
  const cp2y = valueToY(kf.value + bez[3] * segDv);
  const ax = timeToX(kf.time);
  const ay = valueToY(kf.value);
  const bx = timeToX(next.time);
  const by = valueToY(next.value);

  const dragHandle = (which: "cp1" | "cp2") => (e: React.PointerEvent) => {
    e.stopPropagation();
    onHandleStart();
    const svg = (e.currentTarget as Element).closest("svg")!;
    const rect = svg.getBoundingClientRect();
    startDrag((ev) => {
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const nx = clamp01((sx - x0) / (pxPerNormX || 1));
      const ny = (sy - v0) / (pxPerNormY || 1);
      const b: Bezier =
        which === "cp1" ? [nx, ny, bez[2], bez[3]] : [bez[0], bez[1], nx, ny];
      onHandle(b, true);
    });
  };

  return (
    <g>
      <line x1={ax} y1={ay} x2={cp1x} y2={cp1y} stroke={color} strokeWidth={1} opacity={0.5} />
      <line x1={bx} y1={by} x2={cp2x} y2={cp2y} stroke={color} strokeWidth={1} opacity={0.5} />
      <circle
        cx={cp1x}
        cy={cp1y}
        r={4}
        fill="#1b1b1b"
        stroke={color}
        strokeWidth={1.5}
        className="cursor-grab"
        onPointerDown={dragHandle("cp1")}
      />
      <circle
        cx={cp2x}
        cy={cp2y}
        r={4}
        fill="#1b1b1b"
        stroke={color}
        strokeWidth={1.5}
        className="cursor-grab"
        onPointerDown={dragHandle("cp2")}
      />
    </g>
  );
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function gridLines(range: { min: number; max: number }): number[] {
  const span = range.max - range.min;
  const step = niceValueStep(span);
  const start = Math.ceil(range.min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= range.max; v += step) out.push(v);
  return out;
}
function niceValueStep(span: number) {
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return step * mag;
}
