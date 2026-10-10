// The guns' numbers, pure (tested in Node; scene.js shoots by them, the
// hero panel offers them): what each kind does per shot and how fast, the
// heat it builds (Battlefront's bar: fire too long and it locks, vent it
// early or hit the sweet spot once it has), the mods that bend those
// numbers, and the sights. The kinds are universe/gunplay.js's GUNS (the
// gun in the hand); a kind here without one there falls back to the
// blaster's numbers.
//
//   WEAPONS              by kind: { name, about, side ('galaxy' | 'elsewhere'), damage (hits a shot is worth: a stormtrooper has 2), every (seconds between shots), spread (radians of scatter), heat (0…1 a shot adds), cool (a second), range (metres), zoom (the sights' magnification), burst? (shots a pull fires), pellets? (a shotgun's), kick }
//   MODS                 by id: { name, about, ...multipliers on the numbers }
//   WEAPON_IDS, MOD_IDS
//   weaponOf(kind)       the numbers, the blaster's when unknown
//   withMods(kind, mods) the numbers with up to MAX_MODS applied
//   heatShot(h, w, now)  the heat after a shot: { value, locked (overheated: no shots until it's vented or cools), lockedAt, shotAt }
//   heatStep(h, dt, w, now)   a frame on: cooling at the gun's `cool` a second, but not within COOL_WAIT of a shot (so holding the trigger only heats); locked, dead for VENT.lock then clear
//   vent(h, now)         the active cool: in the sweet spot (VENT.sweet of the way through the lock) it's all gone at once; early it's half; late nothing
//   ventSpot(h, now)     where the vent's marker is (0…1) while locked, or null
//   spreadAt(w, aiming)  the scatter when aiming down the sights (tighter)

export const MAX_MODS = 2;
export const VENT = { sweet: [0.35, 0.55], lock: 1.6 }; // (the marker runs 0…1 over `lock` seconds; in `sweet` it's a perfect vent)
export const COOL_WAIT = 0.45; // seconds after a shot before the gun starts to cool

