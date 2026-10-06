import { MODELS as core } from './core';
import { MODELS as desert } from './desert';
import { MODELS as edge } from './edge';
import { MODELS as forest } from './forest';
import { MODELS as ice } from './ice';
import { MODELS as outer } from './outer';
import { MODELS as people } from './people';

// Every surface model there is, by kind, with the group it came in with
// (each group's catalogue is brought in by scripts/sketchfab-surface.mjs on
// its own). A world asks for a kind; one that isn't here (yet) it builds in
// code, or goes without.
export const GROUPS = { desert, ice, forest, core, edge, people, outer };
export const SURFACE_MODELS = Object.fromEntries(Object.entries(GROUPS).flatMap(([group, models]) => Object.entries(models).map(([kind, m]) => [kind, { ...m, group }])));
export const surfaceUrl = (kind) => `/models/galaxy/surface/${kind}.glb`;
