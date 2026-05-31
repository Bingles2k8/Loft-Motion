/**
 * Loft Motion — application store (Zustand).
 *
 * Wraps the scene document with immutable updates so undo/redo is just snapshot
 * swapping. Scene mutations go through `update` (records history) or `updateLive`
 * (no history, for drag frames — pair with `beginChange` at gesture start).
 *
 * UI state (selection, playhead, panel sizes, graph mode) lives here too but is
 * kept out of the history stack.
 */
"use client";

import { create } from "zustand";
import {
  type Asset,
  type ExportTarget,
  type Keyframe,
  type Layer,
  type SceneDocument,
} from "@/lib/scene/schema";
import { sampleScene } from "@/lib/scene/factory";

const HISTORY_LIMIT = 100;

type Recipe = (scene: SceneDocument) => void;

/** A reference to a single keyframe anywhere in the scene. */
export interface KfRef {
  layerId: string;
  channelPath: string;
  kfId: string;
}

export const kfKey = (r: KfRef) => `${r.layerId}|${r.channelPath}|${r.kfId}`;

/** Persisted panel sizes (px) — restored from localStorage on load. */
export interface PanelSizes {
  left: number; // Project/Effects column width
  right: number; // Properties column width
  bottom: number; // Timeline height
  timelineLabels: number; // Timeline left label column width
}

const DEFAULT_SIZES: PanelSizes = {
  left: 264,
  right: 320,
  bottom: 300,
  timelineLabels: 248,
};

const SIZES_KEY = "loft.panelSizes.v1";

