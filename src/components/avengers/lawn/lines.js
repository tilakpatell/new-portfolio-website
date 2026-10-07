// What Thor says on the lawn as each wave comes in (HoldTheLawn.jsx).
export const LINES = [
  'Chitauri, out of the trees. Throw the hammer, then call it back through them.',
  'These ones stop to shoot. With Mjolnir in your hand you knock bolts away. With it out, you don’t.',
  'Shields on the big ones. Throw past them, walk along the terrace, and call it back through their backs.',
  'Chariots. Point at one to throw high.',
  'They’re pushing. Kills charge the lightning: E, or right-click.',
  'A swarm. Lightning jumps from one to the next.',
  'Everything they have left.',
  'Cull Obsidian. His shield turns the hammer from the front. Get it behind him.',
];

// And what he says as it goes: the hammer lifted, or slipping back; the
// first time a shield turns it, a bolt gets you or one gets past; and the
// lightning charged, given whether you play with a keyboard (else by touch).
export const SAYS = {
  lifted: 'Worthy. The sky answers.',
  drop: 'It slips back into the crater. Hold on, and keep the needle in the green.',
  block: 'The shield turned it. Throw past it, then call the hammer back through its back.',
  bolt: 'With the hammer out, bolts get through. Call it back, or step aside.',
  breach: 'One got past the line. Don’t let them reach the terrace.',
};
export const READY = (keys) => `Lightning ready. ${keys ? 'E, or right-click,' : 'The bolt button'} brings it down: on the hammer if it’s out, else where you aim.`;

// all of it, either way it's played: what can be said in his own voice (lib/voiced.js)
export const SPOKEN = [...LINES, ...Object.values(SAYS), READY(true), READY(false)];
