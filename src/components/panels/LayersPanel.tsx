"use client";

import { useStore } from "@/lib/store/useStore";
import { LABEL_COLORS, type Layer, type LayerType } from "@/lib/scene/schema";
import {
  IconAdjust,
  IconEye,
  IconEyeOff,
  IconImage,
  IconNull,
  IconSquare,
  IconText,
  IconTrash,
} from "@/components/ui/icons";

function TypeIcon({ type }: { type: LayerType }) {
  const cls = "shrink-0 text-haze-500";
  switch (type) {
    case "text":
      return <IconText width={13} height={13} className={cls} />;
    case "image":
      return <IconImage width={13} height={13} className={cls} />;
    case "null":
      return <IconNull width={13} height={13} className={cls} />;
    case "adjustment":
      return <IconAdjust width={13} height={13} className={cls} />;
    default:
      return <IconSquare width={13} height={13} className={cls} />;
  }
}

/**
 * Figma-style Layers list for the left dock. Complements the timeline tracks
 * (and is the only layer list visible in Design mode, where the timeline is
 * hidden). Select, toggle visibility, and remove layers here.
 */
export function LayersPanel() {
  const layers = useStore((s) => s.scene.layers);
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const selectLayer = useStore((s) => s.selectLayer);
  const updateLayer = useStore((s) => s.updateLayer);
  const removeLayer = useStore((s) => s.removeLayer);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-ink-700 px-3 text-[10px] font-semibold uppercase tracking-wider text-haze-500">
        <span>Layers</span>
        <span className="text-haze-600">{layers.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {layers.length === 0 && (
          <p className="px-3 py-4 text-[11px] leading-relaxed text-haze-500">
            No layers yet. Add one from the toolbar at the bottom of the canvas,
            or open a template from the menu.
          </p>
        )}
        {layers
          .slice()
          .reverse()
          .map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              selected={selectedLayerId === layer.id}
              onSelect={() => selectLayer(layer.id)}
              onToggleVisible={() =>
                updateLayer(layer.id, (l) => {
                  l.visible = !l.visible;
                })
              }
              onRemove={() => removeLayer(layer.id)}
            />
          ))}
      </div>
    </div>
  );
}

function LayerRow({
  layer,
  selected,
  onSelect,
  onToggleVisible,
  onRemove,
}: {
  layer: Layer;
  selected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex h-8 cursor-pointer items-center gap-2 pl-3 pr-2 text-xs transition ${
        selected ? "bg-brand-tint/50 text-haze-200" : "text-haze-300 hover:bg-ink-800"
      }`}
    >
      {layer.label > 0 && (
        <span
          className="absolute left-0 top-0 h-full w-1"
          style={{ background: LABEL_COLORS[layer.label] }}
        />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
        title={layer.visible ? "Hide" : "Show"}
        className="text-haze-500 transition hover:text-haze-200"
      >
        {layer.visible ? <IconEye width={13} height={13} /> : <IconEyeOff width={13} height={13} />}
      </button>
      <TypeIcon type={layer.type} />
      <span className={`flex-1 truncate ${layer.visible ? "" : "opacity-40"}`}>
        {layer.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Delete layer"
        className="text-haze-500 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
      >
        <IconTrash width={13} height={13} />
      </button>
    </div>
  );
}