function loadSizes(): PanelSizes {
  if (typeof window === "undefined") return DEFAULT_SIZES;
  try {
    const raw = window.localStorage.getItem(SIZES_KEY);
    if (raw) return { ...DEFAULT_SIZES, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SIZES;
}

export type LeftTab = "project" | "effects";

export interface StoreState {
  scene: SceneDocument;
  past: SceneDocument[];
  future: SceneDocument[];

  // Selection
  selectedLayerId: string | null;
  /** Multi-keyframe selection (graph + dope sheet). */
  selectedKeys: KfRef[];

  // Playback
  time: number;
  playing: boolean;
  loop: boolean;

  // Timeline UI
  expanded: Record<string, boolean>;
  graphMode: boolean;
  /** Per-layer channel solo: when non-empty, only these channel paths show. */
  soloChannels: Record<string, string[]>;
  autoKeyframe: boolean;

  // Viewport (comp view transform — does not touch layer values)
  viewZoom: number; // 0 = fit-to-window (auto)
  viewPanX: number;
  viewPanY: number;

  // Layout
  sizes: PanelSizes;
  leftTab: LeftTab;

  // Dialogs / side panels
  activeTarget: ExportTarget;
  showPrinciples: boolean;
  showExport: boolean;
  showSettings: boolean;

  // Scene mutations
  update: (recipe: Recipe) => void;
  updateLive: (recipe: Recipe) => void;
  beginChange: () => void;
  loadScene: (scene: SceneDocument) => void;

  // Layers
  selectLayer: (id: string | null) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayer: (id: string, toIndex: number) => void;
  updateLayer: (id: string, patch: (layer: Layer) => void, live?: boolean) => void;

  // Assets
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  renameAsset: (id: string, name: string) => void;

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

  // Keyframe selection
  selectKeyframe: (ref: KfRef | null, additive?: boolean) => void;
  selectKeyframes: (refs: KfRef[]) => void;
  isKeyframeSelected: (ref: KfRef) => boolean;
  clearKeyframeSelection: () => void;

  // Bulk keyframe ops (operate on the current selection)
  setEasingForSelection: (easing: string) => void;
  setBezierForSelection: (bezier: [number, number, number, number]) => void;
  nudgeSelection: (dtSeconds: number) => void;
  deleteSelection: () => void;

  // Playback / UI
  setTime: (t: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleLoop: () => void;
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, v: boolean) => void;
  toggleGraphMode: () => void;
  setLeftTab: (t: LeftTab) => void;
  setPanelSize: (key: keyof PanelSizes, value: number) => void;
  setActiveTarget: (t: ExportTarget) => void;
  setShowPrinciples: (v: boolean) => void;
  setShowExport: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;

  // Channel solo + auto-keyframe
  toggleSoloChannel: (layerId: string, channelPath: string) => void;
  clearSoloChannels: (layerId: string) => void;
  setAutoKeyframe: (v: boolean) => void;

  // Viewport
  setView: (z: number, panX: number, panY: number) => void;
  resetView: () => void;

  // History
  undo: () => void;
  redo: () => void;
}

const clone = (s: SceneDocument): SceneDocument =>
  typeof structuredClone === "function"
    ? structuredClone(s)
    : JSON.parse(JSON.stringify(s));

/** Resolve a dotted channel path to its keyframe array + container node. */
function resolveChannel(
  layer: Layer,
  path: string,
): { keyframes: Keyframe[] } | null {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = layer;
  for (const p of parts) {
    if (node == null) return null;
    node = Array.isArray(node)
      ? node.find((e: { id: string }) => e.id === p)
      : node[p];
  }
  if (!node || !Array.isArray(node.keyframes)) return null;
  return { keyframes: node.keyframes };
}

function sortKeyframes(kfs: Keyframe[]) {
  kfs.sort((a, b) => a.time - b.time);
}

export const useStore = create<StoreState>((set, get) => ({
  scene: sampleScene(),
  past: [],
  future: [],

  selectedLayerId: null,
  selectedKeys: [],

  time: 0,
  playing: false,
  loop: true,

  expanded: {},
  graphMode: false,
  soloChannels: {},
  autoKeyframe: false,

  viewZoom: 0,
  viewPanX: 0,
  viewPanY: 0,

  sizes: loadSizes(),
  leftTab: "project",

  activeTarget: "mp4",
  showPrinciples: false,
  showExport: false,
  showSettings: false,

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
      selectedKeys: [],
      time: 0,
      playing: false,
    }),

  selectLayer: (id) => set({ selectedLayerId: id, selectedKeys: [] }),

  addLayer: (layer) => {
    get().update((s) => {
      s.layers.push(layer);
    });
    set({ selectedLayerId: layer.id });
  },

  removeLayer: (id) => {
    get().update((s) => {
      s.layers = s.layers.filter((l) => l.id !== id);
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

  addAsset: (asset) =>
    get().update((s) => {
      s.assets.push(asset);
    }),

  removeAsset: (id) =>
    get().update((s) => {
      s.assets = s.assets.filter((a) => a.id !== id);
    }),

  renameAsset: (id, name) =>
    get().update((s) => {
      const a = s.assets.find((x) => x.id === id);
      if (a) a.name = name;
    }),

  addKeyframe: (layerId, channelPath, kf) =>
    get().update((s) => {
      const layer = s.layers.find((l) => l.id === layerId);
      if (!layer) return;
      const ch = resolveChannel(layer, channelPath);
      if (!ch) return;
      const existing = ch.keyframes.find((k) => Math.abs(k.time - kf.time) < 1e-4);
      if (existing) {
        existing.value = kf.value;
        existing.easing = kf.easing;
        existing.bezier = kf.bezier;
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

  selectKeyframe: (ref, additive = false) =>
    set((state) => {
      if (!ref) return { selectedKeys: [] };
      const exists = state.selectedKeys.some((r) => kfKey(r) === kfKey(ref));
      if (additive) {
        return {
          selectedKeys: exists
            ? state.selectedKeys.filter((r) => kfKey(r) !== kfKey(ref))
            : [...state.selectedKeys, ref],
        };
      }
      return { selectedKeys: [ref] };
    }),

  selectKeyframes: (refs) => set({ selectedKeys: refs }),

  isKeyframeSelected: (ref) =>
    get().selectedKeys.some((r) => kfKey(r) === kfKey(ref)),

  clearKeyframeSelection: () => set({ selectedKeys: [] }),

  setEasingForSelection: (easing) => {
    const { selectedKeys } = get();
    if (selectedKeys.length === 0) return;
    get().update((s) => {
      for (const ref of selectedKeys) {
        const layer = s.layers.find((l) => l.id === ref.layerId);
        if (!layer) continue;
        const ch = resolveChannel(layer, ref.channelPath);
        const k = ch?.keyframes.find((kf) => kf.id === ref.kfId);
        if (k) {
          k.easing = easing;
          delete k.bezier; // named easing replaces a custom curve
        }
      }
    });
  },

  setBezierForSelection: (bezier) => {
    const { selectedKeys } = get();
    if (selectedKeys.length === 0) return;
    get().update((s) => {
      for (const ref of selectedKeys) {
        const layer = s.layers.find((l) => l.id === ref.layerId);
        if (!layer) continue;
        const ch = resolveChannel(layer, ref.channelPath);
        const k = ch?.keyframes.find((kf) => kf.id === ref.kfId);
        if (k) k.bezier = bezier;
      }
    });
  },

  nudgeSelection: (dt) => {
    const { selectedKeys } = get();
    if (selectedKeys.length === 0) return;
    get().update((s) => {
      const touched = new Set<string>();
      for (const ref of selectedKeys) {
        const layer = s.layers.find((l) => l.id === ref.layerId);
        if (!layer) continue;
        const ch = resolveChannel(layer, ref.channelPath);
        const k = ch?.keyframes.find((kf) => kf.id === ref.kfId);
        if (k) {
          k.time = Math.max(0, k.time + dt);
          touched.add(`${ref.layerId}|${ref.channelPath}`);
        }
        if (ch) sortKeyframes(ch.keyframes);
      }
      void touched;
    });
  },

  deleteSelection: () => {
    const { selectedKeys } = get();
    if (selectedKeys.length === 0) return;
    get().update((s) => {
      for (const ref of selectedKeys) {
        const layer = s.layers.find((l) => l.id === ref.layerId);
        if (!layer) continue;
        const ch = resolveChannel(layer, ref.channelPath);
        if (!ch) continue;
        const idx = ch.keyframes.findIndex((k) => k.id === ref.kfId);
        if (idx >= 0) ch.keyframes.splice(idx, 1);
      }
    });
    set({ selectedKeys: [] });
  },

  setTime: (t) => set({ time: Math.max(0, t) }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  toggleExpanded: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setExpanded: (id, v) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: v } })),
  toggleGraphMode: () => set((s) => ({ graphMode: !s.graphMode })),
  setLeftTab: (t) => set({ leftTab: t }),

  setPanelSize: (key, value) =>
    set((state) => {
      const sizes = { ...state.sizes, [key]: value };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(SIZES_KEY, JSON.stringify(sizes));
        } catch {
          /* ignore */
        }
      }
      return { sizes };
    }),

  setActiveTarget: (t) => set({ activeTarget: t }),
  setShowPrinciples: (v) => set({ showPrinciples: v }),
  setShowExport: (v) => set({ showExport: v }),
  setShowSettings: (v) => set({ showSettings: v }),

  toggleSoloChannel: (layerId, channelPath) =>
    set((s) => {
      const cur = s.soloChannels[layerId] ?? [];
      const next = cur.includes(channelPath)
        ? cur.filter((p) => p !== channelPath)
        : [...cur, channelPath];
      const soloChannels = { ...s.soloChannels };
      if (next.length === 0) delete soloChannels[layerId];
      else soloChannels[layerId] = next;
      return { soloChannels };
    }),

  clearSoloChannels: (layerId) =>
    set((s) => {
      const soloChannels = { ...s.soloChannels };
      delete soloChannels[layerId];
      return { soloChannels };
    }),

  setAutoKeyframe: (v) => set({ autoKeyframe: v }),

  setView: (z, panX, panY) => set({ viewZoom: z, viewPanX: panX, viewPanY: panY }),
  resetView: () => set({ viewZoom: 0, viewPanX: 0, viewPanY: 0 }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const prev = state.past[state.past.length - 1];
      return {
        scene: prev,
        past: state.past.slice(0, -1),
        future: [state.scene, ...state.future].slice(0, HISTORY_LIMIT),
        selectedKeys: [],
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
        selectedKeys: [],
      };
    }),
}));
