"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store/useStore";

export function Section({
  title,
  right,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = collapsible ? open : true;

  return (
    <div className="border-b border-ink-700 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => collapsible && setOpen((o) => !o)}
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-haze-500 transition hover:text-haze-300 disabled:cursor-default"
        >
          {collapsible && (
            <svg
              width={9}
              height={9}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          )}
          {title}
        </button>
        {right}
      </div>
      {expanded && <div className="mt-2 space-y-1.5">{children}</div>}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-20 shrink-0 text-[11px] text-haze-400">{children}</span>
  );
}

/**
 * A scrubbable + typeable number field (After Effects-style).
 *
 * Hover → `ew-resize` cursor; press-drag anywhere on the field scrubs the value
 * (Shift = fine, ×0.1). A press WITHOUT a drag focuses the field for typing and
 * selects the text. While focused/typing, scrubbing is disabled. Commits live
 * during scrub/typing and a final non-live commit on release/blur.
 */
export function NumberInput({
  value,
  onChange,
  onCommitStart,
  step = 1,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (v: number, live: boolean) => void;
  onCommitStart?: () => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(String(round(value)));
  const [editing, setEditing] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clampN = (n: number) => {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };
  useEffect(() => {
    if (!editing) setDraft(String(round(value)));
  }, [value, editing]);

  const commit = (raw: string, live: boolean) => {
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n)) return;
    onChange(clampN(n), live);
  };

  // Press → maybe-scrub. Threshold of a few px distinguishes a scrub from a
  // click; a click (no movement) focuses the input for typing.
  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || e.button !== 0) return;
    const startX = e.clientX;
    const startVal = value;
    // px-per-unit sensitivity: scale with the step so fine params scrub finely.
    const perPx = (step || 1) * (e.shiftKey ? 0.1 : 1);
    let started = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!started && Math.abs(dx) < 3) return; // tolerance before scrubbing
      if (!started) {
        started = true;
        setScrubbing(true);
        onCommitStart?.();
      }
      const next = clampN(startVal + dx * perPx);
      setDraft(String(round(next)));
      onChange(next, true);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (started) {
        setScrubbing(false);
        onChange(clampN(value), false);
      } else {
        // No drag → treat as a click: focus & select for typing.
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        readOnly={!editing}
        onFocus={() => {
          setEditing(true);
          onCommitStart?.();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value, true);
        }}
        onBlur={(e) => {
          setEditing(false);
          commit(e.target.value, false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`w-full rounded-md border bg-ink-900 px-2 py-1 text-xs tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/25 ${
          editing
            ? "border-brand-400 text-haze-200"
            : "border-ink-600 text-haze-200 hover:border-ink-500"
        } ${scrubbing ? "border-brand-400" : ""}`}
        style={editing ? undefined : { cursor: "ew-resize" }}
      />
      {/* Full-field scrub surface (only active when not typing). */}
      {!editing && (
        <div
          onPointerDown={onPointerDown}
          title="Drag to scrub · click to type · Shift for fine"
          className="lm-scrub absolute inset-0"
        />
      )}
      {suffix && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-haze-500">
          {suffix}
        </span>
      )}
    </div>
  );
}

/**
 * Colour field with optional palette-swatch binding. When the value is a
 * `@<id>` swatch reference, the field shows the resolved colour + the swatch
 * name and a "linked" state; a small dropdown binds/unbinds to palette swatches.
 */
export function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const swatches = useStore((s) => s.scene.palette.swatches);
  const [menu, setMenu] = useState(false);
  const bound = value.startsWith("@");
  const swatch = bound ? swatches.find((s) => s.id === value.slice(1)) : undefined;
  const display = bound ? swatch?.color ?? "#ffffff" : value;

  return (
    <div className="relative flex items-center gap-2">
      <label className="relative h-6 w-6 shrink-0 overflow-hidden rounded ring-1 ring-ink-600">
        <span className="absolute inset-0" style={{ background: display }} />
        {!bound && (
          <input
            type="color"
            value={normalizeHex(display)}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        )}
      </label>
      {bound ? (
        <button
          onClick={() => onChange(display)}
          title="Unbind from swatch"
          className="flex w-full items-center gap-1 rounded border border-brand-500/50 bg-brand-500/10 px-2 py-1 text-xs text-brand-300"
        >
          <IconLinkSmall />
          {swatch?.name ?? "swatch"}
        </button>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-haze-200 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
      )}
      {swatches.length > 0 && (
        <button
          onClick={() => setMenu((m) => !m)}
          title="Bind to a palette swatch"
          className={`shrink-0 transition ${bound ? "text-brand-300" : "text-haze-500 hover:text-haze-200"}`}
        >
          <IconLinkSmall />
        </button>
      )}
      {menu && swatches.length > 0 && (
        <div className="absolute right-0 top-7 z-50 w-40 rounded border border-ink-600 bg-ink-800 py-1 shadow-xl">
          {swatches.map((sw) => (
            <button
              key={sw.id}
              onClick={() => {
                onChange(`@${sw.id}`);
                setMenu(false);
              }}
              className="flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] text-haze-300 hover:bg-ink-700"
            >
              <span className="h-3 w-3 rounded-sm ring-1 ring-black/30" style={{ background: sw.color }} />
              {sw.name}
            </button>
          ))}
          {bound && (
            <button
              onClick={() => {
                onChange(display);
                setMenu(false);
              }}
              className="block w-full border-t border-ink-700 px-2 py-1 text-left text-[11px] text-haze-400 hover:bg-ink-700"
            >
              Unbind
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IconLinkSmall() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h6" />
      <path d="M10 8H7a4 4 0 0 0 0 8h3" />
      <path d="M14 8h3a4 4 0 0 1 0 8h-3" />
    </svg>
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-haze-200 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-haze-200 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
    />
  );
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}
function normalizeHex(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
}
