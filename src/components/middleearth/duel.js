// The Bridge of Khazad-dûm, as a duel: drums, then the Balrog comes across.
// Now and then it raises its whip (you can see it coming) and lashes; raise
// the staff as it falls to turn it, or Gandalf loses some of his will. A block
// at nothing leaves the staff down for a moment, so it can't be mashed.
// Strike the bridge once it is out over the drop: right over the deepest part
// is perfect. Strike too soon and it costs will. Each win, it comes faster.
// x is where the Balrog stands on the drawing (its far ledge at `start`).

export const DUEL = {
  start: 40,
  end: 490, // close enough to reach Gandalf
  tooSoon: 230, // strike before here and the bridge holds
  sweet: [280, 370], // over the deepest part of the drop
  good: 60, // this far either side of it is still good
  drums: 2.4, // seconds of drums before it comes
  crossing: 7.5, // seconds to cross, the first time
  fastest: 4.2,
  speedUp: 0.9, // each round takes this much of the last one's time
  windup: 0.8, // seconds from raising the whip to the lash
  blockBefore: 0.15, // the staff can turn it this long before the lash
  blockAfter: 0.35, // and this long after
  recover: 1, // seconds the staff is down after a block at nothing
  lashEvery: [2, 3.2],
  will: 3,
  points: { perfect: 300, good: 150, close: 80, block: 25, will: 20 },
};

export const crossingFor = (round) => Math.max(DUEL.fastest, DUEL.crossing * DUEL.speedUp ** round);
const lashGap = (d) => (DUEL.lashEvery[0] + d.rand() * (DUEL.lashEvery[1] - DUEL.lashEvery[0])) * 0.93 ** d.round;

export function newDuel({ round = 0, white = false, rand = Math.random } = {}) {
  const d = { phase: 'drums', t: 0, x: DUEL.start, round, white, will: DUEL.will + (white ? 1 : 0), rand, crossing: crossingFor(round), whip: null, recover: 0, blocks: 0, score: 0, grade: null, reason: null };
  d.nextLash = 1.2 + rand();
  return d;
}

const lose = (d, reason, ev) => {
  d.phase = 'lost';
  d.reason = reason;
  ev.push({ type: 'lost', reason });
};

export function stepDuel(d, dt) {
  const ev = [];
  if (d.recover > 0) d.recover = Math.max(0, d.recover - dt);
  if (d.phase === 'drums') {
    d.t += dt;
    if (d.t >= DUEL.drums) {
      d.phase = 'coming';
      d.t = 0;
      ev.push({ type: 'coming' });
    }
    return ev;
  }
  if (d.phase !== 'coming') return ev;
  d.t += dt;
  d.x = Math.min(DUEL.end, d.x + ((DUEL.end - DUEL.start) / d.crossing) * dt);
  // the whip: wound up, then the lash, turned by the staff or not
  if (d.whip) {
    d.whip.t += dt;
    if (d.whip.t >= DUEL.windup + DUEL.blockAfter) {
      const { blocked } = d.whip;
      d.whip = null;
      d.nextLash = lashGap(d);
      if (!blocked) {
        d.will -= 1;
        ev.push({ type: 'lashed', will: d.will });
        if (d.will <= 0) {
          lose(d, 'beaten', ev);
          return ev;
        }
      }
    }
  } else {
    d.nextLash -= dt;
    if (d.nextLash <= 0 && d.x < DUEL.end - 40) {
      d.whip = { t: 0, blocked: false };
      ev.push({ type: 'windup' });
    }
  }
  if (d.x >= DUEL.end) lose(d, 'crossed', ev);
  return ev;
}

// Raise the staff against the whip.
export function block(d) {
  if (d.phase !== 'coming') return { ok: false };
  if (d.recover > 0) return { ok: false, recovering: true };
  const w = d.whip;
  if (w && !w.blocked && w.t >= DUEL.windup - DUEL.blockBefore && w.t <= DUEL.windup + DUEL.blockAfter) {
    w.blocked = true;
    d.blocks += 1;
    return { ok: true };
  }
  d.recover = DUEL.recover;
  return { ok: false };
}

// Strike the bridge.
export function strike(d) {
  if (d.phase !== 'drums' && d.phase !== 'coming') return { grade: null };
  if (d.phase === 'drums' || d.x < DUEL.tooSoon) {
    d.will -= 1;
    if (d.will <= 0) lose(d, 'beaten', []);
    return { grade: 'soon', will: d.will };
  }
  const [a, b] = DUEL.sweet;
  const grade = d.x >= a && d.x <= b ? 'perfect' : d.x >= a - DUEL.good && d.x <= b + DUEL.good ? 'good' : 'close';
  const P = DUEL.points;
  d.grade = grade;
  d.phase = 'won';
  d.whip = null;
  d.score = Math.round((P[grade] + d.blocks * P.block + d.will * P.will) * (1 + 0.25 * d.round));
  return { grade, score: d.score };
}
