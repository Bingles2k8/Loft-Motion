"use client";

import { useRef } from "react";
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
      className="flex h-8 w-8 items-center justify-center rounded text-haze-300 transition hover:bg-ink-700 hover:text-haze-200 disabled:cursor-default disabled:opacity-30"
    >
      {children}
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
  const showPrinciples = useStore((s) => s.showPrinciples);
  const setLeftTab = useStore((s) => s.setLeftTab);

  const importInput = useRef<HTMLInputElement>(null);

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
      {/* Hamburger → scene settings */}
      <ToolButton title="Scene settings" onClick={() => setShowSettings(true)}>
        <IconMenu />
      </ToolButton>

      {/* Brand */}
      <div className="flex items-center gap-2 pr-1">
        <div className="grid h-6 w-6 place-items-center rounded bg-brand-500 text-white">
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
          className="mx-auto block w-full max-w-xs rounded bg-transparent px-2 py-1 text-center text-sm font-medium text-haze-300 transition hover:bg-ink-800 focus:bg-ink-800 focus:text-haze-200 focus:outline-none"
        />
      </div>

      {/* Animate from a text prompt (LLM → AnimationSpec → motion) */}
      <button
        onClick={() => setShowAgent(true)}
        title="Animate from a text prompt"
        className="flex h-8 items-center gap-1.5 rounded bg-gradient-to-r from-brand-500/25 to-brand-400/15 px-2.5 text-xs font-semibold text-brand-200 ring-1 ring-inset ring-brand-500/30 transition hover:from-brand-500/35 hover:to-brand-400/25 hover:text-brand-100"
      >
        <IconSpark width={15} height={15} />
        Prompt
      </button>

      {/* Principles toggle */}
      <button
        onClick={() => setShowPrinciples(!showPrinciples)}
        title="Motion principles"
        className={`flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition ${
          showPrinciples
            ? "bg-brand-500/20 text-brand-300"
            : "text-haze-300 hover:bg-ink-700 hover:text-haze-200"
        }`}
      >
        <IconSpark width={15} height={15} />
        Craft
      </button>

      {/* Example projects */}
      <button
        onClick={() => setShowExamples(true)}
        title="Example projects"
        className="flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium text-haze-300 transition hover:bg-ink-700 hover:text-haze-200"
      >
        <IconGrid width={15} height={15} />
        Examples
      </button>

      {/* Keyboard shortcuts */}
      <ToolButton title="Keyboard shortcuts (?)" onClick={() => setShowShortcuts(true)}>
        <span className="text-sm font-semibold">?</span>
      </ToolButton>

      {/* Import (scene JSON or media) / save scene */}
      <ToolButton
        title="Import media or scene"
        onClick={() => importInput.current?.click()}
      >
        <IconUpload />
      </ToolButton>
      <ToolButton
        title="Save scene (.loft.json)"
        onClick={() => downloadSceneJson(useStore.getState().scene)}
      >
        <IconDownload />
      </ToolButton>

      {/* Export */}
      <button
        onClick={() => setShowExport(true)}
        className="ml-1 flex h-8 items-center gap-1.5 rounded bg-brand-500 px-3.5 text-xs font-semibold text-white transition hover:bg-brand-400"
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
