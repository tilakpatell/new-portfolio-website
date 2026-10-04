// The launch, in ms from the moment you go. Every vehicle has the same
// beats, at its own pace:
//
//   0 … spool      the wind-up: the levers go forward, Artoo whistles, Rick
//                  fires the portal gun, the RV's engine catches
//   spool … peak   away: the stars stretch into lines and the tunnel, the
//                  cruiser dives for the portal, the RV drives into the night
//   peak           the flash (white, green, or the night): `onPeak` fires
//                  here, and the universe behind the cockpit is uncovered
//   peak … end     the flash clears off the universe; `onDone`
//
// A click, tap or key during the launch skips on to just before the flash.

export const PLANS = {
  falcon: { spool: 1000, peak: 3050, end: 3700 },
  xwing: { spool: 800, peak: 2850, end: 3500 },
  cruiser: { spool: 1500, peak: 3300, end: 3950 },
  rv: { spool: 1100, peak: 8200, end: 8950 },
};

export const plan = (id) => PLANS[id] ?? PLANS.falcon;

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const smooth = (t) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};

// Where a launch is: 'spool', 'go', 'out' or 'done', and how far through that
// stretch (0…1).
export function phaseAt(p, t) {
  if (t < p.spool) return { name: 'spool', k: clamp01(t / p.spool) };
  if (t < p.peak) return { name: 'go', k: clamp01((t - p.spool) / (p.peak - p.spool)) };
  if (t < p.end) return { name: 'out', k: clamp01((t - p.peak) / (p.end - p.peak)) };
  return { name: 'done', k: 1 };
}

// Skipping: on to just before the flash (never back, never past it).
export const LEAD = 350;
export const skipTo = (p, t) => Math.max(t, p.peak - LEAD);

// The flash: up hard in the last moments before the peak, gone by the end.
export function flashAt(p, t) {
  const rise = Math.min(260, (p.peak - p.spool) * 0.4);
  if (t <= p.peak - rise || t >= p.end) return 0;
  if (t < p.peak) return smooth((t - (p.peak - rise)) / rise);
  return 1 - smooth((t - p.peak) / (p.end - p.peak));
}

// How fast you're going, 0 at rest to 1 flat out: a little creep while
// spooling, then a hard push that keeps building to the flash.
export function throttleAt(p, t) {
  if (t <= 0) return 0;
  if (t < p.spool) return 0.08 * smooth(t / p.spool);
  if (t < p.peak) return 0.08 + 0.92 * Math.pow(clamp01((t - p.spool) / (p.peak - p.spool)), 1.6);
  return 1;
}
