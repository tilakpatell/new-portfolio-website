// Captain Jack Sparrow at the Black Pearl's helm, as the films have him: his
// hands on the wheel, putting it over as you put the helm over, and off it
// for a swig of rum or to rub them over a chest of gold; shouting the guns
// off, thrown by a hit, staring at the kraken as it comes up, a fist in the
// air when a navy ship goes down, and down himself when she goes. What he
// makes of the game's events, as reactions for lib/ai/react.js; ./Tide3D.js
// plays them on his animator. Pure: no three.js.
//
//   JACK_REACTIONS: react.js's table, his own
//   JACK_FIDGETS: what he does with his hands when nothing's happening (one-shots)
//   jackHears(event, pearl) → { event, at: { x, y } | null } | null: a
//     rules.js event as one of his (at: where on the sea to look)
//   rank(event) → how big a moment it is: a bigger one cuts a smaller
//   HELM: { turns, rate }; helmTo(wheel, rudder, dt) → the wheel's turn
//     (radians, + to starboard) eased toward the helm's (rudder −1…1)

export const JACK_REACTIONS = {
  // a broadside of the Pearl's: "Fire!"
  fire: { cooldown: 1.5, react: () => ({ clip: 'shout', layer: 'upper', hold: false, look: null }) },
  // theirs, close: a look, sharp
  gunfire: { cooldown: 5, chance: 0.7, react: () => ({ clip: 'alert', layer: 'upper', hold: false, look: null }) },
  // the Pearl struck
  hit: { cooldown: 0.8, react: (ctx, { rand }) => ({ clip: rand() < 0.6 ? 'hit.chest' : 'hit', layer: 'upper', hold: false, look: null }) },
  // the kraken
  scare: { cooldown: 6, react: () => ({ clip: 'scared', layer: 'upper', hold: false, look: null }) },
  // one of theirs gone down
  win: { cooldown: 3, react: (ctx, { any }) => ({ clip: any(['fist.pump', 'cheer.one', 'taunt']), layer: 'upper', hold: false, look: null }) },
  // the kraken dead, the voyage won
  triumph: { cooldown: 4, react: () => ({ clip: 'victory', layer: 'full', hold: false, look: null }) },
  // a chest aboard: the hands rubbed over it
  loot: { cooldown: 2, react: () => ({ clip: 'scheme', layer: 'upper', hold: false, look: null }) },
  // a cask aboard: why is the rum always gone?
  rum: { cooldown: 2, react: () => ({ clip: 'drink', layer: 'upper', hold: false, look: null }) },
  // the Pearl going under: off his feet, and down
  down: { react: () => ({ clip: 'knockdown', layer: 'full', hold: true, look: null }) },
};

export const JACK_FIDGETS = ['drink', 'drink', 'scheme', 'confused'];

const RANK = { rum: 1, loot: 1, fire: 2, gunfire: 2, win: 3, scare: 4, hit: 5, triumph: 6, down: 9 };
export const rank = (event) => RANK[event] ?? 0;

// the side a broadside goes from, a little way off the beam
const abeam = (p, side) => {
  const a = (p.a ?? 0) + (side * Math.PI) / 2;
  return { x: (p.x ?? 0) + Math.cos(a) * 60, y: (p.y ?? 0) + Math.sin(a) * 60 };
};
const at = (e) => (Number.isFinite(e.x) && Number.isFinite(e.y) ? { x: e.x, y: e.y } : null);
const NEAR = 160; // their broadside this close, he hears it

export function jackHears(e, pearl = {}) {
  switch (e?.type) {
    case 'broadside':
      if (e.owner === 'p') return { event: 'fire', at: abeam(pearl, e.side ?? 1) };
      return Number.isFinite(e.x) && Math.hypot(e.x - (pearl.x ?? 0), e.y - (pearl.y ?? 0)) < NEAR ? { event: 'gunfire', at: at(e) } : null;
    case 'hurt':
      return { event: 'hit', at: null };
    case 'arm':
    case 'kraken':
      return { event: 'scare', at: at(e) };
    case 'surface':
      return e.big ? { event: 'scare', at: at(e) } : null;
    case 'sunk':
      if (e.kind === 'pearl') return { event: 'down', at: null };
      if (e.kind === 'kraken') return { event: 'triumph', at: at(e) };
      return { event: 'win', at: at(e) };
    case 'won':
      return { event: 'triumph', at: null };
    case 'pickup':
      return { event: e.kind === 'chest' ? 'loot' : 'rum', at: null };
    default:
      return null;
  }
}

export const HELM = { turns: 2.2, rate: 3.5 }; // the wheel hard over (radians), and how fast it follows the helm

export function helmTo(wheel, rudder, dt) {
  const want = (Number.isFinite(rudder) ? Math.max(-1, Math.min(1, rudder)) : 0) * HELM.turns;
  const k = 1 - Math.exp(-HELM.rate * Math.max(0, Math.min(dt, 0.1)));
  return wheel + (want - wheel) * k;
}
