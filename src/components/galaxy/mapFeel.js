// The galaxy map's feel (docs/superpowers/specs/2026-10-08-game-feel-
// design.md, the 2B row): what scene.js's knocks, shakes and stick are
// made of, pure. The shake is lib/three/feel.js's (trauma², held still under
// reduced motion), kept at the old one's size: k² × 0.09 world units, now
// the feel's offset, decaying 1.4 a second as it did.
//
//   MAP_FEEL { offset, decay }: the feel's numbers for the map
//   HITSTOP { kill, crash }: ms the game holds on each
//   knockForce(e, crash) → a bump's or a crash's force for the hit law
//     (lib/impact.js): the speed into it × KNOCK_MASS, full at the crash
//     speed (a bump that doesn't say its speed is guessed by `hard`)
//   deadZone(dx, dy, full, dead = 0.1) → [dx, dy]: a drag under `dead` of the
//     full throw is none, rescaled past it so the full throw stays full
//   atLeast(feel, k): the trauma raised to k (the map's shakes were a
//     floor, `max(shake, k)`, held while a thing goes on; never piled up)

export const MAP_FEEL = { offset: 0.09, decay: 1.4 };
export const HITSTOP = { kill: 60, crash: 90 };
export const KNOCK_MASS = 50; // × 2.4, the crash speed: 120, the law's full

export function knockForce(e, crash) {
  const speed = e.type === 'crash' ? e.speed ?? crash : e.into ?? (e.hard ? crash * 0.8 : crash * 0.35);
  return Math.max(0, speed) * KNOCK_MASS;
}

export function deadZone(dx, dy, full, dead = 0.1) {
  const m = Math.hypot(dx, dy);
  const d = full * dead;
  if (m <= d) return [0, 0];
  const k = ((m - d) / Math.max(1e-6, full - d)) * (full / m);
  return [dx * k, dy * k];
}

export function atLeast(feel, k) {
  const has = feel.state().trauma;
  if (k > has) feel.trauma(k - has);
}
