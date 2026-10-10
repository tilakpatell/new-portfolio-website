// The flight's look (components/worlds/looks.js): scanned. Each planet's
// ground is the walkable surfaces' own material (lib/three/groundLook.js:
// the Poly Haven scans of public/cc0/galaxy/ under its palette), its
// landmarks and Coruscant's nearest towers the galaxy's film-made models, on
// the house look; the ship and the rest of the clutter are code-built in
// flat colours from this strip. The house tone (Neutral, through houseOn);
// no bloom, as nothing burns brighter than the snow.

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: false,
};

// the code-built pieces' colours: snow, snow in shade, rock, ice, deep shadow, the sun's gold, the engines' red, the night
export const STRIP = ['#e9f0f7', '#c4d2e2', '#6b7a8c', '#9fb7d1', '#2b3d55', '#ffd37a', '#ff6b4a', '#1a1f2b'];
