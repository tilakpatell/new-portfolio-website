// Across Gorgoroth, as rules. Hold to walk; let go and the elven cloaks hide
// Frodo and Sam. The Eye's light sweeps the plain: walk in it and you're seen.
// The Ring weighs more the longer Frodo walks without a rest, and if it gets
// too heavy he puts it on. Orc patrols march down the road from the mountain:
// be standing still when they pass. Three quarters of the way, Sam carries
// him, and the Ring stops getting heavier.

export const WALK = {
  x0: 60,
  x1: 470,
  speed: 52, // plain units a second
  carrySpeed: 1.3, // Sam, carrying Frodo, is quicker than Frodo was
  carryAt: 0.75,
  grace: 0.18, // seconds in the light before the Eye sees you
  beamHalf: 30,
  warn: 110, // how close the light is when the plain starts to glow
  burdenUp: 0.2, // a second of walking
  burdenDown: 0.35, // a second of rest
  patrol: { speed: 38, first: [4, 7], every: [8, 13], reach: 16 },
};

export const spotOf = (s) => (s.beamAt ? s.beamAt(s) : 265 + Math.sin(s.phase) * 215);
const between = (rand, [a, b]) => a + rand() * (b - a);

export function newWalk({ rand = Math.random } = {}) {
  return { x: WALK.x0, t: 0, phase: 1.2, exposed: 0, burden: 0, state: 'walking', patrols: [], patrolAt: between(rand, WALK.patrol.first), passed: 0, carried: false, rand, beamAt: null };
}

export function stepWalk(s, dt, walking) {
  const ev = [];
  if (s.state !== 'walking') return ev;
  s.t += dt;
  const near = (s.x - WALK.x0) / (WALK.x1 - WALK.x0);
  // the Eye sweeps a little faster as they get closer
  s.phase += dt * (0.55 + near * 0.5);
  if (!s.carried && near >= WALK.carryAt) {
    s.carried = true;
    ev.push({ type: 'carry' });
  }
  if (walking) {
    s.x = Math.min(WALK.x1, s.x + WALK.speed * (s.carried ? WALK.carrySpeed : 1) * dt);
    if (!s.carried) s.burden = Math.min(1, s.burden + WALK.burdenUp * dt);
  } else s.burden = Math.max(0, s.burden - WALK.burdenDown * dt);
  if (s.burden >= 1) {
    s.state = 'ring';
    ev.push({ type: 'ring' });
    return ev;
  }
  // a moment's grace in the light
  const gap = Math.abs(spotOf(s) - s.x);
  s.exposed = walking && gap < WALK.beamHalf ? s.exposed + dt : 0;
  if (s.exposed > WALK.grace) {
    s.state = 'seen';
    ev.push({ type: 'seen' });
    return ev;
  }
  // orc patrols, marching down the road towards them
  s.patrolAt -= dt;
  if (s.patrolAt <= 0) {
    s.patrolAt = between(s.rand, WALK.patrol.every);
    if (s.x < WALK.x1 - 80) {
      s.patrols.push({ x: WALK.x1 + 30 });
      ev.push({ type: 'patrol' });
    }
  }
  for (const p of s.patrols) {
    p.x -= WALK.patrol.speed * dt;
    if (p.past) continue;
    if (Math.abs(p.x - s.x) < WALK.patrol.reach) {
      if (walking) {
        s.state = 'caught';
        ev.push({ type: 'caught' });
        return ev;
      }
    } else if (p.x < s.x - WALK.patrol.reach) {
      p.past = true;
      s.passed += 1;
      ev.push({ type: 'passed' });
    }
  }
  s.patrols = s.patrols.filter((p) => p.x > WALK.x0 - 60);
  if (s.x >= WALK.x1) {
    s.state = 'there';
    ev.push({ type: 'there' });
  }
  return ev;
}
