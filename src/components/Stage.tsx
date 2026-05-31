"use client";

import { useEffect, useRef, useState } from "react";
import { SceneRenderer } from "@/lib/render/renderer";
import { useStore } from "@/lib/store/useStore";

/**
 * The canvas surface. Owns a single SceneRenderer instance and drives it from
 * the store: structural scene changes call `setScene`, and the playhead time
 * calls `renderAt`. The canvas keeps the composition's native resolution and is
 * scaled with CSS to fit the viewport.
 */
export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [ready, setReady] = useState(false);

  const scene = useStore((s) => s.scene);
  const time = useStore((s) => s.time);
  const compW = scene.composition.width;
  const compH = scene.composition.height;
  const compBg = scene.composition.background;

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

  // Fit-to-viewport scaling.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const pad = 48;
      const cw = wrap.clientWidth - pad;
      const ch = wrap.clientHeight - pad;
      const scale = Math.min(cw / compW, ch / compH, 1);
      canvas.style.width = `${Math.round(compW * scale)}px`;
      canvas.style.height = `${Math.round(compH * scale)}px`;
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
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 40%, rgba(124,92,255,0.06), transparent 60%)",
      }}
    >
      <div
        className="rounded-md shadow-2xl shadow-black/60 ring-1 ring-white/5"
        style={{ background: compBg }}
      >
        <canvas ref={canvasRef} className="block rounded-md" />
      </div>
      <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] font-medium text-haze-400">
        {compW} × {compH} · {scene.composition.fps}fps · {scene.composition.duration}s
      </div>
    </div>
  );
}
