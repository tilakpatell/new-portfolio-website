// The models made here (scripts/gen3d, public/models/gen3d/) come in three
// cuts, and the one to load follows the device's detail level: a desktop
// with a graphics card gets the 120k-face cut with 4096 maps (.hq), a laptop
// the 60k one, a phone the 20k one with 1024 maps (.lo).

import { device } from '../device';

export const CUTS = { ultra: '.hq', high: '.hq', mid: '', low: '.lo' };

export const gen3dFile = (name, detail) => `${name}${CUTS[detail] ?? ''}.glb`;

export const gen3dUrl = (name, detail = device().detail) => `${import.meta.env?.BASE_URL ?? '/'}models/gen3d/${gen3dFile(name, detail)}`.replace(/\/\/models/, '/models');
