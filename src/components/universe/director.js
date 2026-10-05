// The director: now and then, while you fly, something happens. Pure (no
// three.js), so it's tested in Node; the scene plays each one out.
//
// What can happen depends on whose universe you fly in:
// - hunt: a pack of hunters comes after you (the Empire for Luke and Han,
//   the Galactic Federation for Rick)
// - destroyer (Star Wars): a Star Destroyer drops out of hyperspace nearby
//   and launches its TIE fighters at you
// - council (Rick and Morty): portals open round you and the Council of
//   Ricks comes through, in their own cruisers, for their Rick
// - distress: someone ordinary under attack (a Rebel transport and TIEs, a
//   family saucer and Gromflomites), yours to save or not
// - convoy: a line of freighters under escort goes by
// - comet: a comet crosses the sky
// Nothing happens in the first while, or while something else is going on;
// then one comes along every minute or two, sooner the more trouble you've
// been making (heat: what you've shot down lately), and never the same
// thing twice running.
//
// createDirector({ rand }) → { update(dt, { family, heat, busy }) → event id or null, soon(id) }

export const EVENTS = {
  hunt: { families: ['starwars', 'rickmorty'], weight: 3, heat: 1 },
  destroyer: { families: ['starwars'], weight: 1.3, heat: 0.6 },
  council: { families: ['rickmorty'], weight: 1.5, heat: 0.6 },
  distress: { families: ['starwars', 'rickmorty'], weight: 1.2, heat: 0 },
  convoy: { families: ['starwars', 'rickmorty'], weight: 1.3, heat: 0 },
  comet: { families: ['starwars', 'rickmorty'], weight: 0.9, heat: 0 },
};
export const PACE = { first: [35, 55], gap: [55, 105] }; // seconds before the first, and between the rest

export function createDirector({ rand = Math.random } = {}) {
  const between = ([a, b]) => a + rand() * (b - a);
  let clock = 0;
  let nextAt = between(PACE.first);
  let last = null;
  let forced = null;
  return {
    // family: 'starwars', 'rickmorty' or null (no ship: nothing happens);
    // heat: 0 and up; busy: something's already going on (hunters after
    // you, a crash playing out), so not now
    update(dt, { family, heat = 0, busy = false }) {
      if (!family) return null;
      clock += dt;
      if (busy) {
        nextAt = Math.max(nextAt, clock + 12); // and a breather after it
        return null;
      }
      if (forced && EVENTS[forced]?.families.includes(family)) {
        const id = forced;
        forced = null;
        last = id;
        nextAt = clock + between(PACE.gap);
        return id;
      }
      if (clock < nextAt) return null;
      const choices = Object.entries(EVENTS).filter(([id, e]) => e.families.includes(family) && id !== last);
      const weight = (e) => e.weight * (1 + e.heat * Math.min(heat, 6) * 0.5);
      let r = rand() * choices.reduce((s, [, e]) => s + weight(e), 0);
      let id = choices[choices.length - 1][0];
      for (const [k, e] of choices) {
        if ((r -= weight(e)) <= 0) {
          id = k;
          break;
        }
      }
      last = id;
      nextAt = clock + between(PACE.gap) / (1 + Math.min(heat, 6) * 0.25);
      return id;
    },
    // bring an event on next (for checking from a browser)
    soon(id) {
      forced = id;
    },
  };
}
