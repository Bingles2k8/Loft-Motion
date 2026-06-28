"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import {
  classifyFile,
  downloadSceneJson,
  importSceneJson,
  readAssetFile,
  readFileAsText,
} from "@/lib/io/file";
import { createAsset, createImageLayerFromAsset } from "@/lib/scene/factory";
import {
  IconDownload,
  IconLayers,
  IconGrid,
  IconMenu,
  IconSpark,
  IconUpload,
} from "@/components/ui/icons";

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-haze-200 transition hover:bg-ink-700"
    >
      <span className="grid h-4 w-4 place-items-center text-haze-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[10px] text-haze-500">{hint}</span>}
    </button>
  );
}

export function Toolbar() {
  const loadScene = useStore((s) => s.loadScene);
  const name = useStore((s) => s.scene.name);
  const update = useStore((s) => s.update);
  const setShowExport = useStore((s) => s.setShowExport);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const setShowExamples = useStore((s) => s.setShowExamples);
  const setShowShortcuts = useStore((s) => s.setShowShortcuts);
  const setShowAgent = useStore((s) => s.setShowAgent);
  const setShowPrinciples = useStore((s) => s.setShowPrinciples);
  const setLeftTab = useStore((s) => s.setLeftTab);

  const importInput = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const run = (fn: () => void) => () => {
    fn();
    setMenuOpen(false);
  };

  /**
   * Unified Import: a .loft.json scene loads as the project; media files are
   * added as project assets (and images also placed as a layer). Everything is
   * read locally — nothing is uploaded.
   */
  const handleImport = async (files: FileList | File[]) => {
    const store = useStore.getState();
    for (const file of Array.from(files)) {
      if (/\.(json)$/i.test(file.name)) {
        const text = await readFileAsText(file);
        const result = importSceneJson(text);
        if (result.ok && result.scene) loadScene(result.scene);
        else alert(result.error ?? "Import failed");
        continue;
      }
      const kind = classifyFile(file);
      if (kind === "unsupported") {
        alert(`"${file.name}" isn't a supported media type.`);
        continue;
      }
      const r = await readAssetFile(file);
      const asset = createAsset(kind, r.name, r.src, {
        width: r.width,
        height: r.height,
        size: r.size,
        duration: r.duration,
      });
      store.addAsset(asset);
      setLeftTab("project");
      // Images get placed into the comp immediately, like AE drag-to-comp.
      if (kind === "image") {
        store.addLayer(createImageLayerFromAsset(asset, store.scene.composition));
      }
    }
  };

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-ink-700 bg-ink-850 px-3">
      {/* Main menu — consolidates the secondary actions (Figma-style). */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          title="Menu"
          className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
            menuOpen ? "bg-ink-700 text-haze-200" : "text-haze-300 hover:bg-ink-700 hover:text-haze-200"
          }`}
        >
          <IconMenu />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-0 top-10 z-50 w-56 overflow-hidden rounded-lg border border-ink-600 bg-ink-850 py-1 shadow-xl">
              <MenuItem icon={<IconGrid width={14} height={14} />} label="Template gallery" onClick={run(() => setShowExamples(true))} />
              <MenuItem icon={<IconSpark width={14} height={14} />} label="Motion principles" onClick={run(() => setShowPrinciples(true))} />
              <MenuItem label="Keyboard shortcuts" hint="?" onClick={run(() => setShowShortcuts(true))} />
              <div className="my-1 border-t border-ink-700" />
              <MenuItem icon={<IconUpload width={14} height={14} />} label="Import media or scene…" onClick={run(() => importInput.current?.click())} />
              <MenuItem icon={<IconDownload width={14} height={14} />} label="Save scene (.loft.json)" onClick={run(() => downloadSceneJson(useStore.getState().scene))} />
              <div className="my-1 border-t border-ink-700" />
              <MenuItem label="Scene settings…" onClick={run(() => setShowSettings(true))} />
            </div>
          </>
        )}
      </div>

      {/* Brand */}
      <div className="flex items-center gap-2 pr-1">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-brand-500 text-white">
          <IconLayers width={14} height={14} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-haze-200">
          Loft Motion
        </span>
      </div>

      {/* Project name */}
      <div className="mx-2 flex-1">
        <input
          value={name}
          onChange={(e) =>
            update((s) => {
              s.name = e.target.value;
            })
          }
          className="mx-auto block w-full max-w-xs rounded-md bg-transparent px-2 py-1 text-center text-sm font-medium text-haze-300 transition hover:bg-ink-800 focus:bg-ink-800 focus:text-haze-200 focus:outline-none"
        />
      </div>

      {/* Animate from a text prompt (LLM → AnimationSpec → motion) */}
      <button
        onClick={() => setShowAgent(true)}
        title="Animate from a text prompt"
        className="flex h-8 items-center gap-1.5 rounded-md bg-gradient-to-r from-brand-500/25 to-brand-400/15 px-2.5 text-xs font-semibold text-brand-600 ring-1 ring-inset ring-brand-500/30 transition hover:from-brand-500/35 hover:to-brand-400/25"
      >
        <IconSpark width={15} height={15} />
        Prompt
      </button>

      {/* Export */}
      <button
        onClick={() => setShowExport(true)}
        className="flex h-8 items-center gap-1.5 rounded-md bg-brand-500 px-3.5 text-xs font-semibold text-white transition hover:bg-brand-400"
      >
        Export
      </button>

      {/* Hidden file input — accepts a scene JSON or any supported media. */}
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json,image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleImport(e.target.files);
          e.target.value = "";
        }}
      />
    </header>
  );
}
