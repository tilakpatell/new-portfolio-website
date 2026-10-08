import { describe, expect, it } from 'vitest';
import { BATTLE, VIEW_KINDS, angleOf, apparent, battlePlan, boltAt, crossed, exteriorUrl, fighterPose, paintSize, skyPlan } from './views';

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const deg = (r) => (r * 180) / Math.PI;
// the angle between two directions, in degrees
const between = (a, b) => deg(Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b))));
const bodyOf = (kind, id) => skyPlan(kind).bodies.find((b) => b.id === id);
const at = (p) => [p.x, p.y, p.z];
// every time in a loop, a tenth of a second apart
const times = (loop) => Array.from({ length: Math.round(loop * 10) }, (_, i) => i / 10);

describe('how big a thing looks', () => {
  it('measures a sphere’s width as an angle across', () => {
    expect(angleOf(1, 2)).toBeCloseTo(60);
    expect(angleOf(6250, 25000)).toBeCloseTo(28.96, 1);
  });

  it('draws a thing nearer and smaller so that it looks just as big', () => {
    expect(apparent(6250, 25000, 1000)).toBeCloseTo(250);
    expect(angleOf(apparent(6250, 25000, 1000), 1000)).toBeCloseTo(angleOf(6250, 25000));
  });
});

describe('the sky out of each window', () => {
  it('knows every kind of window', () => {
    expect(VIEW_KINDS).toEqual(['space', 'alderaan', 'yavin', 'endor', 'endor-battle', 'ds1-exterior', 'ds2-exterior']);
    for (const kind of VIEW_KINDS) expect(skyPlan(kind)).toBeTruthy();
  });

  it('shows Alderaan big in the overbridge window, a quarter to a half of the view across', () => {
    const a = bodyOf('alderaan', 'alderaan');
    expect(angleOf(a.radius, a.distance)).toBeGreaterThan(18);
    expect(angleOf(a.radius, a.distance)).toBeLessThan(35);
  });

  it('puts Yavin 4 beside its gas giant, clear of it and much smaller', () => {
    const giant = bodyOf('yavin', 'yavin');
    const moon = bodyOf('yavin', 'yavin-4');
    const apart = between(giant.position, moon.position);
    expect(apart).toBeGreaterThan((angleOf(giant.radius, giant.distance) + angleOf(moon.radius, moon.distance)) / 2);
    expect(angleOf(moon.radius, moon.distance)).toBeLessThan(angleOf(giant.radius, giant.distance) / 2);
  });

  it('shows Endor’s forest moon, which the second station keeps close to, bigger than the gas giant beyond it', () => {
    const giant = bodyOf('endor', 'endor');
    const moon = bodyOf('endor', 'forest-moon');
    expect(angleOf(moon.radius, moon.distance)).toBeGreaterThan(2 * angleOf(giant.radius, giant.distance));
    expect(bodyOf('endor-battle', 'forest-moon')).toBeTruthy();
    expect(bodyOf('ds2-exterior', 'forest-moon')).toBeTruthy();
  });

  it('draws every body at its true apparent size, whatever distance it is drawn at', () => {
    for (const kind of VIEW_KINDS) {
      for (const b of skyPlan(kind).bodies) {
        expect(angleOf(b.r, len(b.position))).toBeCloseTo(angleOf(b.radius, b.distance), 6);
      }
    }
  });

  it('draws a nearer body over a farther one', () => {
    expect(bodyOf('yavin', 'yavin-4').order).toBeGreaterThan(bodyOf('yavin', 'yavin').order);
    expect(bodyOf('endor', 'forest-moon').order).toBeGreaterThan(bodyOf('endor', 'endor').order);
  });

  it('lights every window by a sun from one direction', () => {
    for (const kind of VIEW_KINDS) expect(len(skyPlan(kind).sun)).toBeCloseTo(1);
  });

  it('shows each station whole and in front of the window, at its own true size', () => {
    const one = skyPlan('ds1-exterior').station;
    const two = skyPlan('ds2-exterior').station;
    expect(one.id).toBe('ds1');
    expect(two.id).toBe('ds2');
    for (const s of [one, two]) {
      expect(s.position[2]).toBeLessThan(0);
      expect(angleOf(s.r, len(s.position))).toBeCloseTo(angleOf(s.radius, s.distance), 6);
      expect(angleOf(s.radius, s.distance)).toBeGreaterThan(15);
      expect(angleOf(s.radius, s.distance)).toBeLessThan(45);
      // the far side still inside the camera’s reach (2000 m) from anywhere in a room
      expect(len(s.position) + s.r).toBeLessThan(1800);
    }
  });
});

