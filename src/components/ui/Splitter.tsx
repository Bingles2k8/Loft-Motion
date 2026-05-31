"use client";

import { useCallback, useRef } from "react";

/**
 * A draggable divider between two docked panels (AE-style gutter). It doesn't
 * own size state — it reports deltas via `onResize`, and the parent clamps and
 * stores the new size. Vertical splitters resize horizontally (col-resize),
 * horizontal splitters resize vertically (row-resize).
 */
export function Splitter({
  orientation,
  onResize,
  onResizeStart,
  onResizeEnd,
  invert = false,
}: {
  orientation: "vertical" | "horizontal";
  /** Called with the pointer delta in px along the resize axis. */
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  /** Invert the delta sign (for panels anchored to the right/bottom). */
  invert?: boolean;
}) {
  const dragging = useRef(false);
  const last = useRef(0);

  const isVertical = orientation === "vertical";

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      last.current = isVertical ? e.clientX : e.clientY;
      onResizeStart?.();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const pos = isVertical ? ev.clientX : ev.clientY;
        let delta = pos - last.current;
        if (invert) delta = -delta;
        last.current = pos;
        onResize(delta);
      };
      const up = () => {
        dragging.current = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        onResizeEnd?.();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [isVertical, invert, onResize, onResizeStart, onResizeEnd],
  );

  return (
    <div
      onPointerDown={onPointerDown}
      className={`group relative z-20 shrink-0 ${
        isVertical
          ? "w-px cursor-col-resize self-stretch"
          : "h-px cursor-row-resize"
      } bg-ink-950`}
    >
      {/* Invisible wider hit area for easy grabbing. */}
      <div
        className={`absolute ${
          isVertical
            ? "inset-y-0 -left-1 -right-1 cursor-col-resize"
            : "inset-x-0 -top-1 -bottom-1 cursor-row-resize"
        }`}
      />
      {/* Hover highlight. */}
      <div
        className={`absolute bg-brand-500/0 transition-colors group-hover:bg-brand-500/60 ${
          isVertical ? "inset-y-0 -left-px w-0.5" : "inset-x-0 -top-px h-0.5"
        }`}
      />
    </div>
  );
}
