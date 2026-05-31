"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import {
  EFFECT_CATEGORIES,
  EFFECT_LIST,
  effectCompat,
  type EffectDef,
} from "@/lib/effects/catalog";
import { createEffect } from "@/lib/scene/factory";
import { EXPORT_TARGETS, type EffectType } from "@/lib/scene/schema";
import { LEVEL_META, TARGET_LABEL } from "@/components/ui/compat";
import { PanelHeader } from "@/components/panels/ProjectPanel";
import { IconSearch } from "@/components/ui/icons";

/**
 * Effects panel — a browseable, searchable catalog (After Effects-style),
 * grouped by category. Double-click (or click) to apply to the selected layer.
 * Each entry shows live per-target export-compatibility dots so the honesty
 * layer reaches the user before they even commit to an effect.
 */
export function EffectsPanel() {
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const update = useStore((s) => s.update);
  const [query, setQuery] = useState("");

  const apply = (type: EffectType) => {
    if (!selectedLayerId) return;
    update((s) => {
      const l = s.layers.find((x) => x.id === selectedLayerId);
      l?.effects.push(createEffect(type));
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EFFECT_LIST.filter(
      (e) =>
        !q ||
        e.label.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Effects & Presets" />

      <div className="border-b border-ink-700 p-2">
        <div className="flex items-center gap-1.5 rounded bg-ink-900 px-2 ring-1 ring-ink-700 focus-within:ring-brand-500">
          <IconSearch width={13} height={13} className="text-haze-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search effects…"
            className="w-full bg-transparent py-1.5 text-xs text-haze-200 placeholder:text-haze-600 focus:outline-none"
          />
        </div>
      </div>

      {!selectedLayerId && (
        <div className="border-b border-ink-700 bg-ink-800 px-3 py-1.5 text-[11px] text-haze-500">
          Select a layer to apply effects to it.
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {EFFECT_CATEGORIES.map((cat) => {
          const items = filtered.filter((e) => e.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <div className="sticky top-0 z-10 bg-ink-750 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-haze-500">
                {cat}
              </div>
              {items.map((e) => (
                <EffectRow
                  key={e.type}
                  def={e}
                  disabled={!selectedLayerId}
                  onApply={() => apply(e.type)}
                />
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-haze-500">
            No effects match “{query}”.
          </div>
        )}
      </div>
    </div>
  );
}

function EffectRow({
  def,
  disabled,
  onApply,
}: {
  def: EffectDef;
  disabled: boolean;
  onApply: () => void;
}) {
  return (
    <button
      onDoubleClick={onApply}
      onClick={onApply}
      disabled={disabled}
      className="group flex w-full items-start gap-2 border-b border-ink-800 px-2.5 py-1.5 text-left transition hover:bg-ink-800 disabled:cursor-default disabled:opacity-50"
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-haze-200">{def.label}</div>
        <div className="truncate text-[10px] text-haze-500">{def.description}</div>
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-1">
        {EXPORT_TARGETS.map((t) => {
          const c = effectCompat(def.type, t);
          const m = LEVEL_META[c.level];
          return (
            <span
              key={t}
              title={`${TARGET_LABEL[t]}: ${c.note ?? m.label}`}
              className={`h-1.5 w-1.5 rounded-full ${m.dot}`}
            />
          );
        })}
      </div>
    </button>
  );
}
