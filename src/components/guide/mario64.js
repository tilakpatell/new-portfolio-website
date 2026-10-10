// The Mario 64 tribute's keys: written once, here, and read by the guide's
// /dot-matrix/64 page (./pages.js) and the tribute's pause screen
// (mario64/Mario64.jsx), so the two never say different things. A file of
// its own, not a const in ./pages.js, so the world's chunk doesn't carry the
// whole guide to draw seven rows (as ./cybertron.js). Rows as the guide
// writes them ([keys, what they do], ./keys.js).

export const TRIBUTE_KEYS = [
  ['W A S D / ← ↑ ↓ →', 'Run (Mario goes the way you push, from the camera)'],
  ['Space / K', 'Jump (A): again on landing for a double, a third for the triple'],
  ['J / F', 'Punch, pick up, throw, dive (B); talk and read'],
  ['Shift', 'Crouch (Z): with a jump, a backflip or a long jump; in the air, a ground pound'],
  ['Q E / drag', 'Turn the camera'],
  ['R / wheel', 'The camera’s distance'],
  ['Esc / P', 'Pause'],
];

// …a phone's (the pad's own words)
export const TRIBUTE_TOUCH = [
  ['Stick', 'Run'],
  ['A', 'Jump'],
  ['B', 'Punch, pick up, talk'],
  ['Z', 'Crouch, ground pound'],
  ['Drag', 'Turn the camera'],
];

// …and a controller's, in a line (the guide's tip and the pause screen's)
export const TRIBUTE_PAD = 'In the tribute, the left stick runs, A jumps, B or X punches, either trigger crouches (Z), the right stick or the bumpers turn the camera, Y sets its distance and Start pauses.';
