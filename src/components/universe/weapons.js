// Each ship's guns, as plain rules (scene.js fires them, tested here).
//
// Every ship carries three: its own blaster (the shots it always had), a
// spread that throws a fan of shorter shots, and heavy ordnance, a slow
// homing round that hits ten times as hard and is the only thing that
// hurts the Citadel's core once its shield is down (siege.js). The heavy
// rounds are few: a rack of them that fills back up one at a time.
//
// R (or Shift+R) cycles them, 1 2 3 picks one; the phone has a button.
//
// createArmory(kind) → { index, weapon, name, ammo, ammoMax, select(i),
//   cycle(dir), ready(now, cadence) → bool, fired(now), update(dt), reload() }
// `cadence` is the ship's own seconds between blaster shots (outfit.js and
// scene.js's CADENCE); each weapon fires at a multiple of it.

// code: what goes over the wire with a shot (protocol.js), so the others
// draw it as it is. damage: what one hit takes off another pilot's shields
// (a blaster bolt is protocol.js's DAMAGE). punch: against hunters and the
// Citadel (a hunter's hp is in punches). life and speed: of the blaster's.
export const WEAPONS = {
  blaster: { code: 0, cadence: 1, count: 1, cone: 0, life: 1, speed: 1, damage: 10, punch: 1, scale: 1 },
  spread: { code: 1, cadence: 2.4, count: 5, cone: 0.075, life: 0.55, speed: 0.9, damage: 6, punch: 0.6, scale: 0.75 },
  heavy: { code: 2, cadence: 3.2, count: 1, cone: 0, life: 2.8, speed: 0.5, damage: 30, punch: 8, scale: 1, homing: 2.4, ammo: 4, reload: 6.5, heavy: true },
};
export const ORDER = ['blaster', 'spread', 'heavy'];
export const byCode = (code) => ORDER.find((id) => WEAPONS[id].code === code) ?? 'blaster';

// what each crew calls them, and the heavy round's glow
export const ARSENAL = {
  xwing: { names: ['Laser cannons', 'Ion scatter', 'Proton torpedoes'], heavy: '#ff7a3a' },
  falcon: { names: ['Quad lasers', 'Flak burst', 'Concussion missiles'], heavy: '#ffb347' },
  cruiser: { names: ['Laser', 'Plasma scatter', 'Portal grenades'], heavy: '#5dff4a' },
  rv: { names: ['Pistol', 'Shotgun', 'Fulminated mercury'], heavy: '#dff4ff' },
};
const DEFAULT = { names: ['Blaster', 'Scatter', 'Missiles'], heavy: '#ffb347' };
export const arsenalOf = (kind) => ARSENAL[kind] ?? DEFAULT;

export function createArmory(kind) {
  const names = arsenalOf(kind).names;
  let index = 0;
  let last = -Infinity;
  const heavy = WEAPONS.heavy;
  let ammo = heavy.ammo;
  let refill = 0; // seconds toward the next heavy round
  return {
    get index() {
      return index;
    },
    get id() {
      return ORDER[index];
    },
    get weapon() {
      return WEAPONS[ORDER[index]];
    },
    get name() {
      return names[index];
    },
    get ammo() {
      return ammo;
    },
    ammoMax: heavy.ammo,
    // how far the next heavy round is along, 0…1 (for the rack's last pip)
    get filling() {
      return ammo >= heavy.ammo ? 0 : refill / heavy.reload;
    },
    select(i) {
      if (i < 0 || i >= ORDER.length || i === index) return false;
      index = i;
      return true;
    },
    cycle(dir = 1) {
      index = (index + ORDER.length + (dir < 0 ? -1 : 1)) % ORDER.length;
      return index;
    },
    // may it fire now? (the blaster's cadence times the weapon's; heavy ones need a round)
    ready(now, cadence) {
      const w = WEAPONS[ORDER[index]];
      if (w.heavy && ammo < 1) return false;
      return now - last >= cadence * w.cadence * 1000;
    },
    fired(now) {
      last = now;
      if (WEAPONS[ORDER[index]].heavy) ammo = Math.max(0, ammo - 1);
    },
    // the rack fills back up, a round at a time
    update(dt) {
      if (ammo >= heavy.ammo) {
        refill = 0;
        return;
      }
      refill += dt;
      while (refill >= heavy.reload && ammo < heavy.ammo) {
        refill -= heavy.reload;
        ammo += 1;
      }
    },
    // back from being shot down: a full rack
    reload() {
      ammo = heavy.ammo;
      refill = 0;
    },
  };
}

// the directions of a fan of `count` shots about `dir` (a unit [x, y, z]),
// `cone` radians apart, spread across the view (side to side, one a little
// high and one low so it reads as a fan, not a line). jitter: −1…1 per shot.
export function fan(dir, count, cone, jitter = () => 0) {
  if (count <= 1 || !cone) return [dir];
  // a side vector (level) and an up vector, both across the shot
  let sx = -dir[2];
  let sz = dir[0];
  const sl = Math.hypot(sx, sz) || 1;
  sx /= sl;
  sz /= sl;
  // up = side × dir (the side vector is level, so its y is 0)
  const ux = -sz * dir[1];
  const uy = sz * dir[0] - sx * dir[2];
  const uz = sx * dir[1];
  const out = [];
  for (let i = 0; i < count; i++) {
    const across = (i - (count - 1) / 2) * cone + jitter() * cone * 0.25;
    const up = (i % 2 ? 0.5 : -0.5) * cone * (i === (count - 1) / 2 ? 0 : 1) + jitter() * cone * 0.25;
    const x = dir[0] + sx * across + ux * up;
    const y = dir[1] + uy * up;
    const z = dir[2] + sz * across + uz * up;
    const l = Math.hypot(x, y, z) || 1;
    out.push([x / l, y / l, z / l]);
  }
  return out;
}

// turn velocity `v` toward `to` (a unit direction) by at most `rate` radians
// a second, keeping its speed: a homing round's steering. In place.
export function steer(v, to, rate, dt) {
  const speed = Math.hypot(v[0], v[1], v[2]) || 1;
  const fx = v[0] / speed;
  const fy = v[1] / speed;
  const fz = v[2] / speed;
  const dot = Math.max(-1, Math.min(1, fx * to[0] + fy * to[1] + fz * to[2]));
  const angle = Math.acos(dot);
  if (angle < 1e-5) return v;
  if (rate * dt >= angle) {
    v[0] = to[0] * speed;
    v[1] = to[1] * speed;
    v[2] = to[2] * speed;
    return v;
  }
  // turned by exactly rate·dt toward `to`, in the plane the two share
  let px = to[0] - fx * dot;
  let py = to[1] - fy * dot;
  let pz = to[2] - fz * dot;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl;
  py /= pl;
  pz /= pl;
  const c = Math.cos(rate * dt);
  const s = Math.sin(rate * dt);
  v[0] = (fx * c + px * s) * speed;
  v[1] = (fy * c + py * s) * speed;
  v[2] = (fz * c + pz * s) * speed;
  return v;
}
