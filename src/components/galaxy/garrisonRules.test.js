import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/seeded';
import { HULLS, TURRETS } from '../universe/wars';
import { GARRISON, createGarrison, postOf, ringsOf } from './garrisonRules';

const DT = 1 / 30;
const SRC = { id: 'p', kind: 'destroyer', side: 'empire', size: 30, at: { x: 0, y: 0, z: 0 }, yaw: 0 };
const post = (over = {}) => postOf({ ...SRC, ...over });
const P = post();
// you, at a point, with a velocity
const you = (x, y = 0, z = 0, v = {}) => ({ x, y, z, vx: v.x ?? 0, vy: v.y ?? 0, vz: v.z ?? 0 });
// a Star Destroyer, held, with an enemy 30 units off its beam
const world = (over = {}) => ({ posts: [P], you: you(30), stance: 'enemy', tier: 'held', battle: false, planet: null, fighters: [], chasers: [], ...over });
// `seconds` of steps; each event stamped with the time at the end of its step
function run(g, seconds, w, { dt = DT, each = null } = {}) {
  const out = [];
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const t = (i + 1) * dt;
    const es = g.step(dt, typeof w === 'function' ? w(i * dt) : w);
    for (const e of es) out.push({ ...e, t });
    each?.(es, t);
  }
  return out;
}
const says = (events) => events.filter((e) => e.type === 'say').map((e) => e.sub);
const of = (events, type) => events.filter((e) => e.type === type);
const first = (events, type) => events.find((e) => e.type === type)?.t;
// a time, to within a few frames
const about = (t, want) => expect(Math.abs(t - want)).toBeLessThan(0.1);
const mind = (seed = 1) => createGarrison({ rand: seeded(seed) });
// a mind already fighting you
const fighting = (w = world({ you: you(80) })) => {
  const g = mind();
  run(g, 3, w);
  expect(g.state).toBe('fight');
  return g;
};

describe('postOf', () => {
  it('postOf puts a battery for every turret and a sphere for every hull section', () => {
    expect(P.batteries).toHaveLength(TURRETS.destroyer.length);
    expect(P.batteries).toHaveLength(12);
    expect(P.spheres).toHaveLength(6);
    P.spheres.forEach((s, i) => expect(s.r).toBeCloseTo(HULLS.destroyer[i][1] * 30));
    expect(P).toMatchObject({ id: 'p', kind: 'destroyer', side: 'empire', size: 30, yaw: 0, carrier: true });
    // the hangar: under the middle of the hull, clear of it
    const middle = P.spheres.reduce((a, b) => (Math.hypot(b.c.x, b.c.y, b.c.z) < Math.hypot(a.c.x, a.c.y, a.c.z) ? b : a));
    expect(P.at.y - P.hangar.y).toBeGreaterThan(middle.r);
    expect(P.hangar.x).toBeCloseTo(0);
    expect(P.hangar.z).toBeCloseTo(0);
    // turned a quarter, its nose (the hull's last section, the furthest forward) points along +x
    const turned = post({ yaw: Math.PI / 2 });
    const nose = turned.spheres[turned.spheres.length - 1].c;
    expect(nose.x).toBeCloseTo(HULLS.destroyer[5][0] * 30);
    expect(nose.z).toBeCloseTo(0);
    // a battery on the starboard flank, carried with it
    const [, starboard] = P.batteries;
    expect(starboard.x).toBeCloseTo(TURRETS.destroyer[1][0] * 30);
    expect(starboard.y).toBeCloseTo(TURRETS.destroyer[1][1] * 30);
    expect(starboard.z).toBeCloseTo(TURRETS.destroyer[1][2] * 30);
  });
  it('postOf refreshes the post it is given in place', () => {
    const p = post();
    const battery = p.batteries[0];
    const sphere = p.spheres[0];
    const again = postOf({ ...SRC, at: { x: 100, y: 5, z: -20 } }, p);
    expect(again).toBe(p);
    expect(p.batteries[0]).toBe(battery);
    expect(p.spheres[0]).toBe(sphere);
    expect(p.at).toEqual({ x: 100, y: 5, z: -20 });
    expect(battery.x).toBeCloseTo(100 + TURRETS.destroyer[0][0] * 30);
    expect(post({ kind: 'corvette', size: 2.8 }).carrier).toBe(false);
  });
});

