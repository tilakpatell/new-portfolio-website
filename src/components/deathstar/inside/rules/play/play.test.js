import { describe, expect, it } from 'vitest';
import { BARKS, assign } from '../brains';
import { furnish } from '../furnish';
import { GAP } from '../breach';
import { STEP, alertOf, drain, newGame, objectiveOf, promptOf, step, teleport } from '../game';
import { BODY } from '../walker';
import { feedPlot, startPlot } from './plot';
import { autoInput } from './autoplay';
import { toStep } from './beats';

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

  it('lets you stand at every spot a story sends you to: none inside the furniture or off the floor', () => {
    const missing = [];
    for (const [station, side] of [['ds1', 'rebel'], ['ds1', 'imperial'], ['ds2', 'rebel'], ['ds2', 'imperial']]) {
      const g = newGame({ station, side, mode: 'story', hero: 'luke', seed: 3 });
      for (const step of g.plot.story.steps) {
        const name = step.target?.spot;
        if (!name || !['reach', 'escort', 'hide'].includes(step.type)) continue;
        const s = g.layout.station.spots[name];
        // somewhere a body can stand within the 1.6 m that counts as there (game.js's SPOT)
        let ok = false;
        for (let r = 0; r <= 1.4 && !ok; r += 0.2)
          for (let i = 0; i < 16 && !ok; i++) {
            const x = s.x + Math.sin((i / 16) * Math.PI * 2) * r;
            const z = s.z - Math.cos((i / 16) * Math.PI * 2) * r;
            const clear = !g.solidsOf(s.room).some((o) => (o.box ? x > o.box.x0 - 0.35 && x < o.box.x1 + 0.35 && z > o.box.z0 - 0.35 && z < o.box.z1 + 0.35 : Math.hypot(x - o.circle.x, z - o.circle.z) < o.circle.r + 0.35));
            ok = clear && g.layout.floorAt(s.room, x, z) !== null;
          }
        if (!ok) missing.push(`${station} ${side}: ${step.id} → ${name}`);
      }
    }
    expect(missing).toEqual([]);
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

describe('the second station’s end, the Rebel’s', () => {
  const ending = (at) => {
    const g = newGame({ station: 'ds2', side: 'rebel', mode: 'story', seed: 5 });
    startPlot(g, at);
    drain(g);
    return g;
  };
  const father = (g, tag = 'with:vader') => g.crew.people.find((p) => p.tag === tag);

  it('holds your father up at your side as you walk, and lets you walk only, however you push', () => {
    const g = ending('carry');
    const room = g.layout.rooms.get(g.you.room);
    const d = Math.hypot(room.x - g.you.x, room.z - g.you.z) || 1;
    const dir = { x: (room.x - g.you.x) / d, z: (room.z - g.you.z) / d };
    const yaw = Math.atan2(dir.x, -dir.z);
    const from = { x: g.you.x, z: g.you.z };
    let fastest = 0;
    let last = { x: g.you.x, z: g.you.z };
    play(g, { ...STILL, yaw, dir, run: true, jump: true }, 1, (g2) => {
      const v = father(g2);
      // beside you, not in front or behind: across the way you face
      expect(Math.hypot(v.x - g2.you.x, v.z - g2.you.z)).toBeLessThan(0.6);
      expect(v.room).toBe(g2.you.room);
      fastest = Math.max(fastest, Math.hypot(g2.you.x - last.x, g2.you.z - last.z) / STEP);
      last = { x: g2.you.x, z: g2.you.z };
    });
    expect(Math.hypot(g.you.x - from.x, g.you.z - from.z)).toBeGreaterThan(1);
    expect(fastest).toBeLessThan(BODY.walk * 1.05);
    expect(g.you.ground).toBe(true);
    expect(father(g).anim).toBe('limp');
    play(g, { ...STILL, yaw }, 0.5);
    expect(father(g).anim).toBe('idle');
  });

  it('shakes the station as it comes apart: a tremor every few seconds, a panel bursting on a wall near you with most', () => {
    const g = ending('carry');
    const quakes = of(play(g, { ...STILL }, 30), 'quake');
    expect(quakes.length).toBeGreaterThanOrEqual(Math.floor(30 / GAP[1]));
    expect(quakes.length).toBeLessThanOrEqual(Math.ceil(30 / GAP[0]) + 1);
    const box = g.layout.rooms.get(g.you.room).box;
    const bursts = quakes.filter((q) => q.at);
    expect(bursts.length).toBeGreaterThan(quakes.length / 2);
    for (const { at, size } of bursts) {
      expect(size).toBeGreaterThan(0.3);
      expect(Math.min(Math.abs(at.x - box.x0), Math.abs(at.x - box.x1), Math.abs(at.z - box.z0), Math.abs(at.z - box.z1))).toBeCloseTo(0.6, 6);
      expect(Math.hypot(at.x - g.you.x, at.z - g.you.z)).toBeLessThanOrEqual(12 + 1e-6);
    }
    // (and none on a station that stands)
    const calm = newGame({ station: 'ds2', side: 'rebel', mode: 'roam', seed: 5 });
    expect(of(play(calm, { ...STILL }, 10), 'quake')).toEqual([]);
  });

  it('sets him down against the shuttle for the mask, you kneeling by him, and lays him down once he has spoken', () => {
    const g = ending('mask');
    const seat = g.layout.station.spots['mask-seat'];
    const v = father(g, 'vader');
    expect(father(g)).toBeUndefined();
    expect(Math.hypot(v.x - seat.x, v.z - seat.z)).toBeLessThan(0.3);
    expect(Math.hypot(g.you.x - g.layout.station.spots['mask-kneel'].x, g.you.z - g.layout.station.spots['mask-kneel'].z)).toBeLessThan(0.6);
    expect(g.scene?.id).toBe('mask');
    play(g, { ...STILL }, 1);
    expect(father(g, 'vader').anim).toBe('ground');
    play(g, { ...STILL }, 10);
    expect(g.talk?.id).toBe('unmasking');
    for (let k = 0; k < 8 && g.talk; k++) play(g, { ...STILL, choice: 0 }, STEP);
    expect(g.plot.progress.step).toBe('escape');
    play(g, { ...STILL }, 1);
    const lying = father(g, 'vader');
    expect(lying.anim).toBe('lie');
    expect(Math.hypot(lying.x - seat.x, lying.z - seat.z)).toBeLessThan(0.3);
  });
});

describe('a scene', () => {
  it('has nobody shot while it plays, since it has the keys', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 3 });
    const trooper = g.crew.people.find((p) => p.kind === 'stormtrooper');
    teleport(g, trooper.room, trooper.x + Math.sin(trooper.yaw) * 4, trooper.z - Math.cos(trooper.yaw) * 4, trooper.yaw + Math.PI);
    g.scene = { id: 'tractor', t: 0 };
    play(g, STILL, 6);
    expect(g.you.hp).toBe(g.you.max ?? 100);
  });
});

