// The Battle of Scarif's set piece (Rogue One): the planet's shield is shut
// but for its gate, and the plans can't get out through it. Take the
// Persecutor's shield generators down and the Hammerhead corvette
// (Lightmaker) comes round on its flank and rams it, pushes it into the
// Intimidator, and the two Star Destroyers, locked together, fall onto the
// Shield Gate. The gate goes, the shield drops, the plans are away: the
// Rebellion's won.
//
// The ram is moved through battle.js's moveCapital and turnCapital, the
// gate and the shield through world.js's war hold.
//
// createScarif(ctx) → { update(dt, t, live, events), hit, targets, markers(live), dispose() }

import { GCW } from '../gcw';

const REBELS = 0;
const EMPIRE = 1;
export const RAM = {
  come: 7, // seconds for the Hammerhead to come round onto the Persecutor's flank
  push: 10, // and to push it into the Intimidator
  fall: 18, // the most it takes the two of them to fall onto the gate
  top: 18, // how fast they're falling by the end
};
const v = (x, y, z) => ({ x, y, z });
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const unit = (a) => {
  const l = len(a) || 1;
  return v(a.x / l, a.y / l, a.z / l);
};
const smooth = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export function createScarif(ctx) {
  const { battle, sys, world } = ctx;
  const gatePiece = sys.pieces.find((p) => p.type === 'station' && p.kind === 'gate');
  const G = gatePiece ? v(...gatePiece.at) : null;
  const pers = battle.capitals.find((c) => c.team === EMPIRE && c.role === 'flagship');
  const intim = battle.capitals.find((c) => c.team === EMPIRE && c.kind === 'destroyer' && c.role !== 'flagship');
  const hammer = battle.capitals.find((c) => c.team === REBELS && c.kind === 'hammerhead');
  let ram = null; // { age, stage, from, at, vel }

  const turnToward = (cap, dir, max) => {
    const f = cap.fwd;
    const ax = v(f.y * dir.z - f.z * dir.y, f.z * dir.x - f.x * dir.z, f.x * dir.y - f.y * dir.x);
    const a = Math.acos(Math.max(-1, Math.min(1, f.x * dir.x + f.y * dir.y + f.z * dir.z)));
    if (len(ax) > 1e-6 && a > 1e-3) battle.turnCapital(cap, ax, Math.min(a, max));
  };
  const move = (cap, d) => {
    battle.moveCapital(cap, d);
    ctx.moveHull(cap);
  };

  return {
    update(dt) {
      if (!G || !pers || !intim || battle.over) return {};
      // the Persecutor's shield down: the Hammerhead comes round
      if (!ram && battle.phase >= 2 && hammer?.alive && hammer.dying <= 0 && intim.alive) {
        const toInt = unit(sub(intim.pos, pers.pos));
        const flank = v(pers.pos.x - toInt.x * (pers.size * 0.35 + hammer.size * 0.6), pers.pos.y, pers.pos.z - toInt.z * (pers.size * 0.35 + hammer.size * 0.6));
        ram = { age: 0, stage: 'come', from: { ...hammer.pos }, flank, toInt, speed: 0, fall: 0 };
        hammer.disabled = 1e9; // (its guns are the last thing on its crew's mind)
        ctx.event('gcw-ram');
      }
      if (!ram) return {};
      ram.age += dt;
      if (ram.stage === 'come') {
        // round onto the flank, nose toward the Intimidator
        const k = smooth(ram.age / RAM.come);
        const want = v(ram.from.x + (ram.flank.x - ram.from.x) * k, ram.from.y + (ram.flank.y - ram.from.y) * k, ram.from.z + (ram.flank.z - ram.from.z) * k);
        move(hammer, sub(want, hammer.pos));
        turnToward(hammer, ram.toInt, dt * 0.8);
        if (ram.age >= RAM.come) {
          ram.stage = 'push';
          ram.age = 0;
          ctx.draw?.flash(hammer.pos, { size: 4, life: 1, color: [2.8, 1.6, 0.6] });
        }
      } else if (ram.stage === 'push') {
        // the two of them, together, into the Intimidator; the Persecutor slewing as it goes
        ram.speed = Math.min(8, ram.speed + dt * 1.6);
        const d = v(ram.toInt.x * ram.speed * dt, ram.toInt.y * ram.speed * dt, ram.toInt.z * ram.speed * dt);
        move(hammer, d);
        move(pers, d);
        battle.turnCapital(pers, { x: 0, y: 1, z: 0 }, dt * 0.03);
        const gap = len(sub(intim.pos, pers.pos));
        if (gap < pers.size * 0.4 || ram.age > RAM.push) {
          ram.stage = 'fall';
          ram.age = 0;
          for (let i = 0; i < 4; i++) ctx.draw?.flash(v(pers.pos.x + ram.toInt.x * pers.size * 0.2 * i, pers.pos.y + 1, pers.pos.z + ram.toInt.z * pers.size * 0.2 * i), { size: 9, life: 1.6 + i * 0.3, color: [3, 1.5, 0.5], bright: 1.4 });
          battle.wreck(hammer.id);
          pers.disabled = intim.disabled = 1e9;
        }
      } else if (ram.stage === 'fall') {
        // locked together, down onto the gate
        ram.fall = Math.min(RAM.top, ram.fall + dt * 2.4);
        for (const cap of [pers, intim]) {
          const to = unit(sub(G, cap.pos));
          move(cap, v(to.x * ram.fall * dt, to.y * ram.fall * dt, to.z * ram.fall * dt));
          battle.turnCapital(cap, { x: to.z, y: 0, z: -to.x }, dt * 0.05);
        }
        if (Math.random() < dt * 4) ctx.draw?.flash(v(pers.pos.x, pers.pos.y, pers.pos.z), { size: 5, life: 1, color: [3, 1.4, 0.4] });
        const near = Math.min(len(sub(pers.pos, G)), len(sub(intim.pos, G)));
        if (near < (gatePiece.size * 0.5 + pers.size * 0.3) || ram.age > RAM.fall) {
          ram.stage = 'done';
          // the gate goes, and the shield with it
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.draw?.flash(v(G.x + Math.cos(a) * gatePiece.size * 0.42, G.y, G.z + Math.sin(a) * gatePiece.size * 0.42), { size: 14, life: 2.2 + i * 0.15, color: [3.2, 1.8, 0.6], bright: 1.6 });
          }
          ctx.draw?.flash(G, { size: gatePiece.size * 1.2, life: 3, color: [2.6, 2.2, 1.4], bright: 1.8 });
          world?.war?.station('gate', false);
          world?.war?.planetShield(false);
          ctx.event('gcw-gate');
          if (ctx.tookPart()) ctx.points(GCW.points.objective * 2);
          battle.end(REBELS, 'gate');
          battle.wreck(intim.id);
          battle.wreck(pers.id);
        }
      }
      return {};
    },
    hit: () => null,
    targets: [],
    markers(live) {
      if (!live || ram || !G || battle.over) return [];
      // (the gate, while it's shut: what all this is for)
      return Math.hypot(live.x - G.x, live.y - G.y, live.z - G.z) < 600 ? [{ key: 'scarif-gate', pos: G, title: 'The Shield Gate: the plans can’t get out', colour: '#7cc8ff' }] : [];
    },
    dispose() {},
  };
}
