// The Mortytown Locos (the Citadel's side quest, ./story.js's `locos`):
// the three Mortys who robbed Morty Mart are hiding down Mortytown's
// alleys. Come up on one (close, and in sight) and he gives himself up and
// follows you, at a walk; walk him to Cop Morty outside Morty Mart and he's
// handed over. Run, and the ones behind you lose interest and slink back to
// their alley; go back up to the concourse and they do the same. No
// drawing: ./district.js draws them where this puts them.
//
//   newHunt(seed) → { locos: [{ id, hide, x, z, face, speed, state }], state }
//   stepHunt(hunt, rick, dt, { push }) → events: found, lost, delivered, won
//   leaveHunt(hunt) → the ids sent back to their alleys

import { pushOut, sightClear } from '../../middleearth/towns/walker';
import { COLLIDERS, COP, HIDES, WALLS } from './mortytown';

// find: how close you have to be to see him; follow: how far behind each
// keeps; walk: their pace (a touch under Rick's); leash: how far behind one
// falls before he gives up; deliver: how close to Cop Morty is handed over
export const HUNT = { count: 3, find: 2.5, follow: 1.4, walk: 3.5, leash: 14, deliver: 3 };
const IDS = ['loco-a', 'loco-b', 'loco-c'];
const RADIUS = 0.32;
// where the handed-over stand, along Morty Mart's shopfront by Cop Morty
const SLOTS = [1.4, 2.4, 3.4].map((dx) => ({ x: COP.x + dx, z: 8.9 }));
const FACE_STREET = Math.PI / 2;

const defaultPush = (x, z, r) => pushOut(x, z, r, COLLIDERS, WALLS);

// Three of the hides, which three and who's where turning on the seed.
export function newHunt(seed = 1) {
  const s = Math.abs(Math.floor(seed)) || 0;
  const left = HIDES.filter((_, i) => i !== s % HIDES.length);
  const turn = Math.floor(s / HIDES.length) % IDS.length;
  const locos = IDS.map((id, i) => {
    const h = left[(i + turn) % left.length];
    return { id, hide: h.id, x: h.x, z: h.z, face: h.face, speed: 0, state: 'hiding', order: -1 };
  });
  return { locos, state: 'on', found: 0, handed: 0 };
}

const backHome = (l) => {
  const h = HIDES.find((x) => x.id === l.hide);
  Object.assign(l, { state: 'hiding', x: h.x, z: h.z, face: h.face, speed: 0, order: -1 });
};

// a step towards (tx, tz), stopping `gap` short, at up to `top`
function walkTo(l, tx, tz, gap, top, dt, push) {
  const dx = tx - l.x;
  const dz = tz - l.z;
  const d = Math.hypot(dx, dz);
  if (d <= gap + 0.02) {
    l.speed = 0;
    return;
  }
  const v = Math.min(top, (d - gap) * 4);
  const k = Math.min(d - gap, v * dt) / d;
  const [x, z] = push(l.x + dx * k, l.z + dz * k, RADIUS);
  l.speed = Math.hypot(x - l.x, z - l.z) / Math.max(dt, 1e-6);
  l.x = x;
  l.z = z;
  l.face = Math.atan2(-dz, dx);
}

export function stepHunt(hunt, rick, dt, { push = defaultPush } = {}) {
  const events = [];
  if (hunt.state !== 'on') return events;
  // found: up close, and nothing between you
  for (const l of hunt.locos) {
    if (l.state !== 'hiding') continue;
    if (Math.hypot(l.x - rick.x, l.z - rick.z) < HUNT.find && sightClear(rick.x, rick.z, l.x, l.z, COLLIDERS, WALLS)) {
      l.state = 'following';
      l.order = hunt.found++;
      events.push({ type: 'found', id: l.id });
    }
  }
  // following, in a line: the first behind Rick, each next behind the one before
  const line = hunt.locos.filter((l) => l.state === 'following').sort((a, b) => a.order - b.order);
  let lead = rick;
  for (const l of line) {
    walkTo(l, lead.x, lead.z, HUNT.follow, HUNT.walk, dt, push);
    if (Math.hypot(l.x - rick.x, l.z - rick.z) > HUNT.leash) {
      backHome(l);
      events.push({ type: 'lost', id: l.id });
      continue;
    }
    if (Math.hypot(l.x - COP.x, l.z - COP.z) < HUNT.deliver) {
      l.state = 'delivered';
      l.slot = hunt.handed++;
      events.push({ type: 'delivered', id: l.id });
      continue;
    }
    lead = l;
  }
  // the handed-over, to their places by Cop Morty
  for (const l of hunt.locos) {
    if (l.state !== 'delivered') continue;
    const at = SLOTS[l.slot] ?? SLOTS[0];
    walkTo(l, at.x, at.z, 0, HUNT.walk, dt, push);
    if (l.speed === 0) l.face = FACE_STREET;
  }
  if (hunt.locos.every((l) => l.state === 'delivered')) {
    hunt.state = 'won';
    events.push({ type: 'won' });
  }
  return events;
}

// Rick's gone back up: whoever was following goes back to his alley.
export function leaveHunt(hunt) {
  const sent = [];
  for (const l of hunt.locos) {
    if (l.state !== 'following') continue;
    backHome(l);
    sent.push(l.id);
  }
  return sent;
}
