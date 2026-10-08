// Blasters, their heat, the bolts they fire, and what a hit does. A bolt
// is a thing that flies, not a ray: it can be dodged, it stops at the
// first wall or person in its way, and a saber guard can send it back.
// Each step a bolt is swept along the whole of the way it travels, so a
// long step (a hidden tab coming back) can’t carry it through a wall
// into someone behind. Doors are asked through `open(doorId)`, so a shut
// doorway stops bolts as a wall does. Pure apart from the combat state,
// the guns and the target it is given; scatter comes from a seeded rand.
//
//   WEAPONS                         { e11, dl44, dh17, a280 }: { damage, gap, heat, speed, spread, npcSpread, range }
//     gap: seconds between shots; heat: added a shot; speed m/s; spread° player / NPC; range m
//   COMBAT                          health, regen, calm, knock, cool, vent, guard: the shared numbers
//   createCombat() → { bolts, guns, now, next }
//   gunOf(combat, owner, weapon) → gun   { owner, weapon, heat, wait, vent }, made on first use
//   fire(combat, { from, dir, owner, side, weapon, npc }, rand) → bolt | null   null while waiting or venting
//     bolt: { id, x, y, z, dx, dy, dz, speed, owner, side, weapon, damage, life, npc }
//   stepCombat(combat, dt, { layout, open, bodies }) → events
//     bodies: [{ id, x, y, z, r, h, side, hp, deflect?: { yaw, active } }]   y is the feet
//     events: { type: 'hit', bolt, target, x, y, z, damage, owner, side, weapon, dir } (dir: the way the bolt flew)
//       | { type: 'wall', bolt, x, y, z, normal: { x, y, z }, room, door? }
//       | { type: 'deflect', bolt, by, x, y, z, side } | { type: 'vented', owner, weapon }
//   heatStep(gun, dt) → 'vented' | null
//   hurt(target, amount, now) → 'hurt' | 'down' | 'dead'
//   regen(target, dt, now) → void

export const WEAPONS = Object.freeze({
  e11: Object.freeze({ damage: 18, gap: 0.18, heat: 0.09, speed: 55, spread: 0.6, npcSpread: 2.4, range: 60 }),
  dl44: Object.freeze({ damage: 30, gap: 0.32, heat: 0.14, speed: 50, spread: 0.4, npcSpread: 2.0, range: 50 }),
  dh17: Object.freeze({ damage: 16, gap: 0.14, heat: 0.07, speed: 55, spread: 0.8, npcSpread: 2.8, range: 45 }),
  a280: Object.freeze({ damage: 24, gap: 0.22, heat: 0.1, speed: 60, spread: 0.4, npcSpread: 2.0, range: 80 }),
});

export const COMBAT = Object.freeze({
  health: 100,
  regen: 8, // health a second once calm
  calm: 5, // seconds unhurt before healing starts
  knock: 25, // a single hit this hard knocks a person down: the DL-44 does, the rifles don’t
  cool: 0.5, // heat shed a second
  vent: 2, // seconds an overheated gun can’t fire
  guard: 70, // degrees either side of where a saber guard faces that it still catches a bolt
});

const EPS = 1e-9;
const BOUNCES = 4; // deflections one bolt may take in a step, so two guards facing each other can’t loop forever
const GUARD_COS = Math.cos((COMBAT.guard * Math.PI) / 180);

export function createCombat() {
  return { bolts: [], guns: new Map(), now: 0, next: 1 };
}

export function gunOf(combat, owner, weapon) {
  const key = `${owner}/${weapon}`;
  let gun = combat.guns.get(key);
  if (!gun) {
    gun = { owner, weapon, heat: 0, wait: 0, vent: 0 };
    combat.guns.set(key, gun);
  }
  return gun;
}

// The heat stays while the gun waits out its gap, and only sheds once it is
// ready again: cooling during the gap would shed exactly an E-11’s heat a
// shot, and a held trigger would never overheat it.
export function heatStep(gun, dt) {
  const ready = Math.max(0, dt - gun.wait);
  gun.wait = Math.max(0, gun.wait - dt);
  if (gun.vent > 0) {
    if (dt < gun.vent - EPS) {
      // drains evenly over the vent, so the HUD’s bar empties as it goes
      gun.heat *= (gun.vent - dt) / gun.vent;
      gun.vent -= dt;
      return null;
    }
    gun.vent = 0;
    gun.heat = 0;
    return 'vented';
  }
  gun.heat = Math.max(0, gun.heat - COMBAT.cool * ready);
  return null;
}

