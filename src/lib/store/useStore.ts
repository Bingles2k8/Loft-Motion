/**
 * Loft Motion — application store (Zustand).
 *
 * Wraps the scene document with immutable updates so undo/redo is just snapshot
 * swapping. Scene mutations go through `update` (records history) or `updateLive`
 * (no history, for drag frames — pair with `beginChange` at gesture start).
 *
 * UI state (selection, playhead, panel toggles) lives here too but is kept out
 * of the history stack.
 */
"use client";

import { create } from "zustand";
import {
  type Keyframe,
  type Layer,
  type SceneDocument,
} from "@/lib/scene/schema";
import { sampleScene } from "@/lib/scene/factory";
import type { ExportTarget } from "@/lib/scene/schema";

const HISTORY_LIMIT = 100;

type Recipe = (scene: SceneDocument) => void;

export interface StoreState {
  scene: SceneDocument;
  past: SceneDocument[];
  future: SceneDocument[];

  // UI state (not in history)
  selectedLayerId: string | null;
  selectedKeyframe: { layerId: string; channelPath: string; kfId: string } | null;
  time: number;
  playing: boolean;
  loop: boolean;
  expanded: Record<string, boolean>; // per-layer deep-timeline toggle
  activeTarget: ExportTarget;
  showPrinciples: boolean;
  showExport: boolean;

  // Scene mutations
  update: (recipe: Recipe) => void;
  updateLive: (recipe: Recipe) => void;
  beginChange: () => void;
  loadScene: (scene: SceneDocument) => void;

  // Layer helpers
  selectLayer: (id: string | null) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayer: (id: string, toIndex: number) => void;
  updateLayer: (id: string, patch: (layer: Layer) => void, live?: boolean) => void;

  // Keyframes
  addKeyframe: (layerId: string, channelPath: string, kf: Keyframe) => void;
  removeKeyframe: (layerId: string, channelPath: string, kfId: string) => void;
  updateKeyframe: (
    layerId: string,
    channelPath: string,
    kfId: string,
    patch: Partial<Keyframe>,
    live?: boolean,
  ) => void;

  selectKeyframe: (
    sel: { layerId: string; channelPath: string; kfId: string } | null,
  ) => void;