describe('which model each station is drawn from', () => {
  it('takes the 4096-texel cut only on the strongest graphics', () => {
    expect(exteriorUrl('ds1', 'ultra')).toBe('/models/universe/death-star.hq.glb');
    expect(exteriorUrl('ds2', 'ultra')).toBe('/models/galaxy/deathstar2.hq.glb');
    for (const level of ['high', 'mid', 'low']) {
      expect(exteriorUrl('ds1', level)).toBe('/models/universe/death-star.glb');
      expect(exteriorUrl('ds2', level)).toBe('/models/galaxy/deathstar2.glb');
    }
  });
});

describe('the size a planet is painted at', () => {
  it('paints twice as wide as tall, finer on stronger devices', () => {
    const sizes = ['low', 'mid', 'high', 'ultra'].map(paintSize);
    for (const s of sizes) expect(s.w).toBe(s.h * 2);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i].w).toBeGreaterThanOrEqual(sizes[i - 1].w);
    expect(sizes[0].w).toBeLessThan(sizes[2].w);
  });

  it('never paints wider than 1024 texels, which already takes most of a second', () => {
    expect(paintSize('ultra').w).toBeLessThanOrEqual(1024);
  });
});

describe('the battle out of the throne room’s window', () => {
  const plan = battlePlan('high');

  it('flies a fleet of each side and a dogfight of X-wings and TIEs', () => {
    const models = new Set(plan.capitals.map((c) => c.model));
    expect(models).toEqual(new Set(['moncal', 'destroyer', 'executor']));
    expect(plan.fighters.some((f) => f.model === 'xwing')).toBe(true);
    expect(plan.fighters.some((f) => f.model === 'tie')).toBe(true);
  });

  it('flies fewer fighters on a phone than on a desktop', () => {
    expect(battlePlan('mid').fighters.length).toBeLessThan(plan.fighters.length);
    expect(battlePlan('low').fighters.length).toBeLessThanOrEqual(battlePlan('mid').fighters.length);
  });

  it('is the same battle every time it is drawn', () => {
    expect(battlePlan('high')).toEqual(plan);
  });

  it('shows the Executor as the biggest ship in the fleet, and every one smaller in the window than the forest moon', () => {
    const angle = (c) => deg(2 * Math.atan(c.length / 2 / len(c.position)));
    const executor = plan.capitals.find((c) => c.model === 'executor');
    for (const c of plan.capitals) if (c !== executor) expect(angle(c)).toBeLessThan(angle(executor));
    const moon = bodyOf('endor-battle', 'forest-moon');
    expect(angle(executor)).toBeLessThan(angleOf(moon.radius, moon.distance));
  });

  it('keeps every capital ship out beyond the window and inside the camera’s reach', () => {
    for (const c of plan.capitals) {
      expect(c.position[2]).toBeLessThan(-300);
      expect(len(c.position) + c.length).toBeLessThan(1800);
    }
  });

  it('flies every fighter at a fighter’s pace', () => {
    for (const f of plan.fighters) {
      for (const t of times(plan.loop)) {
        const a = fighterPose(f, t);
        const b = fighterPose(f, t + 0.01);
        const speed = len(sub(at(b), at(a))) / 0.01;
        expect(speed).toBeGreaterThan(25);
        expect(speed).toBeLessThan(220);
      }
    }
  });

  it('keeps the dogfight out beyond the window', () => {
    for (const f of plan.fighters) {
      for (const t of times(plan.loop)) {
        const p = at(fighterPose(f, t));
        expect(len(p)).toBeGreaterThan(100);
        expect(len(p)).toBeLessThan(900);
        expect(p[2]).toBeLessThan(-100);
      }
    }
  });

  it('keeps a chaser on its quarry’s tail', () => {
    const chasers = plan.fighters.filter((f) => f.chases >= 0);
    expect(chasers.length).toBeGreaterThan(2);
    for (const f of chasers) {
      const quarry = plan.fighters[f.chases];
      expect(quarry.model).not.toBe(f.model);
      for (const t of times(plan.loop)) {
        const gap = len(sub(at(fighterPose(f, t)), at(fighterPose(quarry, t))));
        expect(gap).toBeGreaterThan(15);
        expect(gap).toBeLessThan(250);
      }
    }
  });

  it('turns a fighter’s nose the way it is flying', () => {
    const f = plan.fighters[0];
    const a = fighterPose(f, 3);
    const b = fighterPose(f, 3.01);
    expect(between([a.dx, a.dy, a.dz], sub(at(b), at(a)))).toBeLessThan(2);
  });

  it('comes round again each loop, every fighter where it was a loop before', () => {
    for (const f of plan.fighters) {
      for (const t of [0.5, 7.3, 21.1]) {
        const a = fighterPose(f, t);
        const b = fighterPose(f, t + plan.loop);
        expect(len(sub(at(a), at(b)))).toBeLessThan(1e-6);
        expect(b.show).toBeCloseTo(a.show);
      }
    }
  });

  it('takes a fighter that is shot down away, then brings another round in its place', () => {
    const lost = plan.fighters.filter((f) => f.down != null);
    expect(lost.length).toBeGreaterThan(0);
    for (const f of lost) {
      expect(fighterPose(f, f.down - 0.1).show).toBe(1);
      expect(fighterPose(f, f.down + 0.1).show).toBe(0);
      expect(fighterPose(f, f.down + BATTLE.gone + BATTLE.grow + 0.1).show).toBe(1);
    }
  });

  it('blows a fighter up where it is shot down', () => {
    for (const f of plan.fighters.filter((x) => x.down != null)) {
      const blast = plan.blasts.find((b) => b.fighter === plan.fighters.indexOf(f));
      expect(blast.at).toBeCloseTo(f.down);
    }
  });

  it('never fires at a fighter that isn’t there', () => {
    for (const s of plan.shots.filter((x) => x.target != null && x.kind === 'fighter')) {
      const quarry = plan.fighters[s.target];
      expect(fighterPose(quarry, s.at).show).toBe(1);
      expect(fighterPose(plan.fighters[s.from], s.at).show).toBe(1);
    }
  });

  it('fires the capital ships’ turbolasers across at the other side', () => {
    const big = plan.shots.filter((s) => s.kind === 'capital');
    expect(big.length).toBeGreaterThan(5);
    for (const s of big) expect(plan.capitals[s.from].side).not.toBe(plan.capitals[s.target].side);
  });
});