// A unit direction within `deg` of `d`: an even scatter over the cone, not
// bunched at its middle.
function scatter(d, deg, rand) {
  const theta = ((deg * Math.PI) / 180) * Math.sqrt(rand());
  const phi = 2 * Math.PI * rand();
  // any axis not along d makes a pair of directions square to it
  const a = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let ux = a.y * d.z - a.z * d.y;
  let uy = a.z * d.x - a.x * d.z;
  let uz = a.x * d.y - a.y * d.x;
  const ul = Math.hypot(ux, uy, uz);
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const vx = d.y * uz - d.z * uy;
  const vy = d.z * ux - d.x * uz;
  const vz = d.x * uy - d.y * ux;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const cp = Math.cos(phi) * s;
  const sp = Math.sin(phi) * s;
  return { x: d.x * c + ux * cp + vx * sp, y: d.y * c + uy * cp + vy * sp, z: d.z * c + uz * cp + vz * sp };
}

export function fire(combat, { from, dir, owner, side, weapon, npc = false }, rand) {
  const w = WEAPONS[weapon];
  const gun = gunOf(combat, owner, weapon);
  if (gun.wait > EPS || gun.vent > 0) return null;
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const d = scatter({ x: dir.x / len, y: dir.y / len, z: dir.z / len }, npc ? w.npcSpread : w.spread, rand);
  gun.wait = w.gap;
  gun.heat += w.heat;
  // A gun overheats on the shot that leaves no room under 1 for another, so
  // the shot that would carry it to 1 is the one that sets it venting.
  if (gun.heat + w.heat > 1 + EPS) gun.vent = COMBAT.vent;
  const bolt = { id: combat.next++, x: from.x, y: from.y, z: from.z, dx: d.x, dy: d.y, dz: d.z, speed: w.speed, owner, side, weapon, damage: w.damage, life: w.range / w.speed, npc };
  combat.bolts.push(bolt);
  return bolt;
}

// The walls a bolt can strike: a field’s walls stand in open space past a
// bay’s mouth, so bolts fly on through them.
const solidWalls = new WeakMap();
function wallsOf(layout) {
  let walls = solidWalls.get(layout);
  if (!walls) {
    walls = layout.walls.filter((s) => layout.rooms.get(s.room)?.kind !== 'field');
    solidWalls.set(layout, walls);
  }
  return walls;
}

// Where along p → p + v (0..1) the line first meets a wall standing at its height there.
function wallHit(walls, open, p, v) {
  let best = null;
  const lx = Math.min(p.x, p.x + v.x);
  const hx = Math.max(p.x, p.x + v.x);
  const lz = Math.min(p.z, p.z + v.z);
  const hz = Math.max(p.z, p.z + v.z);
  for (const s of walls) {
    if (Math.max(s.x0, s.x1) < lx || Math.min(s.x0, s.x1) > hx || Math.max(s.z0, s.z1) < lz || Math.min(s.z0, s.z1) > hz) continue;
    if (s.door && open(s.door)) continue;
    const sx = s.x1 - s.x0;
    const sz = s.z1 - s.z0;
    const den = v.x * sz - v.z * sx;
    if (Math.abs(den) < 1e-12) continue;
    const qx = s.x0 - p.x;
    const qz = s.z0 - p.z;
    const t = (qx * sz - qz * sx) / den;
    const u = (qx * v.z - qz * v.x) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1 || (best && t >= best.t)) continue;
    const y = p.y + t * v.y;
    if (y < s.y0 || y > s.y1) continue;
    best = { t, wall: s };
  }
  return best;
}

