"use client";

import type { CompatLevel, ExportTarget } from "@/lib/scene/schema";

export const LEVEL_META: Record<
  CompatLevel,
  { symbol: string; label: string; color: string; bg: string; dot: string }
> = {
  full: {
    symbol: "✓",
    label: "Exports cleanly",
    color: "text-emerald-300",
    bg: "bg-emerald-500/12",
    dot: "bg-emerald-400",
  },
  partial: {
    symbol: "!",
    label: "Degrades on export",
    color: "text-amber-300",
    bg: "bg-amber-500/12",
    dot: "bg-amber-400",
  },
  none: {
    symbol: "✕",
    label: "Dropped on export",
    color: "text-rose-300",
    bg: "bg-rose-500/12",
    dot: "bg-rose-400",
  },
};

export const TARGET_LABEL: Record<ExportTarget, string> = {
  mp4: "MP4",
  lottie: "Lottie",
  css: "CSS",
};

/** A tiny coloured dot for a single compatibility level. */
export function CompatDot({
  level,
  title,
}: {
  level: CompatLevel;
  title?: string;
}) {
  const m = LEVEL_META[level];
  return (
    <span
      title={title ?? m.label}
      className={`inline-block h-2 w-2 rounded-full ${m.dot}`}
    />
  );
}

/** A pill that summarises a layer's worst level for the active target. */
export function CompatBadge({
  level,
  target,
}: {
  level: CompatLevel;
  target: ExportTarget;
}) {
  const m = LEVEL_META[level];
  return (
    <span
      title={`${TARGET_LABEL[target]}: ${m.label}`}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${m.bg} ${m.color}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.symbol}
    </span>
  );
}
