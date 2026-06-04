"use client";

import { useStore } from "@/lib/store/useStore";
import { uid } from "@/lib/scene/factory";
import type { Swatch } from "@/lib/scene/schema";
import { PanelHeader } from "@/components/panels/ProjectPanel";
import { IconTrash } from "@/components/ui/icons";

/** Curated palette themes for one-click hot-swapping. */
const THEMES: Array<{ name: string; colors: string[] }> = [
  { name: "Loft", colors: ["#4f8fcb", "#58c8d6", "#5cb88a", "#d6a14f", "#d96a8f"] },
  { name: "Sunset", colors: ["#ff6b6b", "#ff9f45", "#ffd93d", "#f8a5c2", "#6c5ce7"] },
  { name: "Mono", colors: ["#f2f2f2", "#b6b6b6", "#7a7a7a", "#3a3a3a", "#161616"] },
  { name: "Neon", colors: ["#39ff14", "#00e5ff", "#ff00e5", "#faff00", "#7c4dff"] },
  { name: "Pastel", colors: ["#a8e6cf", "#dcedc1", "#ffd3b6", "#ffaaa5", "#c5a3ff"] },
  { name: "Ocean", colors: ["#012a4a", "#2a6f97", "#468faf", "#61a5c2", "#a9d6e5"] },
];

/**
 * Palette panel — shared styles / global colours (Cavalry-style).
 *
 * Layers reference swatches via `@<id>`, so editing a swatch — or applying a
 * theme — re-themes the whole composition at once.
 */
export function PalettePanel() {
  const swatches = useStore((s) => s.scene.palette.swatches);
  const addSwatch = useStore((s) => s.addSwatch);
  const removeSwatch = useStore((s) => s.removeSwatch);
  const updateSwatch = useStore((s) => s.updateSwatch);
  const beginChange = useStore((s) => s.beginChange);
  const applyPaletteTheme = useStore((s) => s.applyPaletteTheme);

  const addFromTheme = (colors: string[]) => {
    // If empty, create swatches from the theme; otherwise hot-swap in place.
    if (swatches.length === 0) {
      colors.forEach((color, i) =>
        addSwatch({ id: uid("sw"), name: `Color ${i + 1}`, color }),
      );
    } else {
      applyPaletteTheme(colors.map((color) => ({ id: "", name: "", color })));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Palette">
        <button
          onClick={() => addSwatch({ id: uid("sw"), name: `Color ${swatches.length + 1}`, color: "#4f8fcb" })}
          className="rounded bg-ink-650 px-2 py-1 text-[11px] font-medium text-haze-200 transition hover:bg-ink-600"
        >
          + Swatch
        </button>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto">
        {/* Swatches */}
        <div className="border-b border-ink-700 p-2">
          {swatches.length === 0 ? (
            <p className="px-1 py-2 text-[11px] leading-relaxed text-haze-500">
              Add swatches, then bind a layer&apos;s colour to one (the link icon
              by any colour field). Editing a swatch re-themes every layer using
              it — or apply a theme below to recolour the whole comp at once.
            </p>
          ) : (
            <div className="space-y-1.5">
              {swatches.map((sw) => (
                <SwatchRow
                  key={sw.id}
                  swatch={sw}
                  onColor={(v, live) =>
                    updateSwatch(sw.id, (s) => (s.color = v), live)
                  }
                  onColorStart={beginChange}
                  onName={(v) => updateSwatch(sw.id, (s) => (s.name = v))}
                  onRemove={() => removeSwatch(sw.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Themes */}
        <div className="p-2">
          <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-haze-500">
            Themes — {swatches.length === 0 ? "create palette" : "hot-swap"}
          </h3>
          <div className="space-y-1">
            {THEMES.map((theme) => (
              <button
                key={theme.name}
                onClick={() => addFromTheme(theme.colors)}
                className="flex w-full items-center gap-2 rounded border border-ink-700 px-2 py-1.5 transition hover:border-brand-500/50 hover:bg-ink-800"
              >
                <span className="flex gap-0.5">
                  {theme.colors.map((c) => (
                    <span
                      key={c}
                      className="h-4 w-4 rounded-sm ring-1 ring-black/30"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="text-[11px] text-haze-300">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        <BrandKit />
      </div>
    </div>
  );
}

const BRAND_KEY = "loft.brandKit.v1";

/**
 * Brand kit — persist the current palette to localStorage and re-apply it to
 * any future project in one click. (Local-first: nothing leaves the device.)
 */
function BrandKit() {
  const swatches = useStore((s) => s.scene.palette.swatches);
  const addSwatch = useStore((s) => s.addSwatch);
  const removeSwatch = useStore((s) => s.removeSwatch);

  const save = () => {
    try {
      window.localStorage.setItem(BRAND_KEY, JSON.stringify(swatches));
    } catch {
      /* ignore */
    }
  };
  const apply = () => {
    try {
      const raw = window.localStorage.getItem(BRAND_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Swatch[];
      // Replace current swatches with the brand kit.
      for (const s of [...swatches]) removeSwatch(s.id);
      for (const s of saved) addSwatch({ id: uid("sw"), name: s.name, color: s.color });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="border-t border-ink-700 p-2">
      <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-haze-500">
        Brand kit
      </h3>
      <div className="flex gap-1">
        <button
          onClick={save}
          className="flex-1 rounded bg-ink-700 px-2 py-1.5 text-[11px] text-haze-200 transition hover:bg-ink-600"
        >
          Save current
        </button>
        <button
          onClick={apply}
          className="flex-1 rounded bg-ink-700 px-2 py-1.5 text-[11px] text-haze-200 transition hover:bg-ink-600"
        >
          Apply to project
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-haze-500">
        Saves this palette on your device, ready to drop into any project.
      </p>
    </div>
  );
}

function SwatchRow({
  swatch,
  onColor,
  onColorStart,
  onName,
  onRemove,
}: {
  swatch: Swatch;
  onColor: (v: string, live: boolean) => void;
  onColorStart: () => void;
  onName: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-2">
      <label className="relative h-7 w-7 shrink-0 overflow-hidden rounded ring-1 ring-ink-600">
        <span className="absolute inset-0" style={{ background: swatch.color }} />
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(swatch.color) ? swatch.color : "#000000"}
          onPointerDown={onColorStart}
          onChange={(e) => onColor(e.target.value, true)}
          onBlur={(e) => onColor(e.target.value, false)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <input
        value={swatch.name}
        onChange={(e) => onName(e.target.value)}
        className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-haze-200 focus:border-brand-400 focus:outline-none"
      />
      <code className="text-[9px] text-haze-500">@{swatch.id.slice(3, 9)}</code>
      <button
        onClick={onRemove}
        className="text-haze-500 opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
      >
        <IconTrash width={13} height={13} />
      </button>
    </div>
  );
}
