// The Expanse as the flight's pure tables are given it, for their tests: the
// thirteen rows expanse/flight/planets.js makes from the generator, written
// once by scripts/flight-expanse-fixture.mjs (planets.test.js holds the two
// equal), and the tables bound to them as the component binds them.
import EXPANSE from './expanse.json';
import { planetSpecOf as specWith, planetsOf } from '../planetSpec.js';
import { lifeFor as lifeWith } from '../lifeTables.js';

export { EXPANSE };
export const PLANETS = planetsOf(EXPANSE);
export const planetSpecOf = (id) => specWith(id, { expanse: EXPANSE });
export const lifeFor = (spec) => lifeWith(spec, { expanse: EXPANSE });
