"use client";

import { useEffect, useState } from "react";

export function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-ink-700 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-haze-400">
          {title}
        </h3>
        {right}
      </div>
      <div className="space-y-2">{children}</div>
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

/** A debounced-ish controlled number input (commits on blur/enter + live). */
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
  useEffect(() => {
    if (!editing) setDraft(String(round(value)));
  }, [value, editing]);

  const commit = (raw: string, live: boolean) => {
    let n = Number.parseFloat(raw);
    if (Number.isNaN(n)) return;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n, live);
  };

  return (
    <div className="relative flex-1">
      <input
        type="number"
        step={step}
        value={draft}
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
        className="w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-white tabular-nums focus:border-brand-400 focus:outline-none"
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-haze-500">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md ring-1 ring-ink-600">
        <span
          className="absolute inset-0"
          style={{ background: value }}
        />
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-white focus:border-brand-400 focus:outline-none"
      />
    </div>
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
      className="flex-1 rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-white focus:border-brand-400 focus:outline-none"
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
      className="w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-white focus:border-brand-400 focus:outline-none"
    />
  );
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}
function normalizeHex(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000";
}
