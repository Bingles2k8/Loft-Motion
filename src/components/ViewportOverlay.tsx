"use client";

import { useStore } from "@/lib/store/useStore";
import { resolveBox, hitTest, layerSize, type Vec2 } from "@/lib/render/viewport";
import type { Layer } from "@/lib/scene/schema";

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Direct-manipulation overlay over the composition viewport (After Effects-style).
 *
 * Draws the selected layer's transformed bounding box + 8 handles + anchor, and
 * implements move (drag body), scale (corner/edge handles, Shift = uniform), and
 * rotate (drag just outside a corner, Shift = 15° snap). All edits write to the
 * layer Transform via the store; if the channel is already keyframed (or
 * auto-keyframe is on) it upserts a keyframe at the playhead, otherwise it sets
 * the static value — matching AE's behaviour.
 *
 * Coordinate pipeline: pointer screen px → (− wrap offset) → comp space (÷ view
 * scale). Move/scale/rotate use the formulas from the AE interaction spec.
 */

type Handle =
  | "body"
  | "tl" | "tr" | "br" | "bl"
  | "t" | "r" | "b" | "l"
  | "rot"
  | "anchor";

export function ViewportOverlay({
  view,
  wrapRef,
}: {
  view: ViewTransform;
  wrapRef: React.RefObject<HTMLDivElement | null>;
}) {
  const scene = useStore((s) => s.scene);
  const time = useStore((s) => s.time);
  const selectedLayerId = useStore((s) => s.selectedLayerId);
  const selectLayer = useStore((s) => s.selectLayer);

  const compToScreen = (p: Vec2): Vec2 => ({
    x: p.x * view.scale + view.offsetX,
    y: p.y * view.scale + view.offsetY,
  });
  const screenToComp = (clientX: number, clientY: number): Vec2 => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.offsetX) / view.scale,
      y: (clientY - rect.top - view.offsetY) / view.scale,
    };
  };

  /** Run a pointer drag, reporting comp-space position + shift each move. */
  const drag = (
    e: React.PointerEvent,
    onMove: (compPos: Vec2, shift: boolean) => void,
  ) => {
    const move = (ev: PointerEvent) =>
      onMove(screenToComp(ev.clientX, ev.clientY), ev.shiftKey);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Click empty space → deselect; click a layer → select topmost hit.
  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = screenToComp(e.clientX, e.clientY);
    // Topmost layer first (layers render bottom-up; last = on top).
    for (let i = scene.layers.length - 1; i >= 0; i--) {
      const layer = scene.layers[i];
      if (!layer.visible) continue;
      if (hitTest(layer, time, p)) {
        selectLayer(layer.id);
        startMove(layer, e);
        return;
      }
    }
    selectLayer(null);
  };

  const layer = scene.layers.find((l) => l.id === selectedLayerId) ?? null;

  /* ---- gesture helpers ---- */
  const upsert = (
    apply: (l: Layer) => void,
    live: boolean,
  ) => {
    useStore.getState().updateLayer(selectedLayerId!, apply, live);
  };

  function writeChannel(l: Layer, path: keyof Layer["transform"], value: number) {
    const { autoKeyframe, time: t } = useStore.getState();
    const ch = l.transform[path];
    if (ch.keyframes.length > 0 || autoKeyframe) {
      const existing = ch.keyframes.find((k) => Math.abs(k.time - t) < 1e-3);
      if (existing) existing.value = value;
      else {
        ch.keyframes.push({
          id: `kf_${Math.random().toString(36).slice(2, 9)}`,
          time: t,
          value,
          easing: "gentle",
        });
        ch.keyframes.sort((a, b) => a.time - b.time);
      }
    } else {
      ch.value = value;
    }
  }

  const startMove = (l: Layer, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const store = useStore.getState();
    store.beginChange();
    const start = screenToComp(e.clientX, e.clientY);
    const box = resolveBox(l, time);
    const p0 = { x: box.anchor.x, y: box.anchor.y };
    drag(e, (cur, shift) => {
      let dx = cur.x - start.x;
      let dy = cur.y - start.y;
      if (shift) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      upsert((ly) => {
        writeChannel(ly, "x", p0.x + dx);
        writeChannel(ly, "y", p0.y + dy);
      }, true);
    });
  };

  const startScale = (l: Layer, handle: Handle, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const store = useStore.getState();
    store.beginChange();
    const tf0 = { ...l.transform };
    const box = resolveBox(l, time);
    const size = layerSize(l);
    const sx0 = box.scale.x;
    const sy0 = box.scale.y;
    const anchor = box.anchor;
    const rad = box.rotation;
    const start = screenToComp(e.clientX, e.clientY);

    // Vector from anchor to pointer in the layer's UNROTATED frame.
    const toLocal = (p: Vec2) => {
      const rel = { x: p.x - anchor.x, y: p.y - anchor.y };
      const c = Math.cos(-rad);
      const s = Math.sin(-rad);
      return { x: rel.x * c - rel.y * s, y: rel.x * s + rel.y * c };
    };
    const v0 = toLocal(start);
    const affectX = handle !== "t" && handle !== "b";
    const affectY = handle !== "l" && handle !== "r";

    drag(e, (cur, shift) => {
      const v1 = toLocal(cur);
      let rx = affectX && Math.abs(v0.x) > 1e-3 ? v1.x / v0.x : 1;
      let ry = affectY && Math.abs(v0.y) > 1e-3 ? v1.y / v0.y : 1;
      if (shift && affectX && affectY) {
        const r = Math.max(Math.abs(rx), Math.abs(ry));
        rx = Math.sign(rx || 1) * r;
        ry = Math.sign(ry || 1) * r;
      }
      upsert((ly) => {
        writeChannel(ly, "scaleX", Math.max(1, sx0 * rx * 100));
        writeChannel(ly, "scaleY", Math.max(1, sy0 * ry * 100));
      }, true);
    });
    void tf0;
    void size;
  };

  const startRotate = (l: Layer, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const store = useStore.getState();
    store.beginChange();
    const box = resolveBox(l, time);
    const anchor = box.anchor;
    const rot0 = (l.transform.rotation.keyframes.length
      ? box.rotation * (180 / Math.PI)
      : l.transform.rotation.value);
    const start = screenToComp(e.clientX, e.clientY);
    const a0 = Math.atan2(start.y - anchor.y, start.x - anchor.x);
    drag(e, (cur, shift) => {
      const a1 = Math.atan2(cur.y - anchor.y, cur.x - anchor.x);
      let deg = rot0 + ((a1 - a0) * 180) / Math.PI;
      if (shift) deg = Math.round(deg / 15) * 15;
      upsert((ly) => writeChannel(ly, "rotation", deg), true);
    });
  };

  const startAnchor = (l: Layer, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const store = useStore.getState();
    store.beginChange();
    const size = layerSize(l);
    const box = resolveBox(l, time);
    drag(e, (cur) => {
      // New anchor as a fraction of the box, derived from pointer in local space.
      const rel = { x: cur.x - box.anchor.x, y: cur.y - box.anchor.y };
      const c = Math.cos(-box.rotation);
      const s = Math.sin(-box.rotation);
      const local = {
        x: (rel.x * c - rel.y * s) / (box.scale.x || 1e-6),
        y: (rel.x * s + rel.y * c) / (box.scale.y || 1e-6),
      };
      const aLocalOld = {
        x: l.transform.anchorX.value * size.x,
        y: l.transform.anchorY.value * size.y,
      };
      const aLocalNew = {
        x: aLocalOld.x + local.x,
        y: aLocalOld.y + local.y,
      };
      // Compensate Position so the layer's pixels don't move (Pan-Behind).
      const dxLocal = (aLocalNew.x - aLocalOld.x) * box.scale.x;
      const dyLocal = (aLocalNew.y - aLocalOld.y) * box.scale.y;
      const cr = Math.cos(box.rotation);
      const sr = Math.sin(box.rotation);
      const dCompX = dxLocal * cr - dyLocal * sr;
      const dCompY = dxLocal * sr + dyLocal * cr;
      upsert((ly) => {
        ly.transform.anchorX.value = aLocalNew.x / size.x;
        ly.transform.anchorY.value = aLocalNew.y / size.y;
        writeChannel(ly, "x", box.anchor.x + dCompX);
        writeChannel(ly, "y", box.anchor.y + dCompY);
      }, true);
    });
  };

  return (
    <div
      className="absolute inset-0 z-10"
      onPointerDown={onBackgroundDown}
      style={{ cursor: "default" }}
    >
      {layer && layer.visible && (
        <SelectionBox
          layer={layer}
          time={time}
          compToScreen={compToScreen}
          onMove={(e) => startMove(layer, e)}
          onScale={(h, e) => startScale(layer, h, e)}
          onRotate={(e) => startRotate(layer, e)}
          onAnchor={(e) => startAnchor(layer, e)}
        />
      )}
    </div>
  );
}

