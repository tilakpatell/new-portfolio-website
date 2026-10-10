// The worlds the game lights (scripts/bf2017-light.mjs writes each one's
// JSON): a site names its entry by `gameLight`; a site that names none, or
// one not here, keeps its own sky and light.

import hoth from './hoth.json';

export const LIGHTS = { hoth };

export const gameLightOf = (site) => (site?.gameLight ? (LIGHTS[site.gameLight] ?? null) : null);
