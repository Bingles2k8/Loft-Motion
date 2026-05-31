/**
 * Loft Motion — behavior catalog (UI metadata for the procedural tools).
 *
 * Declares each behavior's label, description, default target, and its tunable
 * params (ranges/labels) so the Behaviors panel and the properties stack can
 * render controls generically.
 */
import type { BehaviorTarget, BehaviorType } from "@/lib/scene/schema";

export interface BehaviorParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export interface BehaviorDef {
  type: BehaviorType;
  label: string;
  description: string;
  defaultTarget: BehaviorTarget;
  /** Which targets make sense for this behavior. */
  targets: BehaviorTarget[];
  params: BehaviorParamDef[];
}

export const BEHAVIOR_CATALOG: Record<BehaviorType, BehaviorDef> = {
  wiggle: {
    type: "wiggle",
    label: "Wiggle",
    description: "Organic random drift — instant life.",
    defaultTarget: "position",
    targets: ["position", "x", "y", "rotation", "scale", "opacity"],
    params: [
      { key: "freq", label: "Frequency", min: 0.1, max: 10, step: 0.1, unit: "/s" },
      { key: "amp", label: "Amount", min: 0, max: 300 },
      { key: "octaves", label: "Detail", min: 1, max: 4, step: 1 },
      { key: "seed", label: "Seed", min: 0, max: 999, step: 1 },
    ],
  },
  oscillate: {
    type: "oscillate",
    label: "Oscillate",
    description: "Smooth pulsing / bobbing on a sine wave.",
    defaultTarget: "scale",
    targets: ["position", "x", "y", "rotation", "scale", "opacity"],
    params: [
      { key: "freq", label: "Frequency", min: 0.05, max: 8, step: 0.05, unit: "Hz" },
      { key: "amp", label: "Amount", min: 0, max: 300 },
      { key: "phase", label: "Phase", min: 0, max: 360, step: 1, unit: "°" },
      { key: "wave", label: "Wave", min: 0, max: 3, step: 1 },
    ],
  },
  spin: {
    type: "spin",
    label: "Spin",
    description: "Continuous rotation — one knob, instant loader.",
    defaultTarget: "rotation",
    targets: ["rotation"],
    params: [{ key: "rate", label: "Speed", min: -720, max: 720, step: 5, unit: "°/s" }],
  },
  spring: {
    type: "spring",
    label: "Spring",
    description: "Bouncy overshoot that settles — feels alive.",
    defaultTarget: "scale",
    targets: ["scale", "position", "x", "y", "rotation", "opacity"],
    params: [
      { key: "from", label: "From", min: -200, max: 200 },
      { key: "stiffness", label: "Stiffness", min: 20, max: 400, step: 1 },
      { key: "damping", label: "Damping", min: 1, max: 60, step: 1 },
      { key: "delay", label: "Delay", min: 0, max: 3, step: 0.05, unit: "s" },
    ],
  },
  orbit: {
    type: "orbit",
    label: "Orbit",
    description: "Travels in a circle — orbits, planets, loaders.",
    defaultTarget: "position",
    targets: ["position"],
    params: [
      { key: "radius", label: "Radius", min: 0, max: 600 },
      { key: "rate", label: "Speed", min: -360, max: 360, step: 5, unit: "°/s" },
      { key: "phase", label: "Phase", min: 0, max: 360, step: 1, unit: "°" },
    ],
  },
};

export const BEHAVIOR_LIST = Object.values(BEHAVIOR_CATALOG);

export function behaviorDef(type: BehaviorType): BehaviorDef {
  return BEHAVIOR_CATALOG[type];
}
