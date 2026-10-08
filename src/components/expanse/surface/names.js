// A planet of the Expanse's name, from its seed and its type: "Temperate
// planet 7". The page's title and heading, and its row in the visitor's worlds.
export const planetName = (seed, type = 'temperate') => `${type[0].toUpperCase()}${type.slice(1)} planet ${seed}`;