describe('a bolt in flight', () => {
  const plan = battlePlan('high');
  const shot = plan.shots.find((s) => s.kind === 'capital');

  it('is not there before it is fired, nor once it has struck', () => {
    expect(boltAt(plan, shot, shot.at - 0.05)).toBeNull();
    const b = boltAt(plan, shot, shot.at + 0.01);
    expect(b).not.toBeNull();
    expect(boltAt(plan, shot, shot.at + b.life + 0.05)).toBeNull();
  });

  it('flies from the gun that fired it to the ship it was fired at', () => {
    const early = boltAt(plan, shot, shot.at + 0.01);
    const late = boltAt(plan, shot, shot.at + early.life - 0.01);
    const target = plan.capitals[shot.target].position;
    expect(len(sub(at(late), target))).toBeLessThan(len(sub(at(early), target)));
    expect(len(sub(at(late), target))).toBeLessThan(plan.capitals[shot.target].length);
  });

  it('flies the same way round each loop', () => {
    const a = boltAt(plan, shot, shot.at + 0.2);
    const b = boltAt(plan, shot, shot.at + 0.2 + plan.loop);
    expect(len(sub(at(a), at(b)))).toBeLessThan(1e-6);
  });

  it('is red from the Rebels and green from the Empire', () => {
    for (const s of plan.shots) {
      const side = s.kind === 'capital' ? plan.capitals[s.from].side : plan.fighters[s.from].side;
      const b = boltAt(plan, s, s.at + 0.02);
      expect(b.hue).toBe(side === 'rebel' ? 'red' : 'green');
    }
  });
});

describe('what happens between two frames', () => {
  it('catches a moment that falls between them', () => {
    expect(crossed(5, 4.9, 5.1, 40)).toBe(true);
    expect(crossed(5, 5.1, 5.2, 40)).toBe(false);
    expect(crossed(5, 4.8, 4.9, 40)).toBe(false);
  });

  it('catches it again each loop, and across the loop’s seam', () => {
    expect(crossed(5, 44.9, 45.1, 40)).toBe(true);
    expect(crossed(0.05, 39.95, 40.1, 40)).toBe(true);
    expect(crossed(39.98, 39.95, 40.1, 40)).toBe(true);
  });

  it('catches each moment once a loop, however the frames fall', () => {
    let seen = 0;
    let t = 0;
    for (let i = 0; i < 1000; i++) {
      const dt = 0.011 + (i % 7) * 0.013;
      if (crossed(12.34, t, t + dt, 40)) seen++;
      t += dt;
    }
    expect(seen).toBe(Math.floor((t - 12.34) / 40) + 1);
  });
});
