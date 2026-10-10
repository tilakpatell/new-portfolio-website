// How a bolt's landing looks on the galaxy surface, by what it struck: the
// game's material grid names the effect (lib/physics/materials.js's
// impactOf), and its family picks the site's own pieces for it (gunfx's
// sparks, smoke and scorch, the scene's kicked-up dust). Snow puffs, metal
// sparks, sand kicks up, rock chips, wood smoulders; a surface the grid
// doesn't know gets the sparks and burn every hit had before.
//
// landingLook(family, { ground }) → { sparks, spark ('bolt' | colour), kick: { n,
//   spread, up } | null, smoke, scorch }
// printOf(family) → { r, k } | null: a footprint's dab in the ground's marks
//   (metres across, how dark), on snow and sand only

const LOOKS = {
  snow: { sparks: 4, spark: 'bolt', kick: { n: 6, spread: 1.4, up: 2.6 }, smoke: 0, scorch: true },
  metal: { sparks: 18, spark: '#ffd9a0', kick: null, smoke: 0, scorch: true },
  sand: { sparks: 3, spark: 'bolt', kick: { n: 7, spread: 1.8, up: 1.6 }, smoke: 0, scorch: true },
  rock: { sparks: 10, spark: '#efe6d6', kick: { n: 2, spread: 0.8, up: 1.4 }, smoke: 1, scorch: true },
  wood: { sparks: 6, spark: '#ffb070', kick: null, smoke: 2, scorch: true },
};

export function landingLook(family, { ground = false } = {}) {
  const l = LOOKS[family];
  // (the old look: a burn on the ground only, more sparks there)
  if (!l) return { sparks: ground ? 12 : 9, spark: 'bolt', kick: null, smoke: 0, scorch: ground };
  return { ...l };
}

const PRINTS = {
  snow: { r: 0.62, k: 0.3 },
  sand: { r: 0.7, k: 0.2 },
};

export const printOf = (family) => (PRINTS[family] ? { ...PRINTS[family] } : null);
