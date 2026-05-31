"use client";

import { useStore } from "@/lib/store/useStore";

const GROUPS: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: "Playback",
    rows: [
      ["Space", "Play / pause"],
      ["Home / End", "Jump to start / end"],
      ["← / →", "Step one frame (or nudge selected keyframes)"],
    ],
  },
  {
    title: "Reveal properties (selected layer)",
    rows: [
      ["P", "Position"],
      ["S", "Scale"],
      ["R", "Rotation"],
      ["T", "Opacity"],
      ["U", "Show all properties"],
    ],
  },
  {
    title: "Editing",
    rows: [
      ["⌘/Ctrl Z", "Undo"],
      ["⌘/Ctrl ⇧ Z", "Redo"],
      ["Delete", "Delete selected keyframes / layer"],
      ["Shift G", "Toggle graph editor"],
      ["?", "This shortcuts panel"],
    ],
  },
  {
    title: "Timeline & graph",
    rows: [
      ["Drag ruler", "Scrub the playhead"],
      ["Drag empty track", "Marquee-select keyframes"],
      ["Ctrl + scroll", "Zoom the timeline"],
      ["Scroll on graph", "Zoom the value axis"],
    ],
  },
];

/** A keyboard-shortcuts cheat sheet (AE-familiar). Opened with `?`. */
export function ShortcutsPanel() {
  const show = useStore((s) => s.showShortcuts);
  const setShow = useStore((s) => s.setShowShortcuts);
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={() => setShow(false)}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
          <h2 className="text-sm font-bold text-haze-200">Keyboard Shortcuts</h2>
          <button
            onClick={() => setShow(false)}
            className="text-haze-400 transition hover:text-haze-200"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-haze-500">
                {g.title}
              </h3>
              <div className="space-y-1.5">
                {g.rows.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-haze-300">{desc}</span>
                    <kbd className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium text-haze-200">
                      {keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
