"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import {
  EXAMPLE_CATEGORIES,
  EXAMPLE_PROJECTS,
  type ExampleCategory,
} from "@/lib/scene/examples";

type Filter = "All" | ExampleCategory;

/**
 * Template gallery — a browsable, categorised set of ready-made projects, in the
 * spirit of Figma Community templates. Filter by category; click to load one as
 * the current scene (replacing the project).
 */
export function ExamplesPanel() {
  const show = useStore((s) => s.showExamples);
  const setShow = useStore((s) => s.setShowExamples);
  const loadScene = useStore((s) => s.loadScene);
  const [filter, setFilter] = useState<Filter>("All");

  const visible = useMemo(
    () =>
      filter === "All"
        ? EXAMPLE_PROJECTS
        : EXAMPLE_PROJECTS.filter((e) => e.category === filter),
    [filter],
  );

  if (!show) return null;

  const filters: Filter[] = ["All", ...EXAMPLE_CATEGORIES];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={() => setShow(false)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-haze-200">Template Gallery</h2>
            <p className="text-[11px] text-haze-500">
              Ready-made motion templates. Filter by category and click to load.
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-haze-400 transition hover:text-haze-200"
          >
            ✕
          </button>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-1.5 border-b border-ink-700 px-5 py-2.5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                filter === f
                  ? "bg-brand-500 text-white"
                  : "bg-ink-800 text-haze-400 hover:bg-ink-700 hover:text-haze-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3">
          {visible.map((ex) => (
            <button
              key={ex.id}
              onClick={() => {
                loadScene(ex.build());
                setShow(false);
              }}
              className="group flex flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-800 text-left transition hover:border-brand-500/60 hover:bg-ink-750"
            >
              <ExamplePreview id={ex.id} />
              <div className="p-2.5">
                <div className="text-xs font-semibold text-haze-200">{ex.name}</div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-haze-500">
                  {ex.blurb}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ex.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-ink-700 px-1.5 py-0.5 text-[9px] text-haze-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A tiny CSS-animated thumbnail that hints at each project's motion — no canvas
 * needed, just a recognisable looping teaser per example id.
 */
function ExamplePreview({ id }: { id: string }) {
  return (
    <div className="relative grid h-24 place-items-center overflow-hidden bg-ink-950">
      {(() => {
        switch (id) {
          case "loading-spinner":
          case "neon-orbit":
            return (
              <div className="lm-spin h-8 w-8 rounded-full border-2 border-brand-400 border-t-transparent" />
            );
          case "pulsing-logo":
          case "bouncy-pop":
            return <div className="lm-ex-pulse h-9 w-9 rounded-lg bg-brand-400" />;
          case "audio-bars":
          case "wave-text":
            return (
              <div className="flex items-end gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="lm-ex-bar w-1.5 rounded-full bg-mint-400"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            );
          case "staggered-grid":
          case "jelly-drift":
          case "floating-particles":
            return (
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={i}
                    className="lm-ex-pulse h-2.5 w-2.5 rounded-sm bg-brand-400"
                    style={{ animationDelay: `${(i % 4) * 0.1 + Math.floor(i / 4) * 0.1}s` }}
                  />
                ))}
              </div>
            );
          case "radial-pulse":
            return <div className="lm-ex-pulse h-10 w-10 rounded-full border-2 border-mint-400" />;
          default:
            return <div className="lm-ex-pulse h-9 w-9 rounded-full bg-rose-400" />;
        }
      })()}
    </div>
  );
}
