"use client";

import { useStore } from "@/lib/store/useStore";
import { BEHAVIOR_LIST } from "@/lib/anim/behaviorCatalog";
import { createBehavior } from "@/lib/scene/factory";
import type { BehaviorType } from "@/lib/scene/schema";
import { PanelHeader } from "@/components/panels/ProjectPanel";

/**
 * Browseable list of procedural behaviors. Click (with a layer selected) to add
 * one to that layer; it animates instantly with great defaults.
 */
export function BehaviorsBrowsePanel() {
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const addBehavior = useStore((s) => s.addBehavior);

  const apply = (type: BehaviorType) => {
    if (!selectedLayerId) return;
    addBehavior(selectedLayerId, createBehavior(type));
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Behaviors" />
      {!selectedLayerId && (
        <div className="border-b border-ink-700 bg-ink-800 px-3 py-1.5 text-[11px] text-haze-500">
          Select a layer to add behaviors to it.
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {BEHAVIOR_LIST.map((b) => (
          <button
            key={b.type}
            onClick={() => apply(b.type)}
            disabled={!selectedLayerId}
            className="flex w-full flex-col border-b border-ink-800 px-2.5 py-2 text-left transition hover:bg-ink-800 disabled:cursor-default disabled:opacity-50"
          >
            <span className="text-xs font-medium text-haze-200">{b.label}</span>
            <span className="text-[10px] text-haze-500">{b.description}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-ink-700 px-3 py-2 text-[10px] leading-relaxed text-haze-500">
        Behaviors animate with no keyframes and stack on top of each other.
        Combine with the Cloner (in a layer&apos;s properties) for the staggered
        looks in Examples.
      </div>
    </div>
  );
}
