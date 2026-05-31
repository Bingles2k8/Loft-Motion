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

/** Per-target glyph shown alongside the status icon (MP4 / Lottie / CSS). */
export const TARGET_GLYPH: Record<ExportTarget, string> = {
  mp4: "MP4",
  lottie: "LOT",
  css: "CSS",
};

/**
 * A small status icon for one compatibility level (the 3 states):
 *  full  → check, partial → warning triangle, none → blocked circle.
 * Keeps the existing colour scheme (emerald / amber / rose).
 */
export function CompatStatusIcon({
  level,
  size = 12,
}: {
  level: CompatLevel;
  size?: number;
}) {
  const m = LEVEL_META[level];
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <span className={`inline-flex ${m.color}`}>
      {level === "full" && (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" strokeWidth={1.6} opacity={0.5} />
          <path d="M8 12.5l2.5 2.5 5-5.5" />
        </svg>
      )}
      {level === "partial" && (
        <svg {...common}>
          <path d="M12 3l9.5 16.5H2.5L12 3z" strokeWidth={1.8} />
          <path d="M12 10v4" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      )}
      {level === "none" && (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <path d="M7 7l10 10" />
        </svg>
      )}
    </span>
  );
}

/**
 * A compact per-target chip: the target name + its status icon. Used in the
 * Effects panel (replacing the dots) and the Export-compatibility section.
 */
export function CompatTargetIcon({
  target,
  level,
  showLabel = true,
}: {
  target: ExportTarget;
  level: CompatLevel;
  showLabel?: boolean;
}) {
  const m = LEVEL_META[level];
  return (
    <span
      title={`${TARGET_LABEL[target]}: ${m.label}`}
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold tracking-wide ${m.bg} ${m.color}`}
    >
      {showLabel && <span>{TARGET_GLYPH[target]}</span>}
      <CompatStatusIcon level={level} size={10} />
    </span>
  );
}

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
