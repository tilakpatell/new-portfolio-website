// What every brain shares: the numbers a meeting is flown by, and a few
// plain vector sums on { x, y, z }. Pure, so the brains and npcRules.js
// (which runs them) are tested in Node.

export const NPC = {
  seen: 40, // map units: inside this, the first time, it says it's seen you
  park: 3, // past a station's surface, where a merchant parks
  offer: 15, // a parked merchant offers you a part when you're this near
  done: 60, // and leaves once you've gone this far off again
  wary: 45, // a merchant runs from any hunter this near it
  alongside: 5, // how far off your wing an informant flies while it tells you
  tell: 6, // seconds it flies alongside, telling you
  duel: 35, // seconds a rival fights you before it calls it a draw
  orbit: 10, // how far off you a rival circles
  range: 16, // anyone fires inside this
  fear: 60, // a faction an NPC fears, this near it, and it's off
  huntFrom: 50, // one it hunts, this near you, and it goes after it
  far: 150, // further than this from you…
  forget: 10, // …for this long, and it's let go of
  leaveFar: 90, // one leaving is gone once this far from you
  leaveFor: 14, // or after this long
};

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const unit = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
// your nose and your right, level (heading 0 is −z, as ship.js has it)
export const forwardOf = (s) => ({ x: -Math.sin(s.heading ?? 0), y: 0, z: -Math.cos(s.heading ?? 0) });
export const rightOf = (s) => ({ x: Math.cos(s.heading ?? 0), y: 0, z: -Math.sin(s.heading ?? 0) });
// your velocity, level, along your nose
export const velocityOf = (s) => {
  const f = forwardOf(s);
  const v = s.speed ?? 0;
  return { x: f.x * v, y: 0, z: f.z * v };
};
// the nearest of `list` (each with an `at`) to `p`, and how far
export function nearest(list, p, keep = () => true) {
  let best = null;
  let d = Infinity;
  for (const o of list ?? []) {
    if (!keep(o)) continue;
    const k = apart(o.at, p);
    if (k < d) {
      d = k;
      best = o;
    }
  }
  return { it: best, d };
}
