// Which side you fight for down on the galaxy's worlds: the light (the
// Republic, and after it the Rebellion) or the dark (the Separatists, and
// after them the Empire). Kept in the browser across worlds. A battle on a
// world (surface/skirmish.js, a galactic assault) puts you on its era's
// side of yours: with the dark side on Kashyyyk you come out of the lagoon
// with the droids; on Hoth you march with the snowtroopers. Picked on the
// holotable (HoloMap.jsx), by the side you take in a galactic assault, or
// switched in a battle (SkirmishHud.jsx). Pure, so it's tested in Node.
//
//   ALLEGIANCE_KEY                  the localStorage key
//   ALLEGIANCES                     { light, dark }: { id, name, short }
//   readAllegiance(raw)             'light' | 'dark' (light for anything else)
//   otherAllegiance(a)              the other one
//   sideFor(sides, allegiance)      the id of the side in `sides` ({ id: { allegiance } })
//                                   that's yours, else the first's
//   allegianceOf(side)              a side's ('light' unless it says)

export const ALLEGIANCE_KEY = 'tp-galaxy-allegiance';

export const ALLEGIANCES = {
  light: { id: 'light', name: 'The Republic and the Rebellion', short: 'Republic & Rebellion' },
  dark: { id: 'dark', name: 'The Separatists and the Empire', short: 'Separatists & Empire' },
};

export const readAllegiance = (raw) => (raw === 'dark' ? 'dark' : 'light');
export const otherAllegiance = (a) => (readAllegiance(a) === 'dark' ? 'light' : 'dark');
export const allegianceOf = (side) => (side?.allegiance === 'dark' ? 'dark' : 'light');

export function sideFor(sides, allegiance) {
  const ids = Object.keys(sides ?? {});
  const want = readAllegiance(allegiance);
  return ids.find((id) => allegianceOf(sides[id]) === want) ?? ids[0] ?? null;
}