function SelectionBox({
  layer,
  time,
  compToScreen,
  onMove,
  onScale,
  onRotate,
  onAnchor,
}: {
  layer: Layer;
  time: number;
  compToScreen: (p: Vec2) => Vec2;
  onMove: (e: React.PointerEvent) => void;
  onScale: (h: Handle, e: React.PointerEvent) => void;
  onRotate: (e: React.PointerEvent) => void;
  onAnchor: (e: React.PointerEvent) => void;
}) {
  const box = resolveBox(layer, time);
  const c = box.corners.map(compToScreen);
  const eMid = box.edges.map(compToScreen);
  const a = compToScreen(box.anchor);

  const poly = c.map((p) => `${p.x},${p.y}`).join(" ");
  const cornerHandles: Array<{ h: Handle; p: Vec2 }> = [
    { h: "tl", p: c[0] },
    { h: "tr", p: c[1] },
    { h: "br", p: c[2] },
    { h: "bl", p: c[3] },
  ];
  const edgeHandles: Array<{ h: Handle; p: Vec2 }> = [
    { h: "t", p: eMid[0] },
    { h: "r", p: eMid[1] },
    { h: "b", p: eMid[2] },
    { h: "l", p: eMid[3] },
  ];

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {/* bounding box */}
      <polygon
        points={poly}
        fill="transparent"
        stroke="#4f8fcb"
        strokeWidth={1}
      />
      {/* body move target */}
      <polygon
        points={poly}
        fill="transparent"
        className="pointer-events-auto cursor-move"
        onPointerDown={onMove}
      />

      {/* rotation ring zones just outside corners */}
      {cornerHandles.map(({ h, p }) => (
        <circle
          key={`rot-${h}`}
          cx={p.x}
          cy={p.y}
          r={12}
          fill="transparent"
          className="pointer-events-auto"
          style={{ cursor: "grab" }}
          onPointerDown={onRotate}
        />
      ))}

      {/* edge handles */}
      {edgeHandles.map(({ h, p }) => (
        <rect
          key={h}
          x={p.x - 4}
          y={p.y - 4}
          width={8}
          height={8}
          fill="#1b1b1b"
          stroke="#4f8fcb"
          strokeWidth={1}
          className="pointer-events-auto"
          style={{ cursor: h === "l" || h === "r" ? "ew-resize" : "ns-resize" }}
          onPointerDown={(e) => onScale(h, e)}
        />
      ))}

      {/* corner handles (on top of rotation zones) */}
      {cornerHandles.map(({ h, p }) => (
        <rect
          key={h}
          x={p.x - 4}
          y={p.y - 4}
          width={8}
          height={8}
          fill="#1b1b1b"
          stroke="#4f8fcb"
          strokeWidth={1}
          className="pointer-events-auto"
          style={{ cursor: h === "tl" || h === "br" ? "nwse-resize" : "nesw-resize" }}
          onPointerDown={(e) => onScale(h, e)}
        />
      ))}

      {/* anchor point */}
      <g
        className="pointer-events-auto"
        style={{ cursor: "move" }}
        onPointerDown={onAnchor}
      >
        <circle cx={a.x} cy={a.y} r={6} fill="transparent" stroke="#4f8fcb" strokeWidth={1} />
        <line x1={a.x - 8} y1={a.y} x2={a.x + 8} y2={a.y} stroke="#4f8fcb" strokeWidth={1} />
        <line x1={a.x} y1={a.y - 8} x2={a.x} y2={a.y + 8} stroke="#4f8fcb" strokeWidth={1} />
      </g>
    </svg>
  );
}
