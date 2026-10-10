// A Galactic Assault with no player, for the arena test and the balance
// runner: twenty bots a side on a navgrid, stepped until the round has a
// result or the clock runs out. Pure.
//
//   runAssault({ rulebook, nav, seed, bots, minutes, onStep }) → { result, minutes, kills, heroes, events, sim }

import { STEP } from './core.js';
import { createSim, step } from './sim.js';

export function runAssault({ rulebook, nav, seed = 1, bots = 20, minutes = 25, onStep = null }) {
  const sim = createSim({ rulebook, nav, seed, bots: { 1: bots, 2: bots }, mode: 'galacticAssault' });
  const steps = Math.round((minutes * 60) / STEP);
  const heroes = { 1: 0, 2: 0 };
  for (let i = 1; i <= steps && !sim.ga.result; i++) {
    for (const e of step(sim)) if (e.type === 'deploy' && e.kind === 'hero') heroes[sim.entities.get(e.id).team]++;
    onStep?.(sim, i);
  }
  return { result: sim.ga.result, stage: sim.ga.stage, minutes: sim.time / 60, kills: { 1: sim.score[1].kills, 2: sim.score[2].kills }, heroes, events: sim.events, sim };
}
