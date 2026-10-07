// The models made here (scripts/gen3d, public/models/gen3d/) come in three
// cuts, and the one to load follows the device's detail level: a desktop
// with a graphics card gets the 120k-face cut with 4096 maps (.hq), a laptop
// the 60k one, a phone the 20k one with 1024 maps (.lo). A model asked for
// at ultra too (scripts/gen3d budget.mjs ULTRA: up to 300k faces, 8192 maps)
// has a fourth, .ultra, which the ultra level loads; ultra loads .hq for the
// rest. ULTRA_CUTS names the models that have one (tested against the files,
// so no request is spent finding out).

import { device } from '../device';

export const CUTS = { ultra: '.ultra', high: '.hq', mid: '', low: '.lo' };

// the made models with an .ultra cut (add a name when its desktop job's pull request lands)
export const ULTRA_CUTS = new Set([]);

export const gen3dFile = (name, detail, ultra = ULTRA_CUTS) => `${name}${detail === 'ultra' && !ultra.has(name) ? CUTS.high : (CUTS[detail] ?? '')}.glb`;

export const gen3dUrl = (name, detail = device().detail) => `${import.meta.env?.BASE_URL ?? '/'}models/gen3d/${gen3dFile(name, detail)}`.replace(/\/\/models/, '/models');
