// The Flaxans come through a portal over the river, as plain numbers (the
// drawing is ./flaxans.js). A dozen of them, a few at a time, fly at Mark
// and circle him, firing slow purple bolts; a punch (with a lunge at
// whoever's a little way off in front of him) or flying into one fast
// knocks it out of the sky, and when they're all down the portal closes.
// Their bolts knock him about, and enough of them put him down on the
// street for a moment. Nothing happens until something starts it (Cecil,
// or the city's clock).
//
// stepFight(fight, hero, { punch, look }, dt) → { fight, ev, push, stun }:
// `push` a velocity to give him (a lunge, a knock), `stun` a moment
// without control. A step is never longer than a twentieth of a second,
// whatever `dt` says (a tab hidden for a minute comes back as one step).

import { WATER_Y, groundAt, rng } from './map';

export const PORTAL = { p: [1150, 150, -420], r: 22, n: [-1, 0, 0] }; // over the river, facing downtown
export const FIGHT = {
  count: 12,
  every: 1.2, // seconds between each coming through
  speed: 24,
  orbit: 22, // how far off they circle him
  range: 75, // how near before they fire
  bolt: 45, // m/s
  hurt: 12, // of his 100
  reach: 4.5, // a punch
  lunge: 18, // a punch at someone this far off carries him to them
  lungeSpeed: 70,
  ram: 45, // flying into one faster than this knocks it out
  hp: 100,
};

export function newFight(seed = 77) {
  return { on: false, t: 0, seed, foes: [], spawned: 0, bolts: [], hp: FIGHT.hp, cool: 0, lunge: null, won: 0 };
}

