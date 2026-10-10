// How each of the other pilots is drawn, now the universe is spread wide:
// a ship near you, and otherwise nothing in the sky (the chart's blip is
// NavMap.jsx's). Pure, so it's tested in Node; pilots.js reads it each frame.

// map units: within this of you, a pilot is drawn as their ship
export const DRAW = 3000;

// 'ship' | 'blip', for a pilot at `pose` (protocol.js's) seen from `me`
// ({ x, y, z }, or null: not flying, so everyone's far). (An old client's
// lane bit, from when there were hyperlanes, means nothing now.)
export function howToDraw(pose, me) {
  return me && Math.hypot(pose.x - me.x, pose.y - me.y, pose.z - me.z) <= DRAW ? 'ship' : 'blip';
}
