"use client";

import { useStore } from "@/lib/store/useStore";
import { ProjectPanel } from "@/components/panels/ProjectPanel";
import { EffectsPanel } from "@/components/panels/EffectsPanel";
import { BehaviorsBrowsePanel } from "@/components/panels/BehaviorsBrowsePanel";

/** Tabbed left column: Project ⇄ Effects ⇄ Behaviors. */
export function LeftDock() {
  const leftTab = useStore((s) => s.leftTab);
  const setLeftTab = useStore((s) => s.setLeftTab);

  return (
    <div className="flex h-full flex-col bg-ink-850">
      <div className="flex shrink-0 border-b border-ink-700 bg-ink-900">
        <Tab active={leftTab === "project"} onClick={() => setLeftTab("project")}>
          Project
        </Tab>
        <Tab active={leftTab === "effects"} onClick={() => setLeftTab("effects")}>
          Effects
        </Tab>
        <Tab active={leftTab === "behaviors"} onClick={() => setLeftTab("behaviors")}>
          Behaviors
        </Tab>
      </div>
      <div className="min-h-0 flex-1">
        {leftTab === "project" && <ProjectPanel />}
        {leftTab === "effects" && <EffectsPanel />}
        {leftTab === "behaviors" && <BehaviorsBrowsePanel />}
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
      className={`relative px-3 py-2 text-xs font-medium transition ${
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
