// Building from the ship, as rules: where a turret may go down (low and slow
// over the planet's own ground, never on a place's flat, which the database
// refuses as well: its check_placement), where it goes (on the ground under
// the ship, turned as the ship is) and which of yours X takes down. Pure, so
// it's tested.
//
//   BUILD = { up, speed, reach }
//   canBuild(ship, groundY, pois) → { ok, why } (why: a sentence, or null)
//   placementFor(ship, groundY) → { x, y, z, rot: [0, yaw, 0], scale: 1 }
//   nearestOwn(entities, ship, owner) → your nearest within reach, or null
//   grounded(entity, terrainVersion, heightAt) → the entity, put back on the
//     ground when it was built on an older one (STAND: each kind's foot)

export const BUILD = {
  up: 60, // m over the ground, at most
  speed: 120, // m/s, under
  reach: 30, // m, across the ground, for X
};

export function canBuild(ship, groundY, pois = []) {
  if (!Number.isFinite(groundY)) return { ok: false, why: 'The ground here isn’t in yet.' };
  if (ship.y - groundY > BUILD.up) return { ok: false, why: `Come down under ${BUILD.up} m to build.` };
  if (ship.speed >= BUILD.speed) return { ok: false, why: `Slow down under ${BUILD.speed} m/s to build.` };
  // (the flat and the land easing into it: r + edge, as the seed gives the database)
  const on = pois.find((p) => Math.hypot(ship.x - p.at[0], ship.z - p.at[1]) <= p.r + (p.edge ?? 0));
  if (on) return { ok: false, why: `Nothing can be built at ${on.name}.` };
  return { ok: true, why: null };
}

export const placementFor = (ship, groundY) => ({ x: ship.x, y: groundY, z: ship.z, rot: [0, ship.yaw, 0], scale: 1 });

export function nearestOwn(entities, ship, owner) {
  if (!owner) return null;
  let best = null;
  let bestD = BUILD.reach;
  for (const e of entities) {
    if (e.owner !== owner) continue;
    const d = Math.hypot(e.x - ship.x, e.z - ship.z);
    if (d <= bestD) [best, bestD] = [e, d];
  }
  return best;
}

// where each kind's foot is, over the ground (a wreck lies half sunk)
export const STAND = { turret: 0, structure: 0, beacon: 0, wreck: -1 };

// A thing built on an older ground (planetSpec.js's TERRAIN_VERSION moved
// on since) stands where the ground is now, not at the height it was stored
// at; drawn there, and left so in the database (only its owner may write it).
export function grounded(e, version, heightAt) {
  if ((e.terrainVersion ?? 1) >= version) return e;
  const h = heightAt(e.x, e.z);
  return Number.isFinite(h) ? { ...e, y: h + (STAND[e.type] ?? 0), terrainVersion: version } : e;
}
