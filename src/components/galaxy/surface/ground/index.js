// The ground war (docs/superpowers/specs/2026-10-08-ground-factions-design.md):
// the rules, each pure and tested, and the one three.js piece scene.js makes.
export { NATIVES, SIDE_OF_KIND, relation, sideOfKind, standingOf } from './standing';
export { covertFor, landingFor } from './landing';
export { bendBeat, farTurf, frontBetween, holderSide, padTurf, strengthOf, turfAt, turfsOf } from './turf';
export { KINDS_OF_SIDE, TROOPS, damageOf, hpOf, hurt, newSoldier } from './troops';
export { CELL, DENSITY, POP, RADIUS, createPopulation, rosterFor } from './population';
export { FACING, GRUDGE, aimError, fightStep, grudge, senseAll, squadsOf, suppress, threatOf } from './fight';
export { BRAINS, YOURS, createGround } from './groundScene';
