"use client";

import { useStore } from "@/lib/store/useStore";
import {
  createAdjustmentLayer,
  createNullLayer,
  createShapeLayer,
  createTextLayer,
} from "@/lib/scene/factory";
import {
  IconAdjust,
  IconCircle,
  IconNull,
  IconRedo,
  IconSquare,
  IconStar,
  IconText,
  IconUndo,
} from "@/components/ui/icons";

/**
 * Floating, bottom-centre toolbar — the signature UI3 element. Hosts the core
 * creation tools, history, and the Design ⇄ Motion mode toggle that reveals or
 * hides the timeline. It floats over the canvas (above the timeline in Motion
 * mode), so the work stays front and centre.
 */
function ToolButton({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-haze-300 transition hover:bg-ink-700 hover:text-haze-200 disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function BottomToolbar() {
  const addLayer = useStore((s) => s.addLayer);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-ink-600 bg-ink-850/95 px-1.5 py-1 shadow-xl backdrop-blur">
        {/* Creation tools */}
        <ToolButton title="Add rectangle" onClick={() => addLayer(createShapeLayer("rect"))}>
          <IconSquare />
        </ToolButton>
        <ToolButton title="Add ellipse" onClick={() => addLayer(createShapeLayer("ellipse"))}>
          <IconCircle />
        </ToolButton>
        <ToolButton title="Add star" onClick={() => addLayer(createShapeLayer("star"))}>
          <IconStar />
        </ToolButton>
        <ToolButton title="Add text" onClick={() => addLayer(createTextLayer())}>
          <IconText />
        </ToolButton>
        <ToolButton title="Add null (transform controller)" onClick={() => addLayer(createNullLayer())}>
          <IconNull />
        </ToolButton>
        <ToolButton title="Add adjustment layer" onClick={() => addLayer(createAdjustmentLayer())}>
          <IconAdjust />
        </ToolButton>

        <div className="mx-0.5 h-5 w-px bg-ink-600" />

        {/* History */}
        <ToolButton title="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
          <IconUndo />
        </ToolButton>
        <ToolButton title="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo}>
          <IconRedo />
        </ToolButton>

        <div className="mx-0.5 h-5 w-px bg-ink-600" />

        {/* Design ⇄ Motion mode toggle (Shift+E) */}
        <div className="flex items-center rounded-lg bg-ink-800 p-0.5" title="Toggle Design / Motion (⇧E)">
          {(["design", "motion"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition ${
                mode === m
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-haze-400 hover:text-haze-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