describe('where the story puts you', () => {
  it('brings those with you along: Han and Chewie back in Docking Control with Luke, at his side at once', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', seed: 5 });
    startPlot(g, 'tractor-guards');
    // (Ben past the guards to the ledge, and both of the terminal's controls turned down)
    feedPlot(g, { type: 'at', room: 'core6', spot: 'tractor-ledge', with: [] });
    feedPlot(g, { type: 'used', tag: 'tractor-power-1' });
    feedPlot(g, { type: 'used', tag: 'tractor-power-2' });
    drain(g);
    // (the swap back to Luke is done as it starts: the story is on to the prisoner transfer)
    expect(g.plot.progress.step).toBe('transfer');
    const window327 = g.layout.station.spots.window327;
    expect(Math.hypot(g.you.x - window327.x, g.you.z - window327.z)).toBeLessThan(1);
    const crew = g.crew.people.filter((q) => q.tag === 'with:han' || q.tag === 'with:chewie');
    expect(crew).toHaveLength(2);
    for (const p of crew) {
      expect(p.room, p.tag).toBe(g.you.room);
      expect(Math.hypot(p.x - g.you.x, p.z - g.you.z), p.tag).toBeLessThan(3);
    }
  });

  it('swings you and Leia across the chasm, and has her beside you on the far side', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', seed: 5 });
    startPlot(g, 'chasm');
    drain(g);
    expect(g.crew.people.some((p) => p.tag === 'with:leia')).toBe(true);
    teleport(g, 'chasm-ledge');
    play(g, { ...STILL, yaw: g.you.yaw }, 0.5);
    expect(g.plot.progress.step).toBe('chasm-grapple');
    play(g, { ...STILL, yaw: g.you.yaw, use: true }, STEP);
    play(g, { ...STILL, yaw: g.you.yaw }, 0.2);
    expect(g.scene?.id).toBe('swing');
    play(g, { ...STILL, yaw: g.you.yaw }, 5);
    const far = g.layout.station.spots['chasm-far'];
    expect(Math.hypot(g.you.x - far.x, g.you.z - far.z)).toBeLessThan(1);
    // (on the far side with you, though she may have stepped back into its corridor to fire across at the squad)
    for (const p of g.crew.people.filter((q) => q.tag?.startsWith('with:'))) expect(p.x, p.tag).toBeGreaterThan(far.x - 3);
  });
});

