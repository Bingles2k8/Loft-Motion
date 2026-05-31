"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store/useStore";
import { Toolbar } from "@/components/Toolbar";
import { Stage } from "@/components/Stage";
import { Timeline } from "@/components/timeline/Timeline";
import { LeftDock } from "@/components/panels/LeftDock";
import { PropertiesPanel } from "@/components/panels/PropertiesPanel";
import { ExportPanel } from "@/components/panels/ExportPanel";
import { PrinciplesPanel } from "@/components/panels/PrinciplesPanel";
import { Splitter } from "@/components/ui/Splitter";

export function Editor() {
  const playing = useStore((s) => s.playing);
  const sizes = useStore((s) => s.sizes);
  const setPanelSize = useStore((s) => s.setPanelSize);

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
        if (s.selectedKeys.length > 0) {
          s.deleteSelection();
        } else if (s.selectedLayerId) {
          s.removeLayer(s.selectedLayerId);
        }
      } else if (e.key === "Home") {
        s.setTime(0);
      } else if (e.key === "ArrowLeft" && s.selectedKeys.length > 0) {
        e.preventDefault();
        s.beginChange();
        s.nudgeSelection(-1 / s.scene.composition.fps);
      } else if (e.key === "ArrowRight" && s.selectedKeys.length > 0) {
        e.preventDefault();
        s.beginChange();
        s.nudgeSelection(1 / s.scene.composition.fps);
      } else if (e.key.toLowerCase() === "g" && e.shiftKey) {
        s.toggleGraphMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-950 text-haze-200">
      <Toolbar />

      {/* Upper region: left dock | stage | properties */}
      <div className="flex min-h-0 flex-1">
        <div className="shrink-0" style={{ width: sizes.left }}>
          <LeftDock />
        </div>
        <Splitter
          orientation="vertical"
          value={sizes.left}
          min={200}
          max={480}
          onChange={(v) => setPanelSize("left", v)}
        />

        <Stage />

        <Splitter
          orientation="vertical"
          invert
          value={sizes.right}
          min={240}
          max={520}
          onChange={(v) => setPanelSize("right", v)}
        />
        <div className="shrink-0" style={{ width: sizes.right }}>
          <PropertiesPanel />
        </div>
      </div>

      {/* Timeline divider + timeline */}
      <Splitter
        orientation="horizontal"
        invert
        value={sizes.bottom}
        min={160}
        max={640}
        onChange={(v) => setPanelSize("bottom", v)}
      />
      <div className="shrink-0" style={{ height: sizes.bottom }}>
        <Timeline />
      </div>

      <ExportPanel />
      <PrinciplesPanel />
    </div>
  );
}
