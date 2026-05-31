"use client";

import { useCallback } from "react";

/**
 * A draggable divider between two docked panels (AE-style gutter).
 *
 * It owns the drag math but not the state: the parent passes the current
 * `value` (a px size) plus `min`/`max`, and we report the clamped new value via
 * `onChange`. Crucially we capture the starting value at pointer-down so the
 * size accumulates correctly across the whole drag (rather than against a
 * stale render-time value).
 */
export function Splitter({
  orientation,
  value,
  min,
  max,
  onChange,
  onResizeEnd,
  invert = false,
}: {
  orientation: "vertical" | "horizontal";
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onResizeEnd?: () => void;
  /** Invert the delta sign (for panels anchored to the right/bottom). */
  invert?: boolean;
}) {
  const isVertical = orientation === "vertical";

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startPos = isVertical ? e.clientX : e.clientY;
      const startValue = value;
      document.body.style.userSelect = "none";
      document.body.style.cursor = isVertical ? "col-resize" : "row-resize";

      const move = (ev: PointerEvent) => {
        const pos = isVertical ? ev.clientX : ev.clientY;
        let delta = pos - startPos;
        if (invert) delta = -delta;
        onChange(Math.max(min, Math.min(max, startValue + delta)));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        onResizeEnd?.();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [isVertical, invert, value, min, max, onChange, onResizeEnd],
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
            ? "inset-y-0 -left-1.5 -right-1.5 cursor-col-resize"
            : "inset-x-0 -top-1.5 -bottom-1.5 cursor-row-resize"
        }`}
      />
      {/* Hover highlight. */}
      <div
        className={`pointer-events-none absolute bg-brand-500/0 transition-colors group-hover:bg-brand-500/70 ${
          isVertical ? "inset-y-0 -left-px w-0.5" : "inset-x-0 -top-px h-0.5"
        }`}
      />
    </div>
  );
}
