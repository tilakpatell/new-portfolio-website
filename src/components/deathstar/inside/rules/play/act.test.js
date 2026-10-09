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

// Free roam: at every tagged thing aboard, in front of it and facing it, E is offered only where it
// does something you can see or hear (a line said, a talk opened, a scene, a ride, a flag thrown, a
// seat, the saber), and the things the story alone has a use for aren't offered at all.
describe('E in free roam', () => {
  const seen = (g, before, events) =>
    Boolean(g.talk || g.scene || g.you.room !== before.room || events.some((e) => ['say', 'sat', 'pulled', 'read'].includes(e.type)) || [...g.flags].join() !== before.flags);
  for (const [station, side] of STORIES) {
    it(`does something wherever it is offered, on ${station} as ${side === 'rebel' ? 'a Rebel' : 'an Imperial'}`, () => {
      const base = newGame({ station, side, mode: 'roam', seed: 5 });
      const quiet = [];
      for (const room of base.layout.rooms.values()) {
        for (const t of furnish(room, base.layout.station).props.filter((p) => p.tag)) {
          const g = newGame({ station, side, mode: 'roam', seed: 5 });
          const r = 0.9 + Math.max(t.w ?? 0, t.d ?? 0) / 2;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            teleport(g, room.id, t.x + Math.sin(a) * r, t.z - Math.cos(a) * r);
            if (g.you.room !== room.id) continue;
            const yaw = Math.atan2(t.x - g.you.x, -(t.z - g.you.z));
            g.you.yaw = yaw;
            step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0 });
            drain(g);
            const p = promptOf(g);
            if (!p?.use) break;
            const before = { room: g.you.room, flags: [...g.flags].join() };
            step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0, use: true });
            if (!seen(g, before, drain(g))) quiet.push(`${room.id}/${t.tag}: “${p.text}”`);
            break;
          }
        }
      }
      expect(quiet).toEqual([]);
    }, 60000);
  }

  it('reads the station’s plans off the scomp link in Docking Control, up the bay’s stair', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 5 });
    const scomp = furnish(g.layout.rooms.get('ctl327'), g.layout.station).props.find((p) => p.tag === 'scomp');
    teleport(g, 'ctl327', scomp.x, scomp.z + 1.1);
    const yaw = Math.atan2(scomp.x - g.you.x, -(scomp.z - g.you.z));
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0 });
    drain(g);
    expect(promptOf(g)).toMatchObject({ use: true, text: 'read the station’s plans off the scomp link' });
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0, use: true });
    drain(g);
    expect(g.seen.size).toBe(g.layout.rooms.size);
  });

  it('opens the Empire’s own doors to a Rebel there, so free roam isn’t ended at the bay’s corridor door', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 5 });
    expect(g.doors['bay327-corr'].locked).toBe(true);
    const scomp = furnish(g.layout.rooms.get('ctl327'), g.layout.station).props.find((p) => p.tag === 'scomp');
    teleport(g, 'ctl327', scomp.x, scomp.z + 1.1);
    const yaw = Math.atan2(scomp.x - g.you.x, -(scomp.z - g.you.z));
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0 });
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0, use: true });
    expect(g.doors['bay327-corr'].locked).toBe(false);
  });

  it('runs the chasm’s bridge out and back from its controls, and the floor comes and goes with it', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 5 });
    const was = g.flags.has('bridge');
    const ctl = furnish(g.layout.rooms.get('chasm'), g.layout.station).props.find((p) => p.tag === 'bridge-control');
    teleport(g, 'chasm', ctl.x + 0.9, ctl.z);
    const yaw = Math.atan2(ctl.x - g.you.x, -(ctl.z - g.you.z));
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0 });
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0, use: true });
    expect(g.flags.has('bridge')).toBe(!was);
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0 });
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0, use: true });
    expect(g.flags.has('bridge')).toBe(was);
  });

  it('offers nothing at a thing only a story has a use for: the beacon’s mark on the Falcon’s hull', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 5 });
    const mark = furnish(g.layout.rooms.get('bay327'), g.layout.station).props.find((p) => p.tag === 'beacon-spot');
    teleport(g, 'bay327', mark.x + 1, mark.z);
    const yaw = Math.atan2(mark.x - g.you.x, -(mark.z - g.you.z));
    step(g, { dir: { x: 0, z: 0 }, yaw, pitch: 0 });
    expect(promptOf(g)?.use ?? false).toBe(false);
  });
});
