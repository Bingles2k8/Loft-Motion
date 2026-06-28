"use client";

import { useStore } from "@/lib/store/useStore";
import { LayersPanel } from "@/components/panels/LayersPanel";
import { ProjectPanel } from "@/components/panels/ProjectPanel";
import { EffectsPanel } from "@/components/panels/EffectsPanel";
import { BehaviorsBrowsePanel } from "@/components/panels/BehaviorsBrowsePanel";
import { PalettePanel } from "@/components/panels/PalettePanel";

const TABS = [
  { id: "layers", label: "Layers" },
  { id: "project", label: "Assets" },
  { id: "effects", label: "Effects" },
  { id: "behaviors", label: "Behaviors" },
  { id: "palette", label: "Palette" },
] as const;

/** Tabbed left column: Layers ⇄ Assets ⇄ Effects ⇄ Behaviors ⇄ Palette. */
export function LeftDock() {
  const leftTab = useStore((s) => s.leftTab);
  const setLeftTab = useStore((s) => s.setLeftTab);

  return (
    <div className="flex h-full flex-col bg-ink-850">
      <div className="flex shrink-0 border-b border-ink-700 bg-ink-900">
        {TABS.map((t) => (
          <Tab key={t.id} active={leftTab === t.id} onClick={() => setLeftTab(t.id)}>
            {t.label}
          </Tab>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {leftTab === "layers" && <LayersPanel />}
        {leftTab === "project" && <ProjectPanel />}
        {leftTab === "effects" && <EffectsPanel />}
        {leftTab === "behaviors" && <BehaviorsBrowsePanel />}
        {leftTab === "palette" && <PalettePanel />}
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 px-1 py-2 text-[11px] font-medium transition ${
        active
          ? "bg-ink-850 text-haze-200"
          : "text-haze-500 hover:text-haze-300"
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-px bg-brand-500" />}
    </button>
  );
}
