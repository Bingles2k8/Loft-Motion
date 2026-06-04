"use client";

import { useEffect, useRef, useState } from "react";
import { SceneRenderer } from "@/lib/render/renderer";
import { useStore } from "@/lib/store/useStore";
import {
  classifyFile,
  readAssetFile,
} from "@/lib/io/file";
import {
  createAsset,
  createImageLayerFromAsset,
} from "@/lib/scene/factory";
import { ViewportOverlay, type ViewTransform } from "@/components/ViewportOverlay";

/**
 * The canvas surface. Owns a single SceneRenderer instance and drives it from
 * the store: structural scene changes call `setScene`, and the playhead time
 * calls `renderAt`. The canvas keeps the composition's native resolution and is
 * scaled with CSS to fit the viewport. Accepts image drag-and-drop (from the OS
 * or the Project panel) and adds it as a layer — all in-browser, never uploaded.
 */
export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  /** comp→screen transform: screen = comp*scale + offset (offset relative to wrap). */
  const [view, setView] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });

  const scene = useStore((s) => s.scene);
  const time = useStore((s) => s.time);
  const showSafeZones = useStore((s) => s.showSafeZones);
  const compW = scene.composition.width;
  const compH = scene.composition.height;
  const compBg = scene.composition.background;

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const store = useStore.getState();

    // Asset dragged from the Project panel.
    const assetId = e.dataTransfer.getData("application/x-loft-asset");
    if (assetId) {
      const asset = store.scene.assets.find((a) => a.id === assetId);
      if (asset && asset.type === "image") {
        store.addLayer(createImageLayerFromAsset(asset, store.scene.composition));
      }
      return;
    }

    // Files dropped from the OS.
    for (const file of Array.from(e.dataTransfer.files)) {
      if (classifyFile(file) !== "image") continue;
      const r = await readAssetFile(file);
      const asset = createAsset("image", r.name, r.src, {
        width: r.width,
        height: r.height,
        size: r.size,
      });
      store.addAsset(asset);
      store.addLayer(
        createImageLayerFromAsset(asset, store.scene.composition),
      );
    }
  };

  // Create the renderer once.
  useEffect(() => {
    let disposed = false;
    const renderer = new SceneRenderer(useStore.getState().scene);
    rendererRef.current = renderer;
    renderer
      .init(canvasRef.current!)
      .then(() => {
        if (disposed) {
          renderer.destroy();
          return;
        }
        setReady(true);
        renderer.renderAt(useStore.getState().time);
      })
      .catch((err) => console.error("Renderer init failed:", err));
    return () => {
      disposed = true;
      setReady(false);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Apply scene changes.
  useEffect(() => {
    if (!ready || !rendererRef.current) return;
    rendererRef.current.setScene(scene);
    rendererRef.current.renderAt(useStore.getState().time);
  }, [scene, ready]);

  // Apply playhead changes.
  useEffect(() => {
    if (!ready || !rendererRef.current) return;
    rendererRef.current.renderAt(time);
  }, [time, ready]);

  // Fit-to-viewport scaling. Records the comp→screen transform for the overlay.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const pad = 48;
      const cw = wrap.clientWidth - pad;
      const ch = wrap.clientHeight - pad;
      const scale = Math.min(cw / compW, ch / compH, 1);
      const dispW = Math.round(compW * scale);
      const dispH = Math.round(compH * scale);
      canvas.style.width = `${dispW}px`;
      canvas.style.height = `${dispH}px`;
      setView({
        scale,
        offsetX: (wrap.clientWidth - dispW) / 2,
        offsetY: (wrap.clientHeight - dispH) / 2,
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [compW, compH]);

  return (
    <div
      ref={wrapRef}
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-ink-950"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div
        ref={boxRef}
        className="shadow-2xl shadow-black/50 ring-1 ring-black/40"
        style={{ background: compBg }}
      >
        <canvas ref={canvasRef} className="block" />
      </div>
      {ready && <ViewportOverlay view={view} wrapRef={wrapRef} />}
      {showSafeZones && (
        <SafeZones
          left={view.offsetX}
          top={view.offsetY}
          width={compW * view.scale}
          height={compH * view.scale}
        />
      )}
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded border-2 border-dashed border-brand-400/70 bg-brand-500/10">
          <span className="text-sm font-semibold text-brand-300">
            Drop image to add a layer
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Title/action-safe guides for social formats: a 90% action-safe box and an 80%
 * title-safe box, plus centre crosshair lines — so creators keep key content
 * away from platform UI overlays.
 */
function SafeZones({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  const inset = (pct: number) => ({
    left: left + (width * (1 - pct)) / 2,
    top: top + (height * (1 - pct)) / 2,
    width: width * pct,
    height: height * pct,
  });
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute border border-amber-400/40" style={inset(0.9)} />
      <div className="absolute border border-amber-400/25" style={inset(0.8)} />
      {/* centre lines */}
      <div
        className="absolute bg-amber-400/20"
        style={{ left: left + width / 2, top, width: 1, height }}
      />
      <div
        className="absolute bg-amber-400/20"
        style={{ left, top: top + height / 2, width, height: 1 }}
      />
    </div>
  );
}
