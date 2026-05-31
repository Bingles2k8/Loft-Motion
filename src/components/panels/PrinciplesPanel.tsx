"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store/useStore";
import { EASINGS, EASING_NAMES } from "@/lib/anim/easing";
import { IconSpark } from "@/components/ui/icons";

/** A small SVG plot of an easing's cubic-bezier curve. */
function EasingCurve({ bezier }: { bezier: [number, number, number, number] }) {
  const [x1, y1, x2, y2] = bezier;
  const W = 48;
  const H = 48;
  // y is inverted in SVG; map value 0..1 (allow overshoot) into a padded box.
  const pad = 8;
  const sx = (x: number) => pad + x * (W - 2 * pad);
  const sy = (y: number) => H - pad - y * (H - 2 * pad);
  return (
    <svg width={W} height={H} className="rounded bg-ink-900">
      <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke="#2a2a3d" />
      <line x1={pad} y1={sy(1)} x2={W - pad} y2={sy(1)} stroke="#2a2a3d" />
      <path
        d={`M ${sx(0)} ${sy(0)} C ${sx(x1)} ${sy(y1)}, ${sx(x2)} ${sy(y2)}, ${sx(1)} ${sy(1)}`}
        fill="none"
        stroke="#957bff"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PrinciplesPanel() {
  const show = useStore((s) => s.showPrinciples);
  const setShow = useStore((s) => s.setShowPrinciples);
  const scene = useStore((s) => s.scene);

  // Live nudge: find mechanical (linear) motion across animated channels.
  const linearHits = useMemo(() => {
    const hits: { layer: string }[] = [];
    for (const l of scene.layers) {
      const channels = [
        l.transform.x,
        l.transform.y,
        l.transform.scaleX,
        l.transform.scaleY,
        l.transform.rotation,
        l.transform.opacity,
      ];
      const hasLinear = channels.some(
        (c) => c.keyframes.length > 1 && c.keyframes.some((k) => k.easing === "linear"),
      );
      if (hasLinear) hits.push({ layer: l.name });
    }
    return hits;
  }, [scene]);

  if (!show) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-ink-600 bg-ink-850 shadow-2xl">
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <IconSpark width={16} height={16} className="text-brand-300" />
          <h2 className="text-sm font-bold">Motion craft</h2>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-haze-400 transition hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <p className="text-xs leading-relaxed text-haze-300">
          Loft Motion picks tasteful easings, durations and staggers for you, so
          things look designed out of the box. Here&apos;s the <em>why</em> — turn
          it off whenever you like.
        </p>

        {/* Live nudges */}
        {linearHits.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              A gentle nudge
            </h3>
            <p className="text-[11px] leading-relaxed text-amber-100/90">
              {linearHits.map((h) => h.layer).join(", ")}{" "}
              {linearHits.length === 1 ? "has" : "have"} linear motion. Linear
              feels mechanical — try <strong>Settle</strong> or{" "}
              <strong>Gentle</strong> for a more natural stop.
            </p>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-haze-400">
            The easing library
          </h3>
          <div className="space-y-2">
            {EASING_NAMES.map((name) => {
              const e = EASINGS[name];
              return (
                <div
                  key={name}
                  className="flex gap-3 rounded-lg border border-ink-700 p-2"
                >
                  <EasingCurve bezier={e.bezier} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-haze-100">
                      {e.label}
                    </div>
                    <p className="text-[11px] leading-snug text-haze-400">
                      {e.blurb}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Principle
            title="Overlapping action & stagger"
            body="Don't move everything at once. Offsetting elements by a beat (try 0.1–0.2s) makes motion feel alive and intentional, not robotic."
          />
          <Principle
            title="Follow-through & overshoot"
            body="Real things have weight: they sail slightly past their target and settle back. That's Overshoot — use it sparingly for energy."
          />
          <Principle
            title="Ease for intent"
            body="Things arriving on screen should decelerate (ease-out / Settle). Things leaving should accelerate (ease-in). Symmetric eases read as calm."
          />
        </div>
      </div>
    </div>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-haze-100">{title}</h4>
      <p className="text-[11px] leading-relaxed text-haze-400">{body}</p>
    </div>
  );
}
