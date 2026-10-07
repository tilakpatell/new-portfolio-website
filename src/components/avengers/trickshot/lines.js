// What Clint says at the start of each round (TrickShot.jsx).
export const INTROS = [
  'Three boards at 18, 30 and 45 metres. Put the sight’s pin for the distance on the gold.',
  'One slides, one swings, and clays come out of the traps. Lead them.',
  'A board hides behind the hay: press F for a half draw and arc one over. Drones up top.',
];

// And what he tells you as it goes: an arrow that falls off the string, the
// half draw, an EMP going off, and the first one into the hay. (The arrow
// on the string, the full draw and a streak's trick arrow are only read.)
export const SAYS = {
  dud: 'Draw it further back: that one fell off the string.',
  lob: 'Half draw: the arrow flies slower and arcs higher. F again for a full draw.',
  emp: 'EMP. Everything that moves is stuck for four seconds.',
  wall: 'Into the hay. Press F for a half draw, aim high, and lob it over.',
};

// all of it: what can be said in his own voice (lib/voiced.js)
export const SPOKEN = [...INTROS, ...Object.values(SAYS)];
