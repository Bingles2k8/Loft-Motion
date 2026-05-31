"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store/useStore";
import { Toolbar } from "@/components/Toolbar";
import { Stage } from "@/components/Stage";
import { Timeline } from "@/components/timeline/Timeline";
import { PropertiesPanel } from "@/components/panels/PropertiesPanel";
import { ExportPanel } from "@/components/panels/ExportPanel";
import { PrinciplesPanel } from "@/components/panels/PrinciplesPanel";

export function Editor() {
  const playing = useStore((s) => s.playing);

  // Playback loop — advances the playhead off the store directly so it doesn't
  // thrash React. The renderer reacts to `time` via Stage.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { time, scene, loop, setTime, pause } = useStore.getState();
      const dur = scene.composition.duration;
      let next = time + dt;
      if (next >= dur) {
        if (loop) next = next % dur;
        else {
          setTime(dur);
          pause();
          return;
        }
      }
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing =
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable;
      const s = useStore.getState();

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (typing) return;

      if (e.code === "Space") {
        e.preventDefault();
        s.togglePlay();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedKeyframe) {
          s.removeKeyframe(
            s.selectedKeyframe.layerId,
            s.selectedKeyframe.channelPath,
            s.selectedKeyframe.kfId,
          );
          s.selectKeyframe(null);
        } else if (s.selectedLayerId) {
          s.removeLayer(s.selectedLayerId);
        }
      } else if (e.key === "Home") {
        s.setTime(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-900 text-white">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Stage />
        <PropertiesPanel />
      </div>
      <div className="h-72 shrink-0 border-t border-ink-700">
        <Timeline />
      </div>
      <ExportPanel />
      <PrinciplesPanel />
    </div>
  );
}