describe('Vader’s prisoner on the second station', () => {
  it('walks Luke through the dock among the garrison with no alarm, and Vader and his guards stay with him', () => {
    const g = toStep('ds2', 'rebel', 'escort-walk');
    const mem = {};
    const events = play(g, (gg) => autoInput(gg, mem), 25);
    expect(of(events, 'saw').filter((e) => e.target === 'you')).toEqual([]);
    expect(Object.values(g.alarm.sections).every((s) => !s.level || s.level === 'calm')).toBe(true);
    for (const p of g.crew.people.filter((q) => q.tag === 'vader' || q.tag === 'guards')) expect(p.mode, p.tag).not.toBe('flee');
  });
});

describe('your prisoner on the first station', () => {
  it('follows you through the Imperial-only blast door from the bay, as you walk him in your armour', () => {
    const g = toStep('ds1', 'rebel', 'transfer');
    const chewie = () => g.crew.people.find((q) => q.tag === 'with:chewie');
    expect(chewie()).toBeTruthy();
    // (you at the corridor's far end, past the door, standing there)
    teleport(g, 'corr327', 10, -36);
    play(g, { ...STILL, yaw: g.you.yaw }, 30);
    expect(chewie().room).toBe('corr327');
    expect(Math.hypot(chewie().x - g.you.x, chewie().z - g.you.z)).toBeLessThan(4);
  });

  it('is let by by the garrison, and starts nothing with them: no alarm, nobody flees or fights', () => {
    const g = toStep('ds1', 'rebel', 'transfer');
    teleport(g, 'corr327', 10, -36);
    const events = play(g, { ...STILL, yaw: g.you.yaw }, 30);
    expect(of(events, 'fled').filter((e) => e.kind === 'chewie')).toEqual([]);
    expect(Object.values(g.alarm.sections).every((s) => s.level === 'calm')).toBe(true);
    expect(g.crew.people.filter((q) => q.mode === 'fight')).toEqual([]);
  });
});

describe('AA-23’s cameras', () => {
  it('break when shot, and the story counts the two', () => {
    const g = toStep('ds1', 'rebel', 'transfer-cameras');
    teleport(g, 'aa23');
    const mem = {};
    for (let t = 0; t < 30 && g.plot.progress.step === 'transfer-cameras'; t += STEP) {
      step(g, autoInput(g, mem));
      drain(g);
      g.you.hp = 100;
    }
    expect(g.broken).toEqual(new Set(['aa23-camera-1', 'aa23-camera-2']));
    expect(g.plot.progress.step).not.toBe('transfer-cameras');
  });
});

describe('the Emperor on his throne', () => {
  it('sits in it while Luke is brought before him, not stood out behind it', () => {
    const g = newGame({ station: 'ds2', side: 'rebel', mode: 'story', seed: 5, hero: 'luke' });
    startPlot(g, 'throne');
    const seat = g.layout.station.spots['throne-seat'];
    for (let k = 0; k < 60; k++) step(g, { dir: { x: 0, z: 0 }, yaw: g.you.yaw, pitch: 0 });
    const e = g.crew.people.find((p) => p.kind === 'emperor');
    expect(Math.hypot(e.x - seat.x, e.z - seat.z)).toBeLessThan(0.1);
    expect(e.anim).toBe('sit');
  });
});