describe('ringsOf', () => {
  it('rings grow with the ship and the tier', () => {
    expect(ringsOf(30, 'held').fire).toBeCloseTo(60);
    expect(ringsOf(30, 'fortress').fire).toBeCloseTo(75);
    expect(ringsOf(30, 'thin').fire).toBeCloseTo(48);
    expect(ringsOf(2.8, 'held').fire).toBeCloseTo(27.36);
    for (const tier of ['thin', 'held', 'fortress']) {
      const r = ringsOf(30, tier);
      expect(r.leash).toBeGreaterThan(r.warn);
      expect(r.warn).toBeGreaterThan(r.scramble);
      expect(r.scramble).toBeGreaterThan(r.fire);
    }
    expect(ringsOf(30, 'held')).toEqual({ fire: 60, scramble: 100, warn: 160, leash: 200 });
  });
});

describe('the garrison mind', () => {
  it('an enemy is challenged, then scrambled at once inside the scramble ring', () => {
    const g = mind();
    expect(g.state).toBe('calm');
    const ev = run(g, 3, world({ you: you(80) }));
    expect(says(ev)).toEqual(['challenge', 'scramble']);
    const [s] = of(ev, 'scramble');
    expect(s).toMatchObject({ size: 3, ace: false, wave: 1, post: P });
    expect(s.from).toEqual(P.hangar);
    about(s.t, GARRISON.challenge);
    expect(g.state).toBe('fight');
    expect(g.busy).toBe(true);
  });

  it('an unsworn pilot is warned with a countdown and thanked for leaving', () => {
    const g = mind();
    const ev = run(g, 8, (t) => world({ stance: 'wary', you: you(90 + 20 * t, 0, 0, { x: 20 }) }));
    expect(says(ev)).toEqual(['warn', 'clear']);
    expect(ev.find((e) => e.sub === 'warn').secs).toBe(8);
    expect(of(ev, 'scramble')).toHaveLength(0);
    expect(g.state).toBe('calm');
  });

  it('an unsworn pilot who lingers past the countdown is fought', () => {
    const g = mind();
    const ev = run(g, 9, world({ stance: 'wary', you: you(80) }));
    expect(says(ev)).toEqual(['warn', 'scramble']);
    about(first(ev, 'scramble'), GARRISON.countdown);
    expect(g.state).toBe('fight');
    expect(g.info.grudge).toBeGreaterThan(GARRISON.grudge - 1);
  });

  it('a fortress counts down from five', () => {
    const g = mind();
    const ev = run(g, 6, world({ stance: 'wary', tier: 'fortress', you: you(80) }));
    expect(ev.find((e) => e.sub === 'warn').secs).toBe(5);
    about(first(ev, 'scramble'), GARRISON.countdownFortress);
  });

  it('the planet hides you', () => {
    const hidden = () => false;
    const g = mind();
    expect(run(g, 5, world({ seesThrough: hidden }))).toEqual([]);
    expect(g.state).toBe('calm');
    // seen (hailed, outside the scramble ring), then hidden: it holds on to you for its intuition
    const h = mind();
    expect(says(run(h, 0.5, world({ you: you(130) })))).toEqual(['challenge']);
    run(h, GARRISON.senses.intuition, world({ you: you(130), seesThrough: hidden }));
    expect(['hail', 'fight']).toContain(h.state);
    // and then it coasts, fades and lets you go
    run(h, 20, world({ you: you(130), seesThrough: hidden }));
    expect(h.state).toBe('calm');
  });

  it('a post that goes takes what it saw with it', () => {
    const g = mind();
    run(g, 0.5, world({ you: you(130) }));
    expect(g.state).toBe('hail');
    g.step(DT, world({ posts: [] }));
    expect(g.state).toBe('calm');
    // back, with the planet between: it has to find you again
    expect(run(g, 2, world({ you: you(130), seesThrough: () => false }))).toEqual([]);
  });

  it('waves come from the reserve and never more than two at once', () => {
    // none of them killed: the fighters echo every one launched
    const g = mind();
    const fighters = [];
    const ev = run(g, 120, world({ fighters }), {
      each: (es) => {
        for (const e of es) if (e.type === 'scramble') for (let i = 0; i < e.size; i++) fighters.push({ id: fighters.length, at: { x: 50, y: 0, z: 0 }, size: 1 });
      },
    });
    expect(of(ev, 'scramble').reduce((n, e) => n + e.size, 0)).toBeLessThanOrEqual(GARRISON.maxWaves * GARRISON.tiers.held.wave);
    // (the next waits for half the last to be down)
    expect(of(ev, 'scramble')).toHaveLength(1);
    const one = (left) => {
      const out = [];
      const ev = run(mind(), 20, world({ fighters: out }), {
        each: (es) => {
          if (!es.some((e) => e.type === 'scramble')) return;
          out.length = 0;
          for (let i = 0; i < left; i++) out.push({ id: i, at: { x: 50, y: 0, z: 0 }, size: 1 });
        },
      });
      return of(ev, 'scramble').length;
    };
    expect(one(1)).toBeGreaterThan(1);
    expect(one(2)).toBe(1);
    // two waves' worth already out: none
    const full = Array.from({ length: GARRISON.maxWaves * GARRISON.tiers.held.wave }, (_, i) => ({ id: i, at: { x: 50, y: 0, z: 0 }, size: 1 }));
    expect(of(run(mind(), 20, world({ fighters: full })), 'scramble')).toHaveLength(0);
  });

  it('every wave killed, the next comes after the gap, until the reserve runs out', () => {
    const g = mind();
    const waves = of(run(g, 60, world()), 'scramble');
    const [a, b, c, d] = waves;
    expect(waves.map((e) => e.size)).toEqual([3, 3, 2, 1]);
    expect(waves.map((e) => e.wave)).toEqual([1, 2, 3, 4]);
    about(b.t - a.t, GARRISON.waveGap);
    about(c.t - b.t, GARRISON.waveGap);
    // eight from the reserve, then one more only when it's refilled
    about(d.t - a.t, GARRISON.refill);
    expect(g.info.reserve).toBe(0);
  });

  it('a steady pilot is hit more than a jinking one', () => {
    const hits = (fly) => {
      let n = 0;
      for (let seed = 1; seed <= 5; seed++) n += of(run(mind(seed), 20, fly()), 'hit').length;
      return n;
    };
    const steady = () => (t) => world({ you: you(30, 0, -40 + 4 * t, { z: 4 }) });
    // the same course, the nose swinging 45° either side of it at 90° a second
    const weave = () => {
      const s = { x: 30, z: -40 };
      return (t) => {
        const k = t % 2 < 1 ? t % 2 : 2 - (t % 2);
        const a = ((k - 0.5) * Math.PI) / 2;
        const v = { x: 4 * Math.sin(a), z: 4 * Math.cos(a) };
        s.x += v.x * DT;
        s.z += v.z * DT;
        return world({ you: you(s.x, 0, s.z, v) });
      };
    };
    const held = hits(steady);
    const jinked = hits(weave);
    expect(held).toBeGreaterThan(0);
    expect(held).toBeGreaterThan(jinked * 1.5);
  });

  it('bolts hurt by the tier', () => {
    for (const [tier, damage] of [['thin', 10], ['held', 12], ['fortress', 14]]) {
      const hits = of(run(mind(), 20, world({ tier })), 'hit');
      expect(hits.length, tier).toBeGreaterThan(0);
      for (const h of hits) expect(h.damage, tier).toBe(damage);
    }
  });

  it('no shot through its own fighters', () => {
    const fighters = [{ id: 1, at: { x: 15, y: 0, z: 0 }, size: 3 }];
    expect(of(run(mind(), 5, world({ fighters })), 'volley')).toHaveLength(0);
    expect(of(run(mind(), 5, world()), 'volley').length).toBeGreaterThan(0);
  });

  it('the first volley of a fight says it’s open, and a volley is drawn along its reach', () => {
    const ev = run(mind(), 6, world());
    const volleys = of(ev, 'volley');
    expect(volleys.length).toBeGreaterThan(0);
    expect(says(ev)).toEqual(['challenge', 'scramble', 'open']);
    const v = volleys[0];
    expect(v).toMatchObject({ post: P, friendly: false });
    const reach = Math.hypot(v.to.x - v.from.x, v.to.y - v.from.y, v.to.z - v.from.z);
    expect(reach).toBeCloseTo(ringsOf(30, 'held').fire * 1.3);
    expect(P.batteries.some((b) => b.x === v.from.x && b.y === v.from.y && b.z === v.from.z)).toBe(true);
  });

  it('the leash recalls them and stands down', () => {
    const g = fighting();
    const ev = run(g, 6.2, world({ you: you(1000) }));
    expect(of(ev, 'recall')).toHaveLength(1);
    about(first(ev, 'recall'), GARRISON.leashFor);
    expect(says(ev)).toEqual(['standdown']);
    expect(g.state).toBe('calm');
    expect(g.busy).toBe(false);
  });

  it('arrival grace holds fire for eight seconds inside the fire ring', () => {
    const g = mind();
    g.reset('enter');
    const ev = run(g, 14, world());
    expect(first(ev, 'volley')).toBeGreaterThan(GARRISON.grace);
    expect(first(ev, 'scramble')).toBeGreaterThan(GARRISON.grace);
  });

  it('a stance turning friend mid-fight recalls and stands down', () => {
    const g = fighting();
    const ev = g.step(DT, world({ you: you(80), stance: 'friend' }));
    expect(ev.map((e) => e.type)).toEqual(['recall', 'say']);
    expect(says(ev)).toEqual(['standdown']);
    expect(g.state).toBe('calm');
  });

  it('a battle starting mid-fight recalls without a word', () => {
    const g = fighting(world({ you: you(55) }));
    for (let i = 0; i < 600 && !g.info.bolts; i++) g.step(DT, world({ you: you(55) }));
    expect(g.info.bolts).toBeGreaterThan(0);
    const ev = g.step(DT, world({ battle: true }));
    expect(ev.map((e) => e.type)).toEqual(['recall']);
    expect(g.state).toBe('calm');
    expect(g.info.bolts).toBe(0);
    // and nothing while it's on
    expect(run(g, 5, world({ battle: true }))).toEqual([]);
  });

  it('no posts stands down', () => {
    const g = fighting();
    const ev = g.step(DT, world({ posts: [] }));
    expect(ev.map((e) => e.type)).toEqual(['recall', 'say']);
    expect(says(ev)).toEqual(['standdown']);
    expect(g.state).toBe('calm');
    expect(run(mind(), 3, world({ posts: [] }))).toEqual([]);
    expect(run(mind(), 3, world({ stance: null }))).toEqual([]);
  });

  it('a long frame neither tunnels a bolt nor skips the leash', () => {
    const g = mind();
    const near = world({ you: you(20) });
    let ev = [];
    for (let i = 0; i < 600 && !ev.some((e) => e.type === 'volley'); i++) ev = g.step(DT, near);
    expect(ev.some((e) => e.type === 'volley')).toBe(true);
    expect(g.step(0.5, near).some((e) => e.type === 'hit')).toBe(true);
    const out = g.info.out;
    g.step(0.5, world({ you: you(1000) }));
    expect(g.info.out).toBeCloseTo(out + 0.5);
  });

  it('a bolt is stopped by the planet', () => {
    const planet = { c: { x: 15, y: 0, z: 0 }, r: 4 };
    const ev = run(mind(), 10, world({ planet }));
    expect(of(ev, 'volley').length).toBeGreaterThan(0);
    expect(of(ev, 'hit')).toHaveLength(0);
  });

  it('shooting raises the alarm and turns a wary mind', () => {
    const g = mind();
    const far = world({ stance: 'wary', you: you(500) });
    g.step(DT, far);
    expect(g.state).toBe('calm');
    g.provoke('hit');
    expect(g.state).toBe('fight');
    expect(g.info.grudge).toBe(GARRISON.grudge);
    expect(g.info.alarm).toBeCloseTo(GARRISON.alarmBy.hit);
    expect(says(g.step(DT, far))).toEqual(['scramble']);
    // out of range, it stands down, and the grudge and the alarm go
    run(g, 91, far);
    expect(g.state).toBe('calm');
    expect(g.info.grudge).toBe(0);
    expect(g.info.alarm).toBe(0);
    expect(says(run(g, 1, world({ stance: 'wary', you: you(80) })))).toEqual(['warn']);
    // an enemy hailed and shot at goes straight to it, the alarm rising with what was done
    const h = mind();
    run(h, 0.5, world({ you: you(130) }));
    expect(h.state).toBe('hail');
    h.provoke('down');
    h.provoke('down');
    h.provoke('down');
    expect(h.state).toBe('fight');
    expect(h.info.alarm).toBe(1);
  });

  it('trouble remembered skips the challenge', () => {
    const g = mind();
    g.step(DT, world({ you: you(500) }));
    g.provoke('down');
    g.reset('respawn');
    expect(g.state).toBe('calm');
    const ev = run(g, GARRISON.grace + 1, world({ you: you(80) }));
    expect(says(ev)).toEqual(['scramble']);
    expect(g.state).toBe('fight');
    expect(g.info.alarm).toBeGreaterThanOrEqual(GARRISON.alarmSkip);
    // a jump wipes it
    g.reset('jump');
    expect(g.info.alarm).toBe(0);
    expect(g.info.grudge).toBe(0);
    const after = run(g, GARRISON.grace + 1, world({ you: you(80) }));
    expect(says(after)[0]).toBe('challenge');
  });

  it('a friend’s fleet shoots what chases you', () => {
    const g = mind();
    const chasers = [{ id: 7, at: { x: 40, y: 0, z: 0 }, size: 1 }];
    const ev = run(g, 10, world({ stance: 'friend', you: you(30), chasers }));
    const cover = of(ev, 'cover');
    expect(cover.length).toBeGreaterThan(0);
    for (const c of cover) expect(c).toMatchObject({ id: 7, damage: GARRISON.cover.damage });
    expect(says(ev)).toEqual(['cover']);
    expect(of(ev, 'volley').every((v) => v.friendly)).toBe(true);
    expect(of(ev, 'hit')).toHaveLength(0);
    expect(g.state).toBe('calm');
    // two on your tail inside the scramble ring: a flight to meet you, then nothing more for a minute
    const e = mind();
    const two = [
      { id: 1, at: { x: 70, y: 0, z: 0 }, size: 1 },
      { id: 2, at: { x: 75, y: 0, z: 0 }, size: 1 },
    ];
    const w = world({ stance: 'friend', you: you(65), chasers: two });
    const met = run(e, 59, w);
    expect(of(met, 'escort')).toHaveLength(1);
    expect(of(met, 'escort')[0].post).toBe(P);
    expect(says(met)).toEqual(['escort']);
    expect(of(run(e, 2, w), 'escort')).toHaveLength(1);
    // nothing in the grace
    const late = mind();
    late.reset('enter');
    expect(first(run(late, 12, world({ stance: 'friend', you: you(30), chasers })), 'volley')).toBeGreaterThan(GARRISON.grace);
    // one alone isn't enough
    expect(of(run(mind(), 5, world({ stance: 'friend', chasers: two.slice(0, 1) })), 'escort')).toHaveLength(0);
  });

  it('a call brings them out early', () => {
    const g = mind();
    g.call();
    const ev = g.step(DT, world({ you: you(130) }));
    expect(says(ev)).toEqual(['reinforce']);
    expect(g.state).toBe('fight');
    expect(g.info.grudge).toBe(GARRISON.grudge);
    // outside the warn ring, or a friend: nothing, and the call is spent
    const h = mind();
    h.call();
    expect(h.step(DT, world({ you: you(500) }))).toEqual([]);
    expect(h.state).toBe('calm');
    expect(says(run(h, 1, world({ you: you(130) })))).toEqual(['challenge']);
    const f = mind();
    f.call();
    expect(f.step(DT, world({ stance: 'friend', you: you(130) }))).toEqual([]);
    expect(f.state).toBe('calm');
    // a step of the war's battle spends it too
    const b = mind();
    b.call();
    b.step(DT, world({ battle: true, you: you(130) }));
    expect(says(run(b, 1, world({ you: you(130) })))).toEqual(['challenge']);
  });

  it('the same on any frame rate', () => {
    const at = (dt) => {
      const ev = run(mind(), 3, world({ you: you(80) }), { dt });
      return { said: says(ev), t: first(ev, 'scramble') };
    };
    const slow = at(1 / 30);
    const quick = at(1 / 120);
    expect(slow.said).toEqual(['challenge', 'scramble']);
    expect(quick.said).toEqual(slow.said);
    expect(Math.abs(quick.t - slow.t)).toBeLessThan(0.1);
  });

  it('a small screen keeps fewer bolts in the air', () => {
    // a fortress of five ships round you, all in reach and all firing
    const posts = [0, 1, 2, 3, 4].map((i) => post({ id: `p${i}`, at: { x: 70 * Math.cos((i * 2 * Math.PI) / 5), y: 0, z: 70 * Math.sin((i * 2 * Math.PI) / 5) } }));
    const most = (small) => {
      const g = createGarrison({ rand: seeded(1), small });
      let n = 0;
      run(g, 20, world({ posts, tier: 'fortress', you: you(0) }), { each: () => (n = Math.max(n, g.info.bolts)) });
      return n;
    };
    expect(most(true)).toBe(GARRISON.smallBolts);
    expect(most(false)).toBeGreaterThan(GARRISON.smallBolts);
    expect(most(false)).toBeLessThanOrEqual(GARRISON.bolts);
  });
});
