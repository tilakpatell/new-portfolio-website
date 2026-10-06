// A model for every actor type and prop kind, made in code. Actors with
// nothing to see (the iron balls' spawner) get an empty group.

import * as THREE from 'three';
import { CAST } from './cast';
import { PROPS, THINGS } from './things';

export { makeMario } from './mario';

const NONE = () => ({ root: new THREE.Group(), update() {} });

export const makeActor = (a) => (THINGS[a.type] ?? CAST[a.type] ?? NONE)(a);
export const makeProp = (p) => (PROPS[p.kind] ?? NONE)(p);
export const MODELLED = [...Object.keys(THINGS), ...Object.keys(CAST)];
