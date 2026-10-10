import { describe, expect, it } from 'vitest';
import * as models from './models';
import * as ground from './ground';
import * as fight from './fight';

// The galaxy's face: exactly these names and nothing else, so a world that
// reads the galaxy through it knows what it may lean on
const FACE = [
  [models, ['FIGURES', 'GALAXY_KINDS', 'GROUPS', 'PROPS', 'SURFACE_MODELS', 'buildFigure', 'buildGalaxyShip', 'clusterSpecs', 'createKit', 'createPlacer', 'loadModel', 'lodUrlFor', 'modelUrlFor', 'usesModel', 'wantsLod']],
  [ground, ['SITES', 'makeHeight', 'siteOf']],
  [fight, ['sensesFor', 'startBurst', 'stepBurst', 'strafeStep']],
];

describe('galaxy/shared', () => {
  it.each(FACE.map(([mod, names], i) => [i, mod, names]))('face %i lends exactly its names', (_, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
    for (const n of names) expect(['function', 'object']).toContain(typeof mod[n]);
  });
});
