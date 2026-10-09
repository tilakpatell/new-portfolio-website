import { describe, expect, it } from 'vitest';
import { HURT, TRENCH, fireTorpedo, newRun, portZ, stepRun, toggleComputer, trenchStart, zoneAt } from './trench';

const fly = (g, secs, keys = {}, dt = 1 / 60) => {
  for (let t = 0; t < secs && g.status === 'running'; t += dt) {
    g.keys = { ...keys };
    stepRun(g, dt);
  }
};
const quiet = (g) => {
  // nothing in the sky or the trench but what the test puts there
  g.items = [];
  g.towers = [];
  g.ties = [];
  g.tieAt = [];
  g.bolts = [];
  g.vader.gone = true;
};

describe('the trench run', () => {
  it('opens over the surface, dives at the trench, and flies it to the port', () => {
    const g = newRun({ seed: 1 });
    expect(zoneAt(g.z)).toBe('surface');
    expect(zoneAt(TRENCH.surfaceLen + TRENCH.diveLen + 1)).toBe('trench');
    expect(portZ()).toBeGreaterThan(TRENCH.surfaceLen + TRENCH.diveLen + TRENCH.trenchLen);
  });

  it('brings the ship down into the trench on the dive, however high it was', () => {
    const g = newRun({ seed: 2 });
    quiet(g);
    g.z = TRENCH.surfaceLen - 1;
    g.py = g.ty = 2.4;
    g.px = g.tx = 2;
    fly(g, (TRENCH.diveLen + 4) / g.speed);
    expect(zoneAt(g.z)).toBe('trench');
    expect(g.py).toBeLessThanOrEqual(TRENCH.bounds.trench.y[1] + 1e-6);
    expect(Math.abs(g.px)).toBeLessThanOrEqual(TRENCH.bounds.trench.x + 1e-6);
  });

  it('loses a run where nobody touches the controls', () => {
    const g = newRun({ seed: 3 });
    fly(g, 80);
    expect(g.status).toBe('lost');
  });

  it('shoots down a TIE fighter in the line of fire, and scores it', () => {
    const g = newRun({ seed: 4 });
    quiet(g);
    g.ties.push({ x: g.px, y: g.py, z: g.z + 14, x0: g.px, phase: 0, fire: 99, alive: true });
    fly(g, 1.2, { fire: true });
    expect(g.ties.every((t) => !t.alive)).toBe(true);
    expect(g.kills.tie).toBe(1);
    expect(g.score).toBeGreaterThanOrEqual(TRENCH.points.tie);
  });

  it('pays a combo for TIEs downed close together', () => {
    const g = newRun({ seed: 5 });
    quiet(g);
    g.ties.push({ x: g.px, y: g.py, z: g.z + 10, x0: g.px, phase: 0, fire: 99, alive: true });
    g.ties.push({ x: g.px, y: g.py, z: g.z + 16, x0: g.px, phase: 0, fire: 99, alive: true });
    fly(g, 1.5, { fire: true });
    expect(g.kills.tie).toBe(2);
    expect(g.score).toBeGreaterThan(2 * TRENCH.points.tie);
  });

  it('takes a shield when a TIE’s shot lands', () => {
    const g = newRun({ seed: 6 });
    quiet(g);
    const s = g.shields;
    g.bolts.push({ x: g.px, y: g.py, z: g.z + 3, vx: 0, vy: 0, vz: -20, from: 'tie' });
    fly(g, 0.5);
    expect(g.shields).toBe(s - 1);
  });

  it('pays for a near miss', () => {
    const g = newRun({ seed: 7 });
    quiet(g);
    g.z = TRENCH.surfaceLen + TRENCH.diveLen + 5;
    g.px = g.tx = 0;
    g.py = g.ty = 0.5;
    g.items.push({ kind: 'catwalk', z: g.z + 4, y: 0.5 - 0.34 });
    fly(g, 1);
    expect(g.shields).toBe(g.maxShields);
    expect(g.nearMisses).toBe(1);
  });

  it('lets R2 patch one shield, once, a while after a hit', () => {
    const g = newRun({ seed: 8 });
    quiet(g);
    g.bolts.push({ x: g.px, y: g.py, z: g.z + 2, vx: 0, vy: 0, vz: -20, from: 'tie' });
    fly(g, 0.5);
    const hurt = g.shields;
    fly(g, TRENCH.r2Delay + 1);
    expect(g.shields).toBe(hurt + 1);
    g.bolts.push({ x: g.px, y: g.py, z: g.z + 2, vx: 0, vy: 0, vz: -20, from: 'tie' });
    fly(g, TRENCH.r2Delay + 2);
    expect(g.shields).toBe(hurt);
  });

  it('wins with a torpedo in the window, lined up', () => {
    const g = newRun({ seed: 9 });
    quiet(g);
    g.z = portZ() - 5;
    g.px = g.tx = 0;
    g.py = g.ty = -0.4;
    fireTorpedo(g);
    expect(g.status).toBe('winning');
    fly(g, 0);
    for (let i = 0; i < 200; i++) stepRun(g, 1 / 60);
    expect(g.status).toBe('won');
    expect(g.score).toBeGreaterThanOrEqual(TRENCH.points.port);
  });

  it('wastes a torpedo fired too early, and loses once the last one lands', () => {
    const g = newRun({ seed: 10 });
    quiet(g);
    g.z = portZ() - 20;
    fireTorpedo(g);
    expect(g.torpedoes).toBe(1);
    expect(g.status).toBe('running');
    fireTorpedo(g);
    expect(g.status).toBe('running'); // still in flight
    fly(g, 2);
    expect(g.status).toBe('lost');
  });

  it('holds a torpedo fired before the trench', () => {
    const g = newRun({ seed: 11 });
    quiet(g);
    fireTorpedo(g);
    expect(g.torpedoes).toBe(2);
  });

  it('flies a missed torpedo down onto the trench and leaves a scorch mark', () => {
    const g = newRun({ seed: 13 });
    quiet(g);
    g.z = portZ() - 60;
    g.px = g.tx = 0.3;
    g.py = g.ty = 0.2;
    fireTorpedo(g);
    expect(g.shots.length).toBe(1);
    const events = [];
    for (let i = 0; i < 180 && g.shots.length; i++) {
      stepRun(g, 1 / 60);
      events.push(...g.events.splice(0));
    }
    expect(g.shots.length).toBe(0);
    expect(g.scorch.length).toBe(1);
    expect(g.scorch[0].y).toBeGreaterThanOrEqual(-1);
    expect(g.scorch[0].z).toBeGreaterThan(g.z);
    expect(events.some((e) => e.type === 'miss')).toBe(true);
    expect(g.blasts.length).toBeGreaterThan(0);
  });

  it('blasts a catwalk, a wall or a turret in a torpedo’s path, and the ship flies through', () => {
    for (const it of [
      { kind: 'catwalk', y: 0.1 },
      { kind: 'wall', side: -1 },
      { kind: 'turret', side: -1, y: 0.1, fired: true, alive: true },
    ]) {
      const g = newRun({ seed: 14 });
      quiet(g);
      g.z = trenchStart() + 20;
      g.px = g.tx = -0.2;
      g.py = g.ty = 0.1;
      if (it.kind === 'turret') g.px = g.tx = -0.7;
      g.items = [{ ...it, z: g.z + 8 }];
      const score = g.score;
      fireTorpedo(g);
      const events = [];
      for (let i = 0; i < 90; i++) {
        g.keys = {};
        stepRun(g, 1 / 60);
        events.push(...g.events.splice(0));
      }
      const blast = events.find((e) => e.type === 'blast');
      expect(blast?.what).toBe(it.kind);
      expect(g.score).toBeGreaterThan(score);
      expect(g.shields).toBe(g.maxShields); // nothing left to hit
      expect(g.items[0].blasted).toBe(true);
    }
  });

  it('flies a torpedo over a catwalk it clears', () => {
    const g = newRun({ seed: 15 });
    quiet(g);
    g.z = trenchStart() + 20;
    g.px = g.tx = 0;
    g.py = g.ty = 0.6;
    g.items = [{ kind: 'catwalk', z: g.z + 6, y: -0.6 }];
    fireTorpedo(g);
    for (let i = 0; i < 30; i++) stepRun(g, 1 / 60);
    expect(g.items[0].blasted).toBeFalsy();
  });

  it('pays half again for a shot with the targeting computer off', () => {
    const shoot = (computer) => {
      const g = newRun({ seed: 12 });
      quiet(g);
      if (!computer) toggleComputer(g);
      g.z = portZ() - 5;
      g.px = g.tx = 0;
      g.py = g.ty = -0.4;
      fireTorpedo(g);
      for (let i = 0; i < 200; i++) stepRun(g, 1 / 60);
      return g.score;
    };
    expect(shoot(false)).toBeGreaterThan(shoot(true));
  });

  it('sets shields and speed by difficulty', () => {
    const rookie = newRun({ seed: 1, level: 'rookie' });
    const jedi = newRun({ seed: 1, level: 'jedi' });
    expect(rookie.shields).toBeGreaterThan(jedi.shields);
    expect(jedi.speed).toBeGreaterThan(rookie.speed);
  });

  it('restarts clean: three runs from one seed go the same way', () => {
    const play = () => {
      const g = newRun({ seed: 77 });
      fly(g, 20, { fire: true, left: true });
      return [g.score, g.shields, g.z.toFixed(3), g.kills.tie];
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(play()).toEqual(a);
  });
});

// A pilot that flies the way a good player would with a touch screen: weave
// over the surface shooting, then thread the trench by looking a little
// ahead, and line up low and centred for the port.
function autopilot(g) {
  const ahead = (d) => g.items.find((it) => !it.done && it.kind !== 'turret' && it.z - g.z > 0.9 && it.z - g.z < d);
  const toPort = portZ() - g.z;
  g.keys = { fire: true };
  if (zoneAt(g.z) !== 'trench') {
    g.tx = Math.sin(g.t * 1.3) * 1.6;
    g.ty = 2.1 + Math.sin(g.t * 2.1) * 0.35;
  } else if (toPort < 12) {
    g.tx = 0;
    g.ty = -0.6;
    if (toPort < 6) fireTorpedo(g);
  } else {
    const it = ahead(5.5);
    if (!it) {
      g.tx = Math.sin(g.t * 2) * 0.35;
      g.ty = Math.sin(g.t * 1.7) * 0.3;
    } else if (it.kind === 'catwalk') g.ty = it.y > 0 ? -0.75 : 0.75;
    else if (it.kind === 'wall') g.tx = it.side < 0 ? 0.7 : -0.7;
    else {
      g.tx = it.x > 0 ? -0.7 : 0.7;
      g.ty = it.y > 0 ? -0.6 : 0.6;
    }
  }
}

describe('the trench run can be won', () => {
  it('by a careful pilot, most of the time on Red Five', () => {
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const g = newRun({ seed, level: 'red5' });
      for (let i = 0; i < 60 * 90 && (g.status === 'running' || g.status === 'winning'); i++) {
        if (g.status === 'running') autopilot(g);
        stepRun(g, 1 / 60);
      }
      if (g.status === 'won') wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(6);
  });

  // a rule change (the game-feel design's one, with Lawn's): a hit leaves
  // the ship a second clear, so a catwalk straight after the bolt that
  // rocked you, or a TIE's pair of shots, costs one shield, not two
  it('costs one shield for hits inside a second of each other, and another after it', () => {
    const g = newRun({ seed: 9, level: 'red5' });
    quiet(g);
    const at = (dz) => g.bolts.push({ x: g.px, y: g.py, z: g.z + dz, vx: 0, vy: 0, vz: 0, from: 'tie', done: false });
    const full = g.shields;
    at(0.05);
    fly(g, 0.1);
    expect(g.shields).toBe(full - 1);
    at(0.05);
    fly(g, 0.1);
    expect(g.shields).toBe(full - 1); // (0.1 s after: clear)
    fly(g, TRENCH.iframes);
    at(0.05);
    fly(g, 0.1);
    expect(g.shields).toBe(full - 2);
    expect(TRENCH.iframes).toBe(1);
  });

  it('says how hard each hit was: flying into the trench hardest, a bolt least', () => {
    const g = newRun({ seed: 10 });
    quiet(g);
    g.bolts.push({ x: g.px, y: g.py, z: g.z + 0.05, vx: 0, vy: 0, vz: 0, from: 'turret', done: false });
    fly(g, 0.1);
    const hit = g.events.find((e) => e.type === 'hit');
    expect(hit.force).toBe(HURT.bolt);
    expect(HURT.crash).toBeGreaterThan(HURT.ram);
    expect(HURT.ram).toBeGreaterThan(HURT.bolt);
  });
});