const base = { damage: 1, every: 0.24, spread: 0.012, heat: 0.14, cool: 0.35, range: 90, zoom: 1.4, kick: 1 };
export const WEAPONS = {
  // ── Star Wars ──
  blaster: { ...base, name: 'DL-44', about: 'Han’s heavy blaster pistol. Hits hard, heats fast.', side: 'galaxy', damage: 2, every: 0.3, heat: 0.14, cool: 0.3, zoom: 1.3 },
  rifle: { ...base, name: 'E-11', about: 'The stormtrooper’s rifle: steady, decent cooling.', side: 'galaxy', damage: 1, every: 0.16, spread: 0.014, heat: 0.065, cool: 0.35, range: 110, zoom: 1.8 },
  a280: { ...base, name: 'A280', about: 'The Rebel rifle from Endor: three-shot bursts, long reach.', side: 'galaxy', damage: 1, every: 0.42, burst: 3, spread: 0.01, heat: 0.16, cool: 0.35, range: 130, zoom: 2.2 },
  dlt19: { ...base, name: 'DLT-19', about: 'The heavy repeater: a stream of light bolts, slow to heat.', side: 'galaxy', damage: 1, every: 0.09, spread: 0.028, heat: 0.03, cool: 0.4, range: 100, zoom: 1.5, kick: 0.6 },
  ee3: { ...base, name: 'EE-3', about: 'Boba Fett’s carbine: a quick two-shot burst, a good scope.', side: 'galaxy', damage: 1, every: 0.36, burst: 2, spread: 0.008, heat: 0.13, cool: 0.35, range: 140, zoom: 2.6 },
  westar: { ...base, name: 'WESTAR-34', about: 'Jango’s pistol: light and very fast.', side: 'galaxy', damage: 1, every: 0.12, spread: 0.02, heat: 0.055, cool: 0.4, range: 70, zoom: 1.3, kick: 0.7 },
  // (the soldiers' own: ground/troops.js; not in PICKABLE, so never offered to you)
  dc15: { ...base, name: 'DC-15A', about: 'The clone trooper’s rifle: three-shot bursts.', side: 'galaxy', damage: 1, every: 0.4, burst: 3, spread: 0.012, range: 120 },
  e5: { ...base, name: 'E-5', about: 'The battle droid’s carbine: slow and wide.', side: 'galaxy', damage: 1, every: 0.5, spread: 0.03, range: 70 },
  bowcaster: { ...base, name: 'Bowcaster', about: 'Chewie’s: a slow, heavy quarrel.', side: 'galaxy', damage: 3, every: 0.7, spread: 0.006, heat: 0.25, cool: 0.3, range: 120, zoom: 1.6, kick: 1.6 },
  // ── Elsewhere ──
  shotgun: { ...base, name: 'Scattergun', about: 'Seven pellets at once. Close in, nothing survives it.', side: 'elsewhere', damage: 1, every: 0.8, pellets: 7, spread: 0.07, heat: 0.26, cool: 0.3, range: 30, zoom: 1.1, kick: 2 },
  sniper: { ...base, name: 'Longrifle', about: 'One slow shot at a time, from a long way off.', side: 'elsewhere', damage: 4, every: 1.3, spread: 0.002, heat: 0.4, cool: 0.3, range: 220, zoom: 4, kick: 1.8 },
  smg: { ...base, name: 'Machine pistol', about: 'Rattles through a clip. Wild past twenty metres.', side: 'elsewhere', damage: 1, every: 0.07, spread: 0.04, heat: 0.028, cool: 0.4, range: 50, zoom: 1.2, kick: 0.5 },
  revolver: { ...base, name: 'Revolver', about: 'Walt’s snub-nose. Six shots, each one counts.', side: 'elsewhere', damage: 2, every: 0.45, spread: 0.008, heat: 0.17, cool: 0.3, range: 60, zoom: 1.3, kick: 1.5 },
  pistol: { ...base, name: 'Pistol', about: 'Jesse’s. Quick and a little loose.', side: 'elsewhere', damage: 1, every: 0.18, spread: 0.02, heat: 0.08, cool: 0.35, range: 60 },
  portal: { ...base, name: 'Portal gun', about: 'Rick’s. Whoever it drops goes through a portal, and not all the way.', side: 'elsewhere', damage: 2, every: 0.35, spread: 0.01, heat: 0.15, cool: 0.35, range: 80 },
  freeze: { ...base, name: 'Freeze ray', about: 'Rick’s. Ices them where they stand, then they shatter.', side: 'elsewhere', damage: 3, every: 0.6, spread: 0.008, heat: 0.22, cool: 0.32, range: 70, kick: 0.6 },
  shrink: { ...base, name: 'Shrink ray', about: 'Rick’s. Down to a tenth, a squeak, a pop.', side: 'elsewhere', damage: 3, every: 0.6, spread: 0.008, heat: 0.22, cool: 0.32, range: 70, kick: 0.7 },
  laser: { ...base, name: 'Laser pistol', about: 'Morty’s ray gun.', side: 'elsewhere', damage: 1, every: 0.2, spread: 0.015, heat: 0.08, cool: 0.35, range: 70 },
  coppistol: { ...base, name: 'Service pistol', about: 'Citadel issue.', side: 'elsewhere', damage: 1, every: 0.2, spread: 0.015, heat: 0.08, cool: 0.35, range: 70 },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
// the ones the hero panel offers (a hero's own gun always, these besides)
export const PICKABLE = ['blaster', 'rifle', 'a280', 'dlt19', 'ee3', 'westar', 'bowcaster', 'shotgun', 'sniper', 'smg', 'revolver', 'portal', 'freeze', 'shrink'];
// the guns whose kills are a show of their own (lib/three/portalFx.js, gadgetFx.js: activity.js plays them)
export const SHOW_KILLS = ['portal', 'freeze', 'shrink'];

export const MODS = {
  cooling: { name: 'Cooling cell', about: 'Builds heat slower, sheds it faster.', heat: 0.7, cool: 1.3 },
  choke: { name: 'Tight choke', about: 'Half the scatter.', spread: 0.5 },
  barrel: { name: 'Long barrel', about: 'Further and a little harder, a touch slower.', range: 1.3, damage: 1.2, every: 1.1 },
  scope: { name: 'Scope', about: 'Twice the sights.', zoom: 2 },
  trigger: { name: 'Hair trigger', about: 'A faster cycle, a little more heat.', every: 0.78, heat: 1.15 },
  stock: { name: 'Steady stock', about: 'Less kick, a steadier aim.', kick: 0.5, spread: 0.75 },
};
export const MOD_IDS = Object.keys(MODS);

export const weaponOf = (kind) => WEAPONS[kind] ?? WEAPONS.blaster;

export function withMods(kind, mods = []) {
  const w = { ...weaponOf(kind), kind: WEAPONS[kind] ? kind : 'blaster', mods: [] };
  for (const id of [...new Set(mods)].filter((m) => MODS[m]).slice(0, MAX_MODS)) {
    const m = MODS[id];
    w.mods.push(id);
    for (const k of ['damage', 'every', 'spread', 'heat', 'cool', 'range', 'zoom', 'kick']) if (m[k] != null) w[k] *= m[k];
  }
  w.damage = Math.max(1, Math.round(w.damage));
  return w;
}

export function heatShot(h, w, now = 0) {
  const value = Math.min(1, h.value + w.heat);
  const locked = value >= 1;
  return { value, locked, lockedAt: locked ? now : null, shotAt: now };
}

export function heatStep(h, dt, w, now = 0) {
  if (h.locked) {
    // (dead through the lock, then clear)
    const k = (now - h.lockedAt) / VENT.lock;
    if (k < 1) return h;
    return { value: 0, locked: false, lockedAt: null, shotAt: h.shotAt };
  }
  if (h.value <= 0 || now - (h.shotAt ?? -99) < COOL_WAIT) return h;
  return { ...h, value: Math.max(0, h.value - w.cool * dt) };
}

export function ventSpot(h, now) {
  if (!h.locked) return null;
  const k = (now - h.lockedAt) / VENT.lock;
  return k >= 1 ? null : k;
}

export function vent(h, now) {
  if (!h.locked) return { value: 0, locked: false, lockedAt: null, perfect: !h.locked && h.value > 0.5 }; // (venting early just empties it)
  const k = ventSpot(h, now) ?? 1;
  if (k >= VENT.sweet[0] && k <= VENT.sweet[1]) return { value: 0, locked: false, lockedAt: null, perfect: true };
  if (k < VENT.sweet[0]) return { value: 0.5, locked: false, lockedAt: null, perfect: false }; // (jumped the gun: half of it stays)
  return { ...h, perfect: false }; // (too late: ride out the lock)
}

export const spreadAt = (w, aiming) => w.spread * (aiming ? 0.45 : 1);
