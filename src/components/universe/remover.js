// The Galactic Federation's NX-5 Planet Remover (Rick and Morty's side's
// capital-ship event, director.js's `remover`), as plain rules: it drops out
// of warp over the planet you're at, charges the ring of cannon at its bow,
// and fires; knock it out first (anything hurts it) or the planet's gone for
// a minute. Pure (no three.js): scene.js plays it, removerView.js draws it.
//
// Damage is kept as the siege keeps it (siege.js): your share, and each
// other pilot's as they last told it (a share only grows), so hits from two
// pilots at once both count and anyone who hears agrees. A removed planet
// is only a sight: it's drawn dark and cracked, and a landing on it is
// refused while it's gone; whoever's already down there stays down.
//
//   newRemover(planet) → { planet, phase, t, charge, firedAt, … }
//   stepRemover(r, dt) → 'fired' | 'left' | null
//   hitRemover(r, damage) → 'hit' | 'destroyed' | null (yours)
//   hearRemover(r, peer, share) → 'hit' | 'destroyed' | null (theirs, all told)
//   hpLeft(r), removedUntil(r) (its clock), landingOpen(gone, planet, now)

// arrive: seconds out of warp; charge: seconds charging; hp: punches
// (weapons.js: a blaster bolt is one); gone: seconds a planet's away;
// leave: seconds it lingers after firing; blast: seconds it takes to go up
export const REMOVER = { arrive: 6, charge: 40, hp: 36, gone: 60, leave: 8, blast: 3 };

export function newRemover(planet) {
  return { planet, phase: 'arriving', t: 0, charge: 0, firedAt: null, diedAt: null, mine: 0, others: new Map() };
}

export function hpLeft(r) {
  let done = r.mine;
  for (const v of r.others.values()) done += v;
  return Math.max(0, REMOVER.hp - done);
}

const hittable = (r) => r.phase === 'arriving' || r.phase === 'charging';
const after = (r) => {
  if (hpLeft(r) > 0) return 'hit';
  r.phase = 'destroyed';
  r.diedAt = r.t;
  return 'destroyed';
};

export function hitRemover(r, damage) {
  if (!hittable(r) || !(damage >= 0)) return null;
  r.mine += damage;
  return after(r);
}

export function hearRemover(r, peer, share) {
  if (!hittable(r) || !(share >= 0) || share <= (r.others.get(peer) ?? 0)) return null;
  r.others.set(peer, Math.min(REMOVER.hp, share));
  return after(r);
}

export function stepRemover(r, dt) {
  r.t += dt;
  if (r.phase === 'arriving' && r.t >= REMOVER.arrive) r.phase = 'charging';
  if (r.phase === 'charging') {
    r.charge = Math.min(1, Math.max(0, (r.t - REMOVER.arrive) / REMOVER.charge));
    if (r.t >= REMOVER.arrive + REMOVER.charge) {
      r.phase = 'fired';
      r.firedAt = r.t;
      return 'fired';
    }
  } else if (r.phase === 'fired' && r.t >= r.firedAt + REMOVER.leave) {
    r.phase = 'gone';
    return 'left';
  } else if (r.phase === 'destroyed' && r.t >= r.diedAt + REMOVER.blast) {
    r.phase = 'gone';
    return 'left';
  }
  return null;
}

export const removedUntil = (r) => (r.firedAt === null ? null : r.firedAt + REMOVER.gone);

// gone: planet → until when (the scene's clock) it's removed
export const landingOpen = (gone, planet, now) => !(gone?.[planet] > now);
