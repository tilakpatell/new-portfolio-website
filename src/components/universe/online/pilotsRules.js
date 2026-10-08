// How each of the other pilots is drawn, now the universe is spread wide:
// a ship near you, a streak of light along a hyperlane far off while they
// ride it, and otherwise nothing in the sky (the chart's blip is NavMap.jsx's).
// Pure, so it's tested in Node; pilots.js reads it each frame.

// map units: within this of you, a pilot is drawn as their ship
export const DRAW = 3000;

// 'ship' | 'streak' | 'blip', for a pilot at `pose` (protocol.js's, with its
// lane bit) seen from `me` ({ x, y, z }, or null: not flying, so everyone's
// far). `laneAt` is hyperlanes.js's, passed in: the lane bit alone is never
// believed, so a pilot who says they're riding but is off every lane (an old
// client, or a liar) is a blip, never a streak
export function howToDraw(pose, me, { laneAt }) {
  if (me && Math.hypot(pose.x - me.x, pose.y - me.y, pose.z - me.z) <= DRAW) return 'ship';
  return pose.lane && laneAt(pose.x, pose.y, pose.z) ? 'streak' : 'blip';
}
