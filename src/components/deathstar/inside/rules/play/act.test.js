// What E does for the story: at whatever a step names (someone, a thing, a
// place on a wall, a hull, something you carry), facing it, E does that
// step's work, on both sides of both stations.
import { describe, expect, it } from 'vitest';
import { furnish } from '../furnish';
import { drain, newGame, promptOf, step, teleport } from '../game';
import { storySteps } from './plot';
import { toStep } from './beats';

const STORIES = [
  ['ds1', 'rebel'],
  ['ds1', 'imperial'],
  ['ds2', 'rebel'],
  ['ds2', 'imperial'],
];

// where a step's target stands: someone by tag, a furnished thing, a spot by the name, a jump
function placeOf(g, t) {
  const tag = t.npc ?? t.tag;
  const p = g.crew.people.find((q) => (q.tag === tag || q.id === tag) && q.hp > 0);
  if (p) return { room: p.room, x: p.x, z: p.z, size: 0 };
  for (const room of g.layout.rooms.values()) {
    const th = furnish(room, g.layout.station).props.find((q) => q.tag === tag);
    if (th) return { room: room.id, x: th.x, z: th.z, size: Math.max(th.w ?? 0, th.d ?? 0) / 2 };
  }
  const j = g.layout.jumps?.find((q) => q.id === tag);
  if (j) return { room: j.from, x: j.x, z: j.z, size: 0 };
  const s = g.layout.station.spots?.[tag];
  if (s) return { room: s.room, x: s.x, z: s.z, size: 0 };
  return null;
}

const named = [];
for (const [station, side] of STORIES) {
  for (const s of storySteps(newGame({ station, side, mode: 'story', seed: 5 }))) {
    if (['use', 'talk', 'choose'].includes(s.type) && s.target && !s.target.spot) named.push({ station, side, id: s.id, type: s.type, target: s.target });
  }
}

describe('E at what the story names', () => {
  it.each(named)('$station $side $id: E at $target does the step', ({ station, side, id, target }) => {
    const g0 = toStep(station, side, id);
    expect(g0.plot.progress.step).toBe(id);
    // something you carry: E anywhere
    const carried = g0.items?.has(target.tag);
    const at = carried ? null : placeOf(g0, target);
    expect(carried || at, `${JSON.stringify(target)} is somewhere`).toBeTruthy();
    let done = false;
    const tries = carried ? [0] : [0, 1, 2, 3, 4, 5, 6, 7];
    for (const k of tries) {
      const g = toStep(station, side, id);
      if (at) {
        const a = (k / 8) * Math.PI * 2;
        const r = at.size + 0.9;
        teleport(g, at.room, at.x + Math.sin(a) * r, at.z - Math.cos(a) * r);
      }
      const yaw = at ? Math.atan2(at.x - g.you.x, -(at.z - g.you.z)) : g.you.yaw;
      g.you.yaw = yaw;
      step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0 });
      drain(g);
      if (!promptOf(g)?.use) continue;
      // a fight to get free is many presses
      for (let i = 0; i < 12 && g.plot.progress.step === id && !g.talk; i++) {
        step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0, use: true });
        step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0 });
        drain(g);
      }
      if (g.plot.progress.step !== id || g.talk) {
        done = true;
        break;
      }
    }
    expect(done).toBe(true);
  });
});
