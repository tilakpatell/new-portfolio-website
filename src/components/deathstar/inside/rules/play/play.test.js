import { describe, expect, it } from 'vitest';
import { BARKS, assign } from '../brains';
import { furnish } from '../furnish';
import { STEP, alertOf, drain, newGame, objectiveOf, promptOf, step, teleport } from '../game';

const STILL = { dir: { x: 0, z: 0 }, yaw: 0, pitch: 0 };
function play(g, input, seconds, each) {
  const out = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    step(g, typeof input === 'function' ? input(g) : input);
    const ev = drain(g);
    out.push(...ev);
    each?.(g, ev);
  }
  return out;
}
const of = (events, type) => events.filter((e) => e.type === type);
const yawTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));
const pitchTo = (from, to) => Math.atan2((to.y ?? 0) + 1.2 - (from.y + 1.45), Math.hypot(to.x - from.x, to.z - from.z));

describe('the station with its people aboard', () => {
  it('has its garrison aboard in free roam, and troopers on Bay 327’s deck', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    expect(g.crew.people.length).toBeGreaterThanOrEqual(25);
    expect(g.crew.people.filter((p) => p.room === 'bay327' && p.kind === 'stormtrooper').length).toBeGreaterThanOrEqual(3);
  });

  it('lets an Imperial walk the bay among them without a shot fired', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    const events = play(g, { ...STILL, dir: { x: 0, z: -1 } }, 6);
    expect(of(events, 'shot')).toEqual([]);
    expect(alertOf(g).level).toBe('calm');
  });

  it('fights an undisguised Rebel the garrison sees: the alarm goes up and the troopers shoot', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 3 });
    teleport(g, 'bay327', 10, -10);
    const events = play(g, STILL, 8);
    expect(of(events, 'saw').some((e) => e.target === 'you')).toBe(true);
    expect(of(events, 'shot').some((e) => e.by !== 'you')).toBe(true);
    expect(['alert', 'lockdown', 'hunt']).toContain(alertOf(g).level);
    // (eight seconds of the whole garrison: a second alone, more with the suite running round it)
  }, 20000);

  it('puts a trooper down with enough shots, and tells the story who fell', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 3 });
    const target = g.crew.people.find((p) => p.room === 'bay327' && p.kind === 'stormtrooper');
    teleport(g, 'bay327', target.x + Math.sin(target.yaw) * 5, target.z - Math.cos(target.yaw) * 5);
    g.you.hp = 1e6;
    const events = play(g, (gg) => ({ ...STILL, yaw: yawTo(gg.you, target), pitch: pitchTo(gg.you, target), fire: true, aim: true }), 6);
    expect(of(events, 'shot').filter((e) => e.by === 'you').length).toBeGreaterThan(3);
    expect(of(events, 'died').map((e) => e.id)).toContain(target.id);
  });

  it('stands your companions on the floor round you, apart from you and each other, even in the smuggling hold', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', hero: 'luke', seed: 3 });
    play(g, STILL, 0.5);
    const with_ = g.crew.people.filter((p) => p.tag?.startsWith('with:'));
    expect(with_.length).toBeGreaterThanOrEqual(4);
    const you = g.you;
    for (const p of with_) {
      expect(g.layout.floorAt(p.room, p.x, p.z), p.id).not.toBeNull();
      expect(Math.hypot(p.x - you.x, p.z - you.z), p.id).toBeGreaterThan(0.6);
    }
    for (const a of with_) for (const b of with_) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} ${b.id}`).toBeGreaterThan(0.55);
  });

  it('has two people put on one spot step apart, neither through a wall', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    const [a, b] = g.crew.people.filter((p) => p.room === 'corr327' || p.room === 'bay327').slice(0, 2);
    const room = g.layout.rooms.get('corr327');
    // up against the corridor's wall, both at once
    // both given the one post there, so neither walks off of their own accord
    const post = { room: 'corr327', x: room.box.x0 + 0.4, z: room.z, yaw: Math.PI / 2 };
    for (const p of [a, b]) {
      Object.assign(p, { room: 'corr327', x: post.x, z: post.z, y: room.y });
      assign(g.crew, p.id, { type: 'post', spot: post });
    }
    teleport(g, 'corr327', room.x, room.z + 3);
    play(g, STILL, 2);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.55);
    for (const p of [a, b]) {
      expect(p.x, p.id).toBeGreaterThanOrEqual(room.box.x0);
      expect(g.layout.floorAt(p.room, p.x, p.z), p.id).not.toBeNull();
    }
  });

  it('puts you on clear floor when you are put in a room, never in its furniture', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    for (const id of ['conference', 'overbridge', 'archive', 'aa23']) {
      expect(teleport(g, id), id).toBe(true);
      const inside = g.solidsOf(id).filter((s) => (s.box ? g.you.x > s.box.x0 && g.you.x < s.box.x1 && g.you.z > s.box.z0 && g.you.z < s.box.z1 : Math.hypot(g.you.x - s.circle.x, g.you.z - s.circle.z) < s.circle.r));
      expect(inside, id).toEqual([]);
      expect(g.layout.floorAt(id, g.you.x, g.you.z), id).not.toBeNull();
    }
  });

  it('sits the conference room’s officers in their chairs', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    teleport(g, 'conference');
    play(g, STILL, 3);
    for (const kind of ['tarkin', 'motti', 'tagge']) expect(g.crew.people.find((p) => p.kind === kind)?.anim, kind).toBe('sit');
  });

  it('holds you still while a story’s scene plays, and lets you go when it ends', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    teleport(g, 'corr327');
    const at = { x: g.you.x, z: g.you.z };
    g.scene = { id: 'tractor', t: 0 };
    play(g, { ...STILL, dir: { x: 0, z: -1 }, fire: true }, 1);
    expect(Math.hypot(g.you.x - at.x, g.you.z - at.z)).toBeLessThan(0.01);
    g.scene = null;
    play(g, { ...STILL, dir: { x: 0, z: -1 } }, 1);
    expect(Math.hypot(g.you.x - at.x, g.you.z - at.z)).toBeGreaterThan(0.5);
  });

  it('leaves the garrison’s barks to the garrison: a Rebel who runs from a fight says none of them', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', hero: 'luke', seed: 3 });
    teleport(g, 'bay327', 10, -10);
    // your crew round you in the open bay, where the garrison sees you all
    g.crew.people.filter((p) => p.tag?.startsWith('with:')).forEach((p, i) => Object.assign(p, { room: 'bay327', x: 10 + (i % 3) - 1, z: -8.5 - Math.floor(i / 3), y: 0 }));
    g.you.hp = 1e6;
    const said = [];
    play(g, STILL, 8, (gg, ev) => said.push(...of(ev, 'say')));
    const barks = new Set(Object.values(BARKS).flat());
    const rebels = new Set(['chewie', 'han', 'leia', 'obiwan', 'threepio', 'artoo', 'luke']);
    expect(said.filter((e) => rebels.has(e.who) && barks.has(e.text))).toEqual([]);
  });

  it('turns you to face where you look when you stand and look well round, and not for a glance', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    teleport(g, 'corr327');
    const was = g.you.yaw;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    play(g, { ...STILL, yaw: was + 0.5 }, 1);
    expect(g.you.yaw).toBeCloseTo(was, 5);
    play(g, { ...STILL, yaw: was + 2.4 }, 1.5);
    expect(Math.abs(wrap(g.you.yaw - (was + 2.4)))).toBeLessThan(0.3);
  });

  it('lets far-off people sleep where they stand', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    const far = g.crew.people.find((p) => p.room === 'firecontrol');
    const at = { x: far.x, z: far.z };
    play(g, STILL, 10);
    expect({ x: far.x, z: far.z }).toEqual(at);
  });
});

describe('talking and using', () => {
  it('opens a talk with someone in front of you on E, and picking a line moves it on', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    const tech = g.crew.people.find((p) => p.kind === 'librarian');
    teleport(g, tech.room, tech.x + Math.sin(tech.yaw) * 1.3, tech.z - Math.cos(tech.yaw) * 1.3, tech.yaw + Math.PI);
    expect(promptOf(g)?.use).toBe(true);
    play(g, { ...STILL, yaw: g.you.yaw, use: true }, STEP);
    expect(g.talk?.id).toBe('librarian');
    for (let k = 0; k < 8 && g.talk; k++) play(g, { ...STILL, yaw: g.you.yaw, choice: 0 }, STEP);
    expect(g.talk).toBeNull();
  });

  it('opens the compactor’s hatch to its number on the keypad, and finds the egg', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 3 });
    const hatch = furnish(g.layout.rooms.get('compactor'), g.layout.station).props.find((p) => p.tag === 'compactor-hatch');
    teleport(g, 'compactor', hatch.x + Math.sin(hatch.yaw) * 1.2, hatch.z - Math.cos(hatch.yaw) * 1.2, hatch.yaw + Math.PI);
    play(g, { ...STILL, yaw: g.you.yaw, use: true }, STEP);
    expect(g.talk?.id).toBe('keypad');
    const events = play(g, { ...STILL, yaw: g.you.yaw, choice: 0 }, STEP);
    expect(of(events, 'dialled')).toEqual([{ type: 'dialled', code: '3263827' }]);
    expect(of(events, 'achievement')).toContainEqual({ type: 'achievement', id: 'ds-3263827' });
    const door = [...g.layout.doors.values()].find((d) => d.lock === 'code:3263827');
    expect(g.doors[door.id].locked).toBe(false);
  });
});

describe('the story over the station', () => {
  it('starts the first Death Star’s Rebel story lying low in the hold, and moves on once the search is over', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', seed: 3 });
    expect(g.you.room).toBe('hold');
    expect(objectiveOf(g)).toMatch(/smuggling hold/);
    play(g, { ...STILL, crouch: true }, 27);
    expect(g.plot.progress.step).toBe('ambush');
  });

  it('sends you back to the start of the beat if you move while the hold is searched', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', seed: 3 });
    play(g, { ...STILL, crouch: true }, 4);
    const events = play(g, { ...STILL, dir: { x: 0, z: 1 }, run: true }, 6);
    expect(g.plot.progress.step).toBe('scan');
    expect(events.some((e) => e.type === 'say' && /hands where I can see them/.test(e.text))).toBe(true);
  });
});
