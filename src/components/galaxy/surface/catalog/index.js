import { budget } from '../../../../lib/budgets';
import { MODELS as audit } from './audit';
import { MODELS as battlefront } from './battlefront';
import { MODELS as common } from './common';
import { MODELS as clonewars } from './clonewars';
import { MODELS as core } from './core';
import { MODELS as desert } from './desert';
import { MODELS as edge } from './edge';
import { MODELS as fill } from './fill';
import { MODELS as forest } from './forest';
import { MODELS as ice } from './ice';
import { MODELS as library } from './library';
import { MODELS as made } from './made';
import { MODELS as outer } from './outer';
import { MODELS as people } from './people';
import { MODELS as quaternius } from './quaternius';
import { MODELS as rebels } from './rebels';
import { MODELS as three } from './three';

// Every surface model there is, by kind, with the group it came in with
// (each group's catalogue is brought in by scripts/sketchfab-surface.mjs on
// its own). A world asks for a kind; one that isn't here (yet) it builds in
// code, or goes without.
// (battlefront last: a kind there takes over from the same kind's Sketchfab model)
export const GROUPS = { common, desert, ice, forest, core, clonewars, edge, people, outer, rebels, three, quaternius, made, fill, library, audit, battlefront };
export const SURFACE_MODELS = Object.fromEntries(Object.entries(GROUPS).flatMap(([group, models]) => Object.entries(models).map(([kind, m]) => [kind, { ...m, group }])));
export const surfaceUrl = (kind) => `/models/galaxy/surface/${kind}.glb`;
export const surfaceLodUrl = (kind) => `/models/galaxy/surface/${kind}.lod1.glb`;
// A kind's ultra cut (its entry's optional `ultra: { tris, tex }`; the entry's
// own `tris` stays the high cut): loaded at ultra, the plain file otherwise.
export const surfaceUltraUrl = (kind) => `/models/galaxy/surface/${kind}.ultra.glb`;
export const modelUrlFor = (kind, level, models = SURFACE_MODELS) => (level === 'ultra' && models[kind]?.ultra ? surfaceUltraUrl(kind) : surfaceUrl(kind));
// Whether a kind swaps to its light model far off: it has one (`lod`), and
// the level's budget swaps (lib/budgets' lod1; ultra keeps the full model at
// every distance).
export const wantsLod = (kind, level, models = SURFACE_MODELS) => Boolean(models[kind]?.lod) && budget(level).lod1;
// the made kinds public/cc0/README.md lists (its
// `models/galaxy/surface/{a,b,…}.glb` lines, one a lane): each made model
// has to be there
export function madeKinds(readme) {
  const lists = [...readme.matchAll(/models\/galaxy\/surface\/\{([^}]*)\}\.glb/g)].map((m) => m[1]);
  return new Set(lists.flatMap((list) => list.split(',').map((k) => k.trim())).filter(Boolean));
}
