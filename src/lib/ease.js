// Eases by dt (docs/superpowers/specs/2026-10-08-game-feel-design.md §1): a
// `min(1, dt·k)` or a constant a frame moves faster at 120 Hz than at 60;
// these move the same at any frame rate. For rules files, which can’t import
// three’s MathUtils.damp. To keep a per-frame ease’s feel at 60 Hz, k is
// −60·ln(1 − k₆₀/60).
//
//   damp(k, dt) → 1 − e^(−k·dt), the share of the way to go this frame
//   approach(a, b, k, dt) → a moved towards b by that share

export const damp = (k, dt) => 1 - Math.exp(-k * dt);

export const approach = (a, b, k, dt) => a + (b - a) * damp(k, dt);