  // Playback / UI
  setTime: (t: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleLoop: () => void;
  toggleExpanded: (id: string) => void;
  setActiveTarget: (t: ExportTarget) => void;
  setShowPrinciples: (v: boolean) => void;
  setShowExport: (v: boolean) => void;

  // History
  undo: () => void;
  redo: () => void;
}

const clone = (s: SceneDocument): SceneDocument =>
  typeof structuredClone === "function"
    ? structuredClone(s)
    : JSON.parse(JSON.stringify(s));

/** Resolve a dotted channel path like "transform.x" or "effects.<id>.params.strength". */
function resolveChannel(
  layer: Layer,
  path: string,
): { keyframes: Keyframe[]; container: { value: number; keyframes: Keyframe[] } } | null {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = layer;
  for (const p of parts) {
    if (node == null) return null;
    if (Array.isArray(node)) {
      node = node.find((e: { id: string }) => e.id === p);
    } else {
      node = node[p];
    }
  }
  if (!node || !Array.isArray(node.keyframes)) return null;
  return { keyframes: node.keyframes, container: node };
}

function sortKeyframes(kfs: Keyframe[]) {
  kfs.sort((a, b) => a.time - b.time);
}

export const useStore = create<StoreState>((set, get) => ({
  scene: sampleScene(),
  past: [],
  future: [],

  selectedLayerId: null,
  selectedKeyframe: null,
  time: 0,
  playing: false,
  loop: true,
  expanded: {},
  activeTarget: "mp4",
  showPrinciples: false,
  showExport: false,

  update: (recipe) =>
    set((state) => {
      const past = [...state.past, state.scene].slice(-HISTORY_LIMIT);
      const next = clone(state.scene);
      recipe(next);
      return { scene: next, past, future: [] };
    }),

  updateLive: (recipe) =>
    set((state) => {
      const next = clone(state.scene);
      recipe(next);
      return { scene: next };
    }),

  beginChange: () =>
    set((state) => ({
      past: [...state.past, clone(state.scene)].slice(-HISTORY_LIMIT),
      future: [],
    })),

  loadScene: (scene) =>
    set({
      scene,
      past: [],
      future: [],
      selectedLayerId: null,
      time: 0,
      playing: false,
    }),

  selectLayer: (id) => set({ selectedLayerId: id }),

  addLayer: (layer) => {
    get().update((s) => {
      s.layers.push(layer);
    });
    set({ selectedLayerId: layer.id });
  },

  removeLayer: (id) => {
    get().update((s) => {
      s.layers = s.layers.filter((l) => l.id !== id);
      // Orphan any children of a removed group.
      for (const l of s.layers) if (l.parentId === id) l.parentId = null;
    });
    if (get().selectedLayerId === id) set({ selectedLayerId: null });
  },

  duplicateLayer: (id) =>
    get().update((s) => {
      const idx = s.layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const copy: Layer = JSON.parse(JSON.stringify(s.layers[idx]));
      copy.id = `layer_${Math.random().toString(36).slice(2, 10)}`;
      copy.name = `${copy.name} copy`;
      s.layers.splice(idx + 1, 0, copy);
    }),

  reorderLayer: (id, toIndex) =>
    get().update((s) => {
      const from = s.layers.findIndex((l) => l.id === id);
      if (from < 0) return;
      const [item] = s.layers.splice(from, 1);
      s.layers.splice(Math.max(0, Math.min(toIndex, s.layers.length)), 0, item);
    }),

  updateLayer: (id, patch, live = false) => {
    const apply = (s: SceneDocument) => {
      const layer = s.layers.find((l) => l.id === id);
      if (layer) patch(layer);
    };
    if (live) get().updateLive(apply);
    else get().update(apply);
  },

  addKeyframe: (layerId, channelPath, kf) =>
    get().update((s) => {
      const layer = s.layers.find((l) => l.id === layerId);
      if (!layer) return;
      const ch = resolveChannel(layer, channelPath);
      if (!ch) return;
      // Replace a keyframe at the same time, otherwise insert + sort.
      const existing = ch.keyframes.find((k) => Math.abs(k.time - kf.time) < 1e-4);
      if (existing) {
        existing.value = kf.value;
        existing.easing = kf.easing;
      } else {
        ch.keyframes.push(kf);
        sortKeyframes(ch.keyframes);
      }
    }),

  removeKeyframe: (layerId, channelPath, kfId) =>
    get().update((s) => {
      const layer = s.layers.find((l) => l.id === layerId);
      if (!layer) return;
      const ch = resolveChannel(layer, channelPath);
      if (!ch) return;
      const idx = ch.keyframes.findIndex((k) => k.id === kfId);
      if (idx >= 0) ch.keyframes.splice(idx, 1);
    }),

  updateKeyframe: (layerId, channelPath, kfId, patch, live = false) => {
    const apply = (s: SceneDocument) => {
      const layer = s.layers.find((l) => l.id === layerId);
      if (!layer) return;
      const ch = resolveChannel(layer, channelPath);
      if (!ch) return;
      const k = ch.keyframes.find((kf) => kf.id === kfId);
      if (!k) return;
      Object.assign(k, patch);
      if (patch.time !== undefined) sortKeyframes(ch.keyframes);
    };
    if (live) get().updateLive(apply);
    else get().update(apply);
  },

  selectKeyframe: (sel) => set({ selectedKeyframe: sel }),

  setTime: (t) => set({ time: Math.max(0, t) }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  toggleExpanded: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setActiveTarget: (t) => set({ activeTarget: t }),
  setShowPrinciples: (v) => set({ showPrinciples: v }),
  setShowExport: (v) => set({ showExport: v }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const prev = state.past[state.past.length - 1];
      return {
        scene: prev,
        past: state.past.slice(0, -1),
        future: [state.scene, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const next = state.future[0];
      return {
        scene: next,
        past: [...state.past, state.scene].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }),
}));
