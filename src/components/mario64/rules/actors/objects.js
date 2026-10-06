// The things in a course that aren't the cast: coins (yellow 1, red 2 and
// counted toward the red coin star, blue 5; a coin heals a wedge, and every
// 50 give a life), Power Stars, 1-Up mushrooms, signs and Toad (read on B),
// doors and star doors (shut and solid with too few stars), and the
// paintings you jump into to reach a course.

import { addDynamic, findFloor, removeDynamic } from '../collide';
import { heal } from '../physics';
import { starTotal } from '../save';

const tell = (g, type, data) => g.out.push(data ? { type, ...data } : { type });
const VALUE = { yellow: 1, red: 2, blue: 5 };
const POP_LIFE = 300; // frames a coin knocked out of something stays

function collectCoin(a, g) {
  const m = g.mario;
  const kind = a.def.kind ?? 'yellow';
  const value = VALUE[kind] ?? 1;
  const before = m.coins;
  m.coins += value;
  g.visit.coins += value;
  heal(m, value);
  a.alive = false;
  tell(g, 'coin', { value, red: kind === 'red' });
  if (Math.floor(before / 50) < Math.floor(m.coins / 50)) {
    m.lives++;
    tell(g, 'oneup');
  }
  if (kind === 'red') {
    g.visit.reds++;
    const rs = g.area.redStar;
    if (g.visit.reds === 8 && rs) {
      g.spawn({ type: 'star', index: rs.index, x: rs.x, y: rs.y, z: rs.z, appear: true });
      tell(g, 'appear', { index: rs.index });
    }
  }
}

const coin = {
  r: 50,
  h: 100,
  make(a) {
    if (a.def.pop) {
      a.vel = { x: a.def.vx ?? 0, y: 32, z: a.def.vz ?? 0 };
      a.state = 'pop';
    }
  },
  step(a, g) {
    if (a.state !== 'pop') return;
    a.pos.x += a.vel.x;
    a.pos.z += a.vel.z;
    a.vel.y -= 3;
    a.pos.y += a.vel.y;
    const f = findFloor(g.world, a.pos.x, a.pos.y + 40, a.pos.z);
    if (f && a.pos.y <= f.y) {
      a.pos.y = f.y;
      a.vel.y = Math.abs(a.vel.y) > 8 ? -a.vel.y * 0.4 : 0;
      a.vel.x *= 0.6;
      a.vel.z *= 0.6;
    }
    if (a.t > POP_LIFE) a.alive = false;
  },
  touch: collectCoin,
};

const star = {
  r: 80,
  h: 160,
  make(a) {
    a.index = a.def.index;
  },
  touch(a, g) {
    a.alive = false;
    tell(g, 'star', { index: a.def.index });
  },
};

const oneup = {
  r: 50,
  h: 90,
  touch(a, g) {
    a.alive = false;
    g.mario.lives++;
    tell(g, 'oneup');
  },
};

const sign = {
  r: 60,
  h: 140,
  talk(a, g) {
    tell(g, 'dialog', { title: a.def.title ?? 'Sign', text: a.def.text });
  },
};

const toad = {
  r: 50,
  h: 130,
  make(a) {
    a.line = 0;
  },
  step(a, g) {
    // turns to face Mario when he's near
    const m = g.mario;
    const dx = m.pos.x - a.pos.x, dz = m.pos.z - a.pos.z;
    if (dx * dx + dz * dz < 600 * 600) a.yaw = Math.atan2(dx, dz);
  },
  talk(a, g) {
    const lines = a.def.lines ?? [];
    if (!lines.length) return;
    tell(g, 'dialog', { title: a.def.title ?? 'Toad', text: lines[a.line % lines.length] });
    a.line++;
  },
};

// A door: walk into it and through to where it leads.
const door = {
  r: 90,
  h: 260,
  make(a) {
    a.cool = 0;
  },
  step(a) {
    if (a.cool > 0) a.cool--;
  },
  touch(a, g) {
    if (a.cool > 0 || !a.def.to) return;
    a.cool = 60;
    tell(g, 'warp', { area: a.def.to.area, entry: a.def.to.entry });
  },
};

// A star door: solid and shut until he has `need` stars; then he walks
// through (and on to `to`, if it leads elsewhere).
const DOOR_W = 260, DOOR_H = 380, DOOR_D = 40;
function doorBox(a) {
  const c = Math.cos(a.yaw), s = Math.sin(a.yaw);
  const P = (lx, ly, lz) => [a.pos.x + lx * c + lz * s, a.pos.y + ly, a.pos.z - lx * s + lz * c];
  const hw = DOOR_W / 2, hd = DOOR_D / 2;
  const v = [P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), P(-hw, DOOR_H, -hd), P(hw, DOOR_H, -hd), P(hw, DOOR_H, hd), P(-hw, DOOR_H, hd)];
  const quads = [
    [4, 7, 6, 5],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
  ];
  const tris = [];
  for (const [p, q, r, t] of quads) tris.push(...v[p], ...v[q], ...v[r], ...v[p], ...v[r], ...v[t]);
  return tris;
}
const stardoor = {
  r: 140,
  h: DOOR_H,
  make(a, g) {
    a.cool = 0;
    a.open = starTotal(g.save) >= (a.def.need ?? 0);
    if (!a.open) {
      const tris = doorBox(a);
      a.collider = addDynamic(g.world, { id: `door${a.id}`, tris, kinds: new Array(tris.length / 9).fill('default') });
    }
  },
  step(a, g) {
    if (a.cool > 0) a.cool--;
    if (!a.open && starTotal(g.save) >= (a.def.need ?? 0)) {
      a.open = true;
      if (a.collider) removeDynamic(g.world, a.collider);
      a.collider = null;
    }
  },
  touch(a, g) {
    if (a.cool > 0) return;
    if (!a.open) {
      a.cool = 90;
      tell(g, 'locked', { need: a.def.need });
      return;
    }
    if (a.def.to) {
      a.cool = 60;
      tell(g, 'warp', { area: a.def.to.area, entry: a.def.to.entry });
    }
  },
};

// A painting on a wall, facing `yaw`, w wide and h tall from its bottom
// middle: jumped into (his chest within 60 of it, inside it, moving into it)
// it opens its course's card.
const painting = {
  r: 0,
  h: 0,
  make(a) {
    a.cool = 0;
    a.w = a.def.w ?? 600;
    a.ph = a.def.h ?? 600;
  },
  check(a, g) {
    if (a.cool > 0) {
      a.cool--;
      return;
    }
    const m = g.mario;
    const nx = Math.sin(a.yaw), nz = Math.cos(a.yaw);
    const cx = m.pos.x - a.pos.x, cz = m.pos.z - a.pos.z;
    const front = cx * nx + cz * nz; // how far in front of it
    const across = cx * nz - cz * nx;
    const up = m.pos.y + 80 - a.pos.y;
    const into = m.vel.x * nx + m.vel.z * nz < -1;
    if (front > -20 && front < 60 && Math.abs(across) < a.w / 2 && up > 0 && up < a.ph && into) {
      a.cool = 90;
      tell(g, 'card', { course: a.def.course });
    }
  },
};

export const OBJECTS = { coin, star, oneup, sign, toad, door, stardoor, painting };
