// Blades and the Force against you, played through the game's own step: Vader
// closes in and cuts, a guard turns his strokes, your blade beats him down, the
// Emperor's lightning burns but never kills on its own, and nobody with a blade
// runs from a fight.
import { describe, expect, it } from 'vitest';
import { STEP, drain, newGame, step, teleport } from '../game';
import { removePerson } from '../brains';
import { spawnOne } from './plot';
import { toStep } from './beats';

const STILL = { dir: { x: 0, z: 0 }, pitch: 0 };
const yawTo = (a, b) => Math.atan2(b.x - a.x, -(b.z - a.z));

// you in the throne room with a blade, and one set on you a few metres in front
function face(kind, { hostile = true, metres = 5 } = {}) {
  const g = newGame({ station: 'ds2', side: 'rebel', mode: 'roam', seed: 4 });
  // (the room to yourselves: the throne's own guards would join in)
  for (const q of [...g.crew.people]) removePerson(g.crew, q.id);
  teleport(g, 'throne', 6, -70, 0);
  Object.assign(g.you, { gun: null, blade: 'green' });
  g.layout.station.spots.__duel = { room: 'throne', x: 6, z: -70 - metres, yaw: Math.PI };
  const p = spawnOne(g, { kind, spot: '__duel', tag: `foe-${kind}`, role: 'scripted', hostile });
  delete g.layout.station.spots.__duel;
  drain(g);
  return { g, p };
}

function play(g, seconds, input = () => ({})) {
  const events = [];
  for (let t = 0; t < seconds; t += STEP) {
    step(g, { ...STILL, yaw: g.you.yaw, ...input(g) });
    events.push(...drain(g));
  }
  return events;
}

describe('Vader with his blade', () => {
  it('closes in on you and cuts, and never runs', () => {
    const { g, p } = face('vader');
    // (your health topped up, so you stand there for him)
    const events = play(g, 6, (gg) => ((gg.you.hp = 100), {}));
    expect(Math.hypot(p.x - g.you.x, p.z - g.you.z)).toBeLessThan(2.2);
    expect(p.mode).not.toBe('flee');
    expect(events.some((e) => e.type === 'hurt' && e.by === 'blade')).toBe(true);
  });

  it('is held off by a guard raised as his stroke comes: far less gets through than with none', () => {
    const open = face('vader');
    const guarded = face('vader');
    const lost = (g, input) => {
      let n = 0;
      for (let t = 0; t < 12; t += STEP) {
        step(g, { ...STILL, ...input(g) });
        n += drain(g).filter((e) => e.type === 'hurt' && e.by === 'blade').reduce((k, e) => k + e.amount, 0);
        g.you.hp = 100;
      }
      return n;
    };
    const openLost = lost(open.g, (g) => ({ yaw: yawTo(g.you, open.p) }));
    // (up a beat after his stroke begins, inside the parry's window; down otherwise)
    const guardLost = lost(guarded.g, (g) => {
      const s = g.duel?.fighters.get(guarded.p.id)?.stroke;
      return { yaw: yawTo(g.you, guarded.p), aim: Boolean(s && s.t >= 0.04) };
    });
    expect(openLost).toBeGreaterThan(0);
    expect(guardLost).toBeLessThan(openLost / 2);
  });

  it('is beaten down by your strokes in the end, and the story hears it', () => {
    const { g, p } = face('vader');
    let killed = false;
    for (let t = 0; t < 90 && !killed; t += STEP) {
      // (strokes when he is in reach, the guard up otherwise; your health topped up)
      const near = Math.hypot(p.x - g.you.x, p.z - g.you.z) < 2.2;
      step(g, { ...STILL, yaw: yawTo(g.you, p), fire: near && Math.round(t / STEP) % 20 < 3, aim: !near || Math.round(t / STEP) % 20 >= 3 });
      killed = drain(g).some((e) => e.type === 'died' && e.id === p.id);
      g.you.hp = 100;
    }
    expect(killed).toBe(true);
  });
});

describe('Vader in the second station’s duel', () => {
  it('gives ground at half his health and the story moves on, and is never killed', () => {
    const g = toStep('ds2', 'rebel', 'duel');
    const p = g.crew.people.find((q) => q.tag === 'duel-vader');
    expect(p).toBeTruthy();
    for (let t = 0; t < 120 && g.plot.progress.step === 'duel'; t += STEP) {
      const near = Math.hypot(p.x - g.you.x, p.z - g.you.z) < 2.2;
      step(g, { ...STILL, yaw: yawTo(g.you, p), fire: near && Math.round(t / STEP) % 20 < 3, aim: !near || Math.round(t / STEP) % 20 >= 3 });
      drain(g);
      g.you.hp = 100;
    }
    expect(g.plot.progress.step).toBe('duel-hide');
    expect(p.hp).toBeGreaterThan(0);
    expect(p.hp).toBeLessThanOrEqual(p.max / 2 + 1e-9);
    // (and he fights no more)
    const before = g.you.hp;
    play(g, 3);
    expect(g.you.hp).toBe(before);
  });
});

describe('the Royal Guard with his pike', () => {
  it('comes at you rather than fleeing', () => {
    const { g, p } = face('royalguard');
    play(g, 5, (gg) => ((gg.you.hp = 100), {}));
    expect(p.mode).not.toBe('flee');
    expect(Math.hypot(p.x - g.you.x, p.z - g.you.z)).toBeLessThan(2.4);
  });

  it('fights an undisguised Rebel he sees in free roam, story or none', () => {
    const { g, p } = face('royalguard', { hostile: null });
    p.mode = 'routine';
    p.role = { type: 'post', spot: { x: p.x, z: p.z, room: p.room, yaw: p.yaw } };
    play(g, 4);
    expect(['fight', 'search']).toContain(p.mode);
  });
});

describe('the Emperor’s lightning', () => {
  it('burns you, half as much through your raised arms, and never past your last breath', () => {
    const open = face('emperor', { metres: 6 });
    const guarded = face('emperor', { metres: 6 });
    open.g.you.blade = guarded.g.you.blade = null;
    play(open.g, 4, (g) => ({ yaw: yawTo(g.you, open.p) }));
    play(guarded.g, 4, (g) => ({ yaw: yawTo(g.you, guarded.p), aim: true }));
    expect(open.g.you.hp).toBeLessThan(100);
    expect(100 - guarded.g.you.hp).toBeLessThan((100 - open.g.you.hp) * 0.75);
    play(open.g, 30, (g) => ({ yaw: yawTo(g.you, open.p) }));
    expect(open.g.you.hp).toBeGreaterThanOrEqual(1);
  });

  it('draws his lightning on you while it burns, for the scene', () => {
    const { g, p } = face('emperor', { metres: 6 });
    let seen = false;
    for (let t = 0; t < 4 && !seen; t += STEP) {
      step(g, { ...STILL, yaw: yawTo(g.you, p) });
      drain(g);
      seen = g.duel?.lit === p.id;
    }
    expect(seen).toBe(true);
  });
});