// The first t ≥ 0 at which the ray o + t·v enters a sphere of radius r at c, or null.
function sphereT(o, v, c, r) {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const oz = o.z - c.z;
  const C = ox * ox + oy * oy + oz * oz - r * r;
  if (C <= 0) return 0;
  const A = v.x * v.x + v.y * v.y + v.z * v.z;
  const B = 2 * (ox * v.x + oy * v.y + oz * v.z);
  const disc = B * B - 4 * A * C;
  if (A < EPS || disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 ? t : null;
}

// Where along p → p + v (0..1) the line first touches a body’s capsule, or null.
function capsuleT(p, v, b) {
  const lo = b.y + Math.min(b.r, b.h / 2);
  const hi = Math.max(lo, b.y + b.h - b.r);
  let best = null;
  const take = (t) => {
    if (t !== null && t <= 1 && (best === null || t < best)) best = t;
  };
  // the round side, between the two end spheres
  const ox = p.x - b.x;
  const oz = p.z - b.z;
  const A = v.x * v.x + v.z * v.z;
  const C = ox * ox + oz * oz - b.r * b.r;
  if (C <= 0 && p.y >= lo && p.y <= hi) return 0;
  if (A > EPS) {
    const B = 2 * (ox * v.x + oz * v.z);
    const disc = B * B - 4 * A * C;
    if (disc >= 0) {
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      const y = p.y + t * v.y;
      if (t >= 0 && y >= lo && y <= hi) take(t);
    }
  }
  take(sphereT(p, v, { x: b.x, y: lo, z: b.z }, b.r));
  take(sphereT(p, v, { x: b.x, y: hi, z: b.z }, b.r));
  return best;
}

// Whether a saber guard faces the bolt coming at it, within COMBAT.guard degrees.
function guards(b, bolt) {
  if (!b.deflect?.active) return false;
  const h = Math.hypot(bolt.dx, bolt.dz);
  if (h < EPS) return false;
  // yaw 0 faces −z, turning towards +x; the guard must face back along the bolt
  return (Math.sin(b.deflect.yaw) * -bolt.dx + -Math.cos(b.deflect.yaw) * -bolt.dz) / h >= GUARD_COS - EPS;
}

// Moves one bolt `dist` metres along its way, stopping at the first wall or
// body; returns its events and whether it is spent.
function fly(bolt, dist, walls, open, bodies) {
  const events = [];
  let skip = null; // the guard that just sent it back, which it starts inside
  for (let bounce = 0; bounce <= BOUNCES && dist > EPS; bounce++) {
    const p = { x: bolt.x, y: bolt.y, z: bolt.z };
    const v = { x: bolt.dx * dist, y: bolt.dy * dist, z: bolt.dz * dist };
    const wall = wallHit(walls, open, p, v);
    let near = null;
    for (const b of bodies) {
      if (b === skip || b.id === bolt.owner || b.side === bolt.side || !(b.hp > 0)) continue;
      const t = capsuleT(p, v, b);
      // a body exactly at the wall is behind it: the wall wins a tie
      if (t !== null && (!wall || t < wall.t) && (!near || t < near.t)) near = { t, b };
    }
    const hit = near ?? wall;
    if (!hit) {
      bolt.x += v.x;
      bolt.y += v.y;
      bolt.z += v.z;
      return { events, spent: false };
    }
    const at = { x: p.x + v.x * hit.t, y: p.y + v.y * hit.t, z: p.z + v.z * hit.t };
    if (!near) {
      const s = wall.wall;
      let nx = -(s.z1 - s.z0);
      let nz = s.x1 - s.x0;
      const nl = Math.hypot(nx, nz);
      nx /= nl;
      nz /= nl;
      if (nx * bolt.dx + nz * bolt.dz > 0) {
        nx = -nx;
        nz = -nz;
      }
      events.push({ type: 'wall', bolt: bolt.id, ...at, normal: { x: nx, y: 0, z: nz }, room: s.room, ...(s.door ? { door: s.door } : {}) });
      return { events, spent: true };
    }
    const b = near.b;
    if (bounce < BOUNCES && guards(b, bolt)) {
      Object.assign(bolt, at, { dx: -bolt.dx, dy: -bolt.dy, dz: -bolt.dz, owner: b.id, side: b.side, life: WEAPONS[bolt.weapon].range / bolt.speed });
      events.push({ type: 'deflect', bolt: bolt.id, by: b.id, ...at, side: b.side });
      dist -= dist * near.t;
      skip = b;
      continue;
    }
    events.push({ type: 'hit', bolt: bolt.id, target: b.id, ...at, damage: bolt.damage, owner: bolt.owner, side: bolt.side, weapon: bolt.weapon, dir: { x: bolt.dx, y: bolt.dy, z: bolt.dz } });
    return { events, spent: true };
  }
  return { events, spent: false };
}

export function stepCombat(combat, dt, { layout, open, bodies = [] }) {
  combat.now += dt;
  const events = [];
  for (const gun of combat.guns.values()) if (heatStep(gun, dt) === 'vented') events.push({ type: 'vented', owner: gun.owner, weapon: gun.weapon });
  const walls = wallsOf(layout);
  const flying = [];
  for (const bolt of combat.bolts) {
    const life = bolt.life;
    const out = fly(bolt, bolt.speed * Math.min(dt, life), walls, open, bodies);
    events.push(...out.events);
    // a deflection gives the bolt a fresh range for the way back
    if (bolt.life === life) bolt.life -= dt;
    if (!out.spent && bolt.life > EPS) flying.push(bolt);
  }
  combat.bolts = flying;
  return events;
}

export function hurt(target, amount, now) {
  target.hp = Math.max(0, target.hp - amount);
  target.hurtAt = now;
  if (target.hp <= 0) return 'dead';
  return amount >= COMBAT.knock ? 'down' : 'hurt';
}

export function regen(target, dt, now) {
  const full = target.max ?? COMBAT.health;
  if (!(target.hp > 0) || target.hp >= full || now - (target.hurtAt ?? -Infinity) < COMBAT.calm) return;
  target.hp = Math.min(full, target.hp + COMBAT.regen * dt);
}
