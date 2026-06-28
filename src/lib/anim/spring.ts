/**
 * Loft Motion — spring presets & normalised step response (Figma-style).
 *
 * The spring behavior already drives a real analytic damped spring
 * (stiffness / damping / mass). This module adds Figma's four named spring
 * presets and a normalised unit-step response used to draw a live preview
 * graph — the same curve Figma shows in its interaction details.
 */
export interface SpringParams {
  stiffness: number;
  damping: number;
  mass: number;
}

export const SPRING_PRESETS = ["gentle", "quick", "bouncy", "slow"] as const;
export type SpringPreset = (typeof SPRING_PRESETS)[number];

export const SPRING_PRESET_LABELS: Record<SpringPreset, string> = {
  gentle: "Gentle",
  quick: "Quick",
  bouncy: "Bouncy",
  slow: "Slow",
};

/** Stiffness / damping / mass for each named preset. */
export const SPRING_PRESET_PARAMS: Record<SpringPreset, SpringParams> = {
  gentle: { stiffness: 100, damping: 15, mass: 1 },
  quick: { stiffness: 300, damping: 20, mass: 1 },
  bouncy: { stiffness: 180, damping: 8, mass: 1 },
  slow: { stiffness: 80, damping: 20, mass: 1.4 },
};

/**
 * Normalised unit-step response of a damped spring at time `t` (seconds):
 * starts at 0, settles to 1. Underdamped springs overshoot past 1 and ring;
 * over/critically-damped approach 1 monotonically. Pure function of t.
 */
export function springResponse(t: number, p: SpringParams): number {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(p.stiffness / p.mass);
  const zeta = p.damping / (2 * Math.sqrt(p.stiffness * p.mass));

  if (zeta < 1) {
    // Underdamped — overshoot and oscillation.
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (
      1 -
      Math.exp(-zeta * w0 * t) *
        (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
    );
  }
  if (zeta === 1) {
    // Critically damped.
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  // Overdamped — sum of two decaying exponentials.
  const r = w0 * Math.sqrt(zeta * zeta - 1);
  const a = -zeta * w0 + r;
  const b = -zeta * w0 - r;
  return 1 - (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
}

/** Roughly how long (seconds) until the spring has settled within 0.5%. */
export function springSettleTime(p: SpringParams): number {
  const w0 = Math.sqrt(p.stiffness / p.mass);
  const zeta = p.damping / (2 * Math.sqrt(p.stiffness * p.mass));
  // Envelope e^{-zeta*w0*t} < 0.005  →  t ≈ 5.3 / (zeta*w0).
  return Math.min(4, Math.max(0.4, 5.3 / Math.max(0.001, zeta * w0)));
}
