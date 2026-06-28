"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store/useStore";
import { Toolbar } from "@/components/Toolbar";
import { BottomToolbar } from "@/components/BottomToolbar";
import { Stage } from "@/components/Stage";
import { Timeline } from "@/components/timeline/Timeline";
import { LeftDock } from "@/components/panels/LeftDock";
import { PropertiesPanel } from "@/components/panels/PropertiesPanel";
import { ExportPanel } from "@/components/panels/ExportPanel";
import { PrinciplesPanel } from "@/components/panels/PrinciplesPanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { ExamplesPanel } from "@/components/panels/ExamplesPanel";
import { ShortcutsPanel } from "@/components/panels/ShortcutsPanel";
import { AgentPanel } from "@/components/panels/AgentPanel";
import { AgentBridge } from "@/components/AgentBridge";
import { Splitter } from "@/components/ui/Splitter";

export function Editor() {
  const playing = useStore((s) => s.playing);
  const sizes = useStore((s) => s.sizes);
  const setPanelSize = useStore((s) => s.setPanelSize);
  const theme = useStore((s) => s.theme);
  const mode = useStore((s) => s.mode);

  // Reflect the active theme onto <html> so the CSS variable overrides apply.
  // Light is the default (matches SSR), so only dark touches the attribute.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.dataset.theme = "dark";
    else delete root.dataset.theme;
  }, [theme]);

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
      // Copy / paste animation (⌘C / ⌘V) on the selected layer.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && !typing && s.selectedLayerId) {
        e.preventDefault();
        s.copyAnimation();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && !typing && s.selectedLayerId) {
        e.preventDefault();
        s.pasteAnimation();
        return;
      }
      if (typing) return;

      const frame = 1 / s.scene.composition.fps;
      const key = e.key.toLowerCase();

      // AE-style "reveal property" solo shortcuts on the selected layer.
      const soloProp = (path: string) => {
        if (!s.selectedLayerId) return;
        s.setExpanded(s.selectedLayerId, true);
        s.clearSoloChannels(s.selectedLayerId);
        s.toggleSoloChannel(s.selectedLayerId, path);
      };

      if (e.code === "Space") {
        e.preventDefault();
        s.togglePlay();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedKeys.length > 0) s.deleteSelection();
        else if (s.selectedLayerId) s.removeLayer(s.selectedLayerId);
      } else if (e.key === "Home") {
        s.setTime(0);
      } else if (e.key === "End") {
        s.setTime(s.scene.composition.duration);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (s.selectedKeys.length > 0) {
          s.beginChange();
          s.nudgeSelection(-frame);
        } else {
          s.setTime(Math.max(0, s.time - frame)); // step back one frame
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (s.selectedKeys.length > 0) {
          s.beginChange();
          s.nudgeSelection(frame);
        } else {
          s.setTime(Math.min(s.scene.composition.duration, s.time + frame));
        }
      } else if (key === "g" && e.shiftKey) {
        s.toggleGraphMode();
      } else if (key === "e" && e.shiftKey) {
        e.preventDefault();
        s.toggleMode();
      } else if (key === "?" || (key === "/" && e.shiftKey)) {
        e.preventDefault();
        s.setShowShortcuts(true);
      } else if (s.selectedLayerId) {
        // Single-key property reveals (AE: P/S/R/T/U).
        if (key === "p") soloProp("transform.x");
        else if (key === "s") soloProp("transform.scaleX");
        else if (key === "r") soloProp("transform.rotation");
        else if (key === "t") soloProp("transform.opacity");
        else if (key === "u") s.clearSoloChannels(s.selectedLayerId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-950 text-haze-200">
      <Toolbar />

      {/* Upper region: left dock | stage | properties (relative anchor for the
          floating bottom toolbar). */}
      <div className="relative flex min-h-0 flex-1">
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

        {/* Floating, bottom-centre toolbar (UI3). */}
        <BottomToolbar />
      </div>

      {/* Timeline — revealed only in Motion mode. */}
      {mode === "motion" && (
        <>
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
        </>
      )}

      <ExportPanel />
      <PrinciplesPanel />
      <SettingsPanel />
      <ExamplesPanel />
      <ShortcutsPanel />
      <AgentPanel />
      <AgentBridge />
    </div>
  );
}
