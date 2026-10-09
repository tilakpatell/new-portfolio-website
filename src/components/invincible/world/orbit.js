// Space, as plain numbers: what happens once Mark flies up out of the
// city's air (./flight.js says when, with an 'exit'). The Earth is a
// sphere with the city on top of it, so where he was over the city is
// where he is over the world: [x, RE + y, z]. Up here he drifts where he
// was going (there's no air to slow him), goes twenty-odd times faster
// flat out, lands on the Moon or Mars and stands on them, jumps off again,
// and when he dives back into the air ('reenter') he comes down over the
// city again. The distances are a game's, not the solar system's: the
// Moon is a couple of minutes' cruise away, Mars a long flat-out flight.

import { pressOf, turn } from './flight';
import { WORLD } from './map';

export const SPACE = {
  RE: 60000, // the Earth's radius
  cruise: 500, // m/s, with only a direction held
  top: 6000, // flat out
  accel: 350,
  boostAccel: 1600,
  brake: 700,
  drift: 0.04, // how much of his speed goes, a second, with nothing held
  reentry: WORLD.ceiling - 1500, // back into the air below this
  bound: 900000,
};

// what's out there: [x, y, z] its middle, r its radius
export const BODIES = [
  // (both low over the city's horizon, on the side the noon sun lights from the Earth)
  { id: 'moon', name: 'The Moon', c: [111000, 18000, -99000], r: 9000 },
  { id: 'mars', name: 'Mars', c: [86000, 64500, -417000], r: 7000 },
];

const STEP = 1 / 120;
const len = (v) => Math.hypot(v[0], v[1], v[2]);
export const altitudeOf = (h) => len(h.p) - SPACE.RE;

// From the city's air to space: the same place, the same speed.
export function intoSpace(h) {
  return { ...h, zone: 'space', p: [h.p[0], SPACE.RE + h.p[1], h.p[2]], v: [...h.v], dir: [...h.dir], mode: 'air', perch: null, reentered: false, ev: [] };
}

// From space back into the city's air: over the city (wherever he came
// down: it's the only city there is), just under the top of the sky,
// coming down.
export function outOfSpace(h) {
  const r = len(h.p) || 1;
  const up = h.p.map((v) => v / r);
  const lim = WORLD.half - 250;
  const over = up[1] > 0.96;
  const x = over ? Math.max(-lim, Math.min(lim, h.p[0])) : 0;
  const z = over ? Math.max(-lim, Math.min(lim, h.p[2])) : 0;
  const radial = h.v[0] * up[0] + h.v[1] * up[1] + h.v[2] * up[2];
  let v = [h.v[0] - up[0] * radial, Math.min(-40, radial), h.v[2] - up[2] * radial];
  const sp = len(v);
  if (sp > 450) v = v.map((c) => (c * 450) / sp);
  const s = len(v) || 1;
  return { ...h, zone: 'city', mode: 'air', p: [x, WORLD.ceiling - 300, z], v, spd: s, dir: v.map((c) => c / s), perch: null, boomed: s > 120, exited: true, stun: 0, crouch: 0, ev: [] };
}

function stepOnce(h, input, dt, press) {
  if (h.mode === 'perch') {
    if (press.take() || (input.up ?? 0) > 0.5) {
      const n = h.perch.n;
      h.mode = 'air';
      h.p = h.p.map((v, i) => v + n[i] * 0.5);
      h.v = n.map((c) => c * 40);
      h.ev.push({ type: 'launch', body: h.perch.body });
      h.perch = null;
    } else return;
  }
  // where he wants to go: the camera's way, and up or down
  const [lx, ly, lz] = input.look;
  const rl = Math.hypot(lx, lz) || 1;
  const right = [-lz / rl, 0, lx / rl];
  const fwd = input.fwd ?? 0;
  const side = input.side ?? 0;
  const vert = (input.up ?? 0) - (input.down ?? 0);
  const m = [lx * fwd + right[0] * side, ly * fwd + vert, lz * fwd + right[2] * side];
  const ml = len(m);
  const sp = len(h.v);
  if (input.boost || ml > 0.05) {
    const D = ml > 0.05 ? m.map((c) => c / ml) : [lx, ly, lz];
    const S = input.boost ? SPACE.top : SPACE.cruise * Math.min(1, ml);
    const dir = sp > 1 ? turn(h.v.map((c) => c / sp), D, (3 - 1.8 * Math.min(1, sp / SPACE.top)) * dt) : D;
    const ns = sp < S ? Math.min(S, sp + (input.boost ? SPACE.boostAccel : SPACE.accel) * dt) : Math.max(S, sp - SPACE.brake * dt);
    h.v = dir.map((c) => c * ns);
  } else h.v = h.v.map((c) => c * (1 - SPACE.drift * dt));
  h.p = h.p.map((c, i) => c + h.v[i] * dt);

  // the Moon and Mars: stand on whichever he comes down on
  for (const b of BODIES) {
    const d = [h.p[0] - b.c[0], h.p[1] - b.c[1], h.p[2] - b.c[2]];
    const dl = len(d);
    if (dl >= b.r || dl < 1e-6) continue;
    const n = d.map((c) => c / dl);
    h.p = b.c.map((c, i) => c + n[i] * b.r);
    h.ev.push({ type: 'land', body: b.id, speed: len(h.v), at: [...h.p], n });
    h.mode = 'perch';
    h.perch = { body: b.id, n };
    h.v = [0, 0, 0];
    return;
  }
  // the Earth: back into the air
  const r = len(h.p) || 1;
  const radial = (h.v[0] * h.p[0] + h.v[1] * h.p[1] + h.v[2] * h.p[2]) / r;
  if (!h.reentered && r - SPACE.RE < SPACE.reentry && radial < 0) {
    h.reentered = true;
    h.ev.push({ type: 'reenter', speed: len(h.v) });
  }
  if (r - SPACE.RE < 200) h.p = h.p.map((c) => (c * (SPACE.RE + 200)) / r);
  if (r > SPACE.bound) h.p = h.p.map((c) => (c * SPACE.bound) / r);
}

export function stepSpace(hero, input, dt) {
  const h = { ...hero, p: [...hero.p], v: [...hero.v], ev: [] };
  const n = Math.max(1, Math.ceil(dt / STEP - 1e-9));
  // (the jump as on the ground: ./flight.js's press, pressed a moment early still goes)
  const press = pressOf(input);
  for (let i = 0; i < n; i++) {
    press.ground(h.mode === 'perch', dt / n);
    stepOnce(h, input, dt / n, press);
  }
  const s = len(h.v);
  h.spd = s;
  if (s > 1e-6) h.dir = h.v.map((c) => c / s);
  if (s > 3) h.face = Math.atan2(h.v[0], h.v[2]);
  return h;
}
