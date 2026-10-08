// Aiming at a star and jumping to it, the galaxy's way. Pure, tested in
// Node; scene.js reads it each frame.
//
// From anywhere on the map the other places are stars (farStars.js) or
// landmarks (landmarks.js); put the nose on one, within AIM_CONE, and it's
// the aim: its name shows with J to jump. A jump then comes round onto it
// first (`align`, as the galaxy's does: the ship turns until it's pointing
// true, or JUMP.align seconds have gone), then spools up and goes; the stick
// in the meantime calls it off.
//
// aimTargets(sector, at) → [{ id, at }]: everywhere in that sector there is
//   to jump to (somewhere the autopilot can go: the home sun is home, the
//   Twins are one place), not `at`, the place you're at
// aimFrom(from, nose, targets, keep) → { id, angle } | null: the one nearest
//   the nose within the cone (the galaxy's starAhead); `keep`, the one it had,
//   is kept a little longer, so the aim doesn't flick between two close ones
// jumpPhase(jump, { aligned, age, input }) → 'align' | 'spool' | 'cancel'

import { FAR_STARS } from './farStars';
import { LANDMARKS } from './landmarks';
import { SUN } from './layout';
import { isGoal } from './ship';
import { WONDERS } from './deep';
import { starAhead } from '../galaxy/systems';

export const AIM_CONE = 0.06; // radians either side of the nose
const STICK = 0.012; // how much nearer another must be to take the aim
export const JUMP = { align: 4.5, aligned: 0.996 };

const atOf = (id) => (id === 'sun' ? SUN.at : (WONDERS.find((w) => w.id === id)?.at ?? null));
const ALL = [
  ...FAR_STARS.filter((p) => !p.station).map((p) => ({ id: p.id, at: p.at, sector: p.sector })),
  ...[...new Map(LANDMARKS.map((l) => [l.id, l])).values()].map((l) => ({ id: l.id === 'sun' ? 'home' : l.id, at: atOf(l.id), sector: l.sector })),
].filter((t) => t.at && isGoal(t.id));

export const aimTargets = (sector, at) => ALL.filter((t) => t.sector === sector && t.id !== at).map(({ id, at: where }) => ({ id, at: where }));

export function aimFrom(from, nose, targets, keep = null) {
  const dirs = targets.map((t) => {
    const dx = t.at[0] - from[0];
    const dy = t.at[1] - from[1];
    const dz = t.at[2] - from[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    return { id: t.id, dir: [dx / l, dy / l, dz / l] };
  });
  return starAhead(null, nose, { within: AIM_CONE, keep, stick: STICK, dirs });
}

export function jumpPhase(jump, { aligned, age, input }) {
  if (jump.phase !== 'align') return jump.phase;
  if (input) return 'cancel';
  return aligned > JUMP.aligned || age > JUMP.align ? 'spool' : 'align';
}