export function startInvasion(f) {
  const r = rng(f.seed + f.won * 13);
  const foes = Array.from({ length: FIGHT.count }, (_, i) => ({ id: i, state: 'waiting', p: [...PORTAL.p], v: [0, 0, 0], cool: 1.5 + r() * 2, phase: r() * Math.PI * 2, lean: 0 }));
  return { ...f, on: true, t: 0, foes, spawned: 0, bolts: [], hp: FIGHT.hp, cool: 0, lunge: null };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
// how near the move a→b came to c
function nearest(a, b, c) {
  const d = sub(b, a);
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const k = dd ? Math.max(0, Math.min(1, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / dd)) : 0;
  return len(sub([a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k], c));
}

function knockOut(f, e, from, ev, extra = {}) {
  const d = unit(sub(e.p, from));
  e.state = 'ko';
  e.ko = 0;
  e.v = [d[0] * 40, d[1] * 40 + 12, d[2] * 40];
  ev.push({ type: 'ko', id: e.id, at: [...e.p], dir: d, ...extra });
}

export function stepFight(prev, hero, input, rawDt) {
  const ev = [];
  if (!prev.on) return { fight: prev, ev, push: null, stun: 0 };
  // a twentieth of a second at most (and a step of NaN is no step at all)
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  const f = { ...prev, foes: prev.foes.map((e) => ({ ...e, p: [...e.p], v: [...e.v] })), bolts: prev.bolts.map((b) => ({ ...b, p: [...b.p] })) };
  const r = rng(f.seed + Math.floor(f.t * 10));
  f.t += dt;
  const chest = [hero.p[0], hero.p[1] + 1, hero.p[2]];
  const heroSpeed = len(hero.v);
  // where his chest was a step ago: flat out, a slow frame carries him further than a Flaxan is wide
  const was = [chest[0] - hero.v[0] * dt, chest[1] - hero.v[1] * dt, chest[2] - hero.v[2] * dt];
  let push = null;
  let stun = 0;

  // through the portal, one at a time
  if (f.spawned < FIGHT.count && f.t > f.spawned * FIGHT.every + 0.6) {
    const e = f.foes[f.spawned++];
    e.state = 'fight';
    e.p = [PORTAL.p[0] + (r() - 0.5) * 8, PORTAL.p[1] + (r() - 0.5) * 8, PORTAL.p[2] + (r() - 0.5) * 8];
    e.v = PORTAL.n.map((c) => c * FIGHT.speed);
    ev.push({ type: 'spawn', id: e.id, at: [...e.p] });
  }

  // his punch: whoever's in front of him and near, or a lunge to whoever's a little way off
  f.cool = Math.max(0, f.cool - dt);
  if (input.punch && f.cool <= 0) {
    f.cool = 0.35;
    ev.push({ type: 'punch' });
    const look = unit(input.look);
    let best = null;
    for (const e of f.foes) {
      if (e.state !== 'fight') continue;
      const d = sub(e.p, chest);
      const dl = len(d);
      if (dl > FIGHT.lunge) continue;
      const cos = (d[0] * look[0] + d[1] * look[1] + d[2] * look[2]) / (dl || 1);
      if (dl > FIGHT.reach && cos < 0.64) continue;
      if (!best || dl < best.dl) best = { e, dl, d };
    }
    if (best && best.dl <= FIGHT.reach) knockOut(f, best.e, chest, ev, { punched: true });
    else if (best) {
      push = unit(best.d).map((c) => c * FIGHT.lungeSpeed);
      f.lunge = { id: best.e.id, t: 0.4 };
      ev.push({ type: 'lunge', id: best.e.id });
    }
  }
  if (f.lunge) {
    f.lunge.t -= dt;
    const e = f.foes[f.lunge.id];
    if (e.state === 'fight' && len(sub(e.p, chest)) <= FIGHT.reach) {
      knockOut(f, e, chest, ev, { punched: true });
      f.lunge = null;
    } else if (f.lunge.t <= 0) f.lunge = null;
  }

  // the Flaxans
  const toHero = len(sub(PORTAL.p, chest));
  for (const e of f.foes) {
    if (e.state === 'fight') {
      // flying into one fast
      if (heroSpeed > FIGHT.ram && nearest(was, chest, e.p) < 2.8) {
        knockOut(f, e, chest, ev, { rammed: true });
        continue;
      }
      // round him, or round the portal if he's nowhere near it
      e.phase += dt * 0.6;
      const c = toHero < 700 ? chest : PORTAL.p;
      const want = [c[0] + Math.cos(e.phase) * FIGHT.orbit, c[1] + 6 + Math.sin(e.phase * 1.7) * 6, c[2] + Math.sin(e.phase) * FIGHT.orbit];
      const d = sub(want, e.p);
      const go = unit(d).map((x) => x * Math.min(FIGHT.speed, len(d) * 1.5));
      const k = 1 - Math.exp(-2.5 * dt);
      for (const a of [0, 1, 2]) e.v[a] += (go[a] - e.v[a]) * k;
      for (const a of [0, 1, 2]) e.p[a] += e.v[a] * dt;
      // and fire at him when he's in range
      e.cool -= dt;
      const dh = sub(chest, e.p);
      if (e.cool <= 0 && len(dh) < FIGHT.range && toHero < 700) {
        e.cool = 2.4 + r() * 1.8;
        f.bolts.push({ p: [...e.p], v: unit(dh).map((x) => x * FIGHT.bolt), life: 3 });
        ev.push({ type: 'bolt', id: e.id, at: [...e.p] });
      }
    } else if (e.state === 'ko') {
      // knocked flying, then falling, then gone
      e.ko += dt;
      e.v[1] -= 9.8 * dt;
      for (const a of [0, 1, 2]) e.p[a] += e.v[a] * dt;
      if (e.ko > 3 || e.p[1] < Math.max(groundAt(e.p[0], e.p[2]), WATER_Y)) {
        e.state = 'down';
        ev.push({ type: 'down', id: e.id, at: [...e.p] });
      }
    }
  }

  // the bolts
  const left = [];
  for (const b of f.bolts) {
    b.life -= dt;
    for (const a of [0, 1, 2]) b.p[a] += b.v[a] * dt;
    if (len(sub(b.p, chest)) < 1.3) {
      f.hp -= FIGHT.hurt;
      ev.push({ type: 'hurt', at: [...b.p], hp: f.hp });
      push = unit(b.v).map((x) => x * 14);
      stun = 0.25;
      continue;
    }
    if (b.life > 0) left.push(b);
  }
  f.bolts = left;
  if (f.hp <= 0) {
    // down on the street for a moment, and back up
    f.hp = FIGHT.hp;
    push = [0, -60, 0];
    stun = 1.2;
    ev.push({ type: 'beaten' });
  }

  // all of them down: the portal closes
  if (f.spawned >= FIGHT.count && f.foes.every((e) => e.state === 'ko' || e.state === 'down')) {
    f.on = false;
    f.won++;
    f.bolts = [];
    ev.push({ type: 'won', count: f.won, time: f.t });
  }
  return { fight: f, ev, push, stun };
}
