"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store/useStore";
import {
  classifyFile,
  formatBytes,
  readAssetFile,
} from "@/lib/io/file";
import {
  createAsset,
  createImageLayerFromAsset,
} from "@/lib/scene/factory";
import type { Asset } from "@/lib/scene/schema";
import { IconFilm, IconImage, IconMusic, IconTrash } from "@/components/ui/icons";

/**
 * Project panel — lists every asset used in the project and accepts drag-and-drop
 * of the user's own files. Files are NEVER uploaded: each is read locally into a
 * data URL and all probing/processing happens in-browser. Drag an image asset
 * onto the canvas/timeline to add it as a layer.
 */
export function ProjectPanel() {
  const scene = useStore((s) => s.scene);
  const addAsset = useStore((s) => s.addAsset);
  const removeAsset = useStore((s) => s.removeAsset);
  const addLayer = useStore((s) => s.addLayer);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingest = async (files: FileList | File[]) => {
    setError(null);
    for (const file of Array.from(files)) {
      const kind = classifyFile(file);
      if (kind === "unsupported") {
        setError(`"${file.name}" isn't a supported media type.`);
        continue;
      }
      try {
        const r = await readAssetFile(file);
        addAsset(
          createAsset(kind, r.name, r.src, {
            width: r.width,
            height: r.height,
            size: r.size,
            duration: r.duration,
          }),
        );
      } catch {
        setError(`Couldn't read "${file.name}".`);
      }
    }
  };

  const addAssetToComp = (asset: Asset) => {
    if (asset.type === "image") {
      addLayer(createImageLayerFromAsset(asset, scene.composition));
    }
  };

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) ingest(e.dataTransfer.files);
      }}
    >
      <PanelHeader title="Project">
        <button
          onClick={() => fileInput.current?.click()}
          className="rounded bg-ink-650 px-2 py-1 text-[11px] font-medium text-haze-200 transition hover:bg-ink-600"
        >
          Import
        </button>
      </PanelHeader>

      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-750 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-haze-500">
        <span className="flex-1">Name</span>
        <span className="w-12 text-right">Size</span>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        {scene.assets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-xs text-haze-400">No assets yet.</p>
            <p className="text-[11px] leading-relaxed text-haze-500">
              Drag images, video or audio here, or click Import. Files stay on
              your device — nothing is uploaded.
            </p>
          </div>
        ) : (
          scene.assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              onAdd={() => addAssetToComp(asset)}
              onRemove={() => removeAsset(asset.id)}
            />
          ))
        )}

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-brand-400/70 bg-brand-500/10">
            <span className="text-xs font-semibold text-brand-300">
              Drop to import (stays on your device)
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-ink-700 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300">
          {error}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) ingest(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function AssetRow({
  asset,
  onAdd,
  onRemove,
}: {
  asset: Asset;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const Icon = asset.type === "image" ? IconImage : asset.type === "video" ? IconFilm : IconMusic;
  return (
    <div
      draggable={asset.type === "image"}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-loft-asset", asset.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="group flex items-center gap-2 border-b border-ink-800 px-2.5 py-1.5 transition hover:bg-ink-800"
      onDoubleClick={onAdd}
      title={asset.type === "image" ? "Drag to canvas or double-click to add" : asset.name}
    >
      {/* Thumbnail / icon */}
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded bg-ink-900 ring-1 ring-ink-700">
        {asset.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.src} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon width={16} height={16} className="text-haze-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-haze-200">{asset.name}</div>
        <div className="text-[10px] text-haze-500">
          {asset.type}
          {asset.width ? ` · ${asset.width}×${asset.height}` : ""}
          {asset.duration ? ` · ${asset.duration.toFixed(1)}s` : ""}
        </div>
      </div>
      <span className="w-12 text-right text-[10px] tabular-nums text-haze-500">
        {formatBytes(asset.size)}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 transition group-hover:opacity-100 text-haze-500 hover:text-rose-300"
        title="Remove asset"
      >
        <IconTrash width={13} height={13} />
      </button>
    </div>
  );
}

export function PanelHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-ink-700 bg-ink-850 px-2.5">
      <span className="text-xs font-semibold text-haze-200">{title}</span>
      {children}
    </div>
  );
}
