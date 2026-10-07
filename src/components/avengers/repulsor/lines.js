// What F.R.I.D.A.Y. says in the Repulsor Range. The lines with a number in
// them (the armour left, the plates to go, the wave cleared) are put
// together as they happen, in RepulsorRange.jsx.

// as each wave comes in
export const LINES = [
  'Drones inbound, boss. Light them up.',
  'Target practice. Discs on both flanks, points for style.',
  'Sentry incoming. When it glows red, move.',
  'Missiles. Shoot them down before they close.',
  'Sentries and drones together. Watch your lanes.',
  'Three sentries. They’ll try to box you in.',
  'Heavy wave. Keep the reactor topped up.',
  'Swarm. This is what the unibeam is for.',
  'That’s Ultron Prime. Plates first, then the core.',
];

// and when something happens
export const SAYS = {
  core: 'All plates gone. The core is open: hit it.',
  critical: 'Armour critical, boss. One more and you’re walking home.',
  dry: 'Reactor’s dry. Ease off and let it charge.',
  volley: 'Volley incoming! Find the clear lane.',
  won: 'Ultron Prime is scrap. Nice flying, boss.',
};

// the ones that are the same every time, and so can be said in her own voice (lib/voiced.js)
export const SPOKEN = [...LINES, ...Object.values(SAYS)];
