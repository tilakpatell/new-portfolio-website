// Albuquerque's people, as the shows dress them: Jesse's hoodie, Skinny
// Pete's beanie, Tuco's shaved head, Mike's tan jacket, Gus's grey suit and
// glasses, Lydia's camel blazer, Saul's loud shirt and tie, Hank's olive
// shirt, Hector's white hair, and Walt and Jesse in hazmat yellow at the
// bench. Each is a figure of their own, made for the site with Meshy AI
// (scripts/meshy-albuquerque.mjs), textured and rigged on the same skeleton
// as the Scranton office's, and posed by office/people.js; a scene keeps its
// own stand-in for anyone whose figure doesn’t load. Walt and Jesse wear
// what the universe’s wardrobe has them in (dressedAs).

import { BODIES, bodyById } from '../rickmorty/wardrobe/looks';

// height: the actor's, metres; file: their figure, in public/models/albuquerque
const PEOPLE = {
  walt: [1.79, 'walt'],
  jesseLab: [1.73, 'jesse-lab'],
  jesse: [1.73, 'jesse'],
  badger: [1.8, 'badger'],
  pete: [1.88, 'pete'],
  tuco: [1.73, 'tuco'],
  mike: [1.8, 'mike'],
  gus: [1.78, 'gus'],
  lydia: [1.7, 'lydia'],
  declan: [1.83, 'declan'],
  saul: [1.78, 'saul'],
  hank: [1.85, 'hank'],
  hector: [1.73, 'hector'],
  nurse: [1.65, 'nurse'],
};

// Who's who, as specs for office/people.js: { id, model, height }.
export const ABQ = Object.fromEntries(Object.entries(PEOPLE).map(([id, [height, file]]) => [id, { id, model: `/models/albuquerque/${file}.glb`, height }]));

// Walt or Jesse (`who`) as the universe’s wardrobe has them (its bodies for
// them are these figures: rickmorty/wardrobe/looks.js): { spec, look }, the
// figure to load for the look’s body and the look to put on it. With `keep`
// (a spec a scene keeps them in whatever the look: the lab’s suits at the
// bench), that figure; the look’s colours only if its body is that figure,
// since they were measured on it, and its gear always.
export function dressedAs(who, look, keep = null) {
  const figureOf = (id) => Object.values(ABQ).find((s) => s.model === bodyById(id)?.asset) ?? null;
  if (!keep) return { spec: figureOf(look.body) ?? ABQ[who], look };
  if (figureOf(look.body) === keep) return { spec: keep, look };
  const body = BODIES[who].find((b) => b.asset === keep.model);
  return { spec: keep, look: body ? { body: body.id, colors: {}, gear: look.gear } : null };
}

// How they take an order, by the mood it left them in.
const REACT = { great: 'cheer', good: 'nod', okay: 'shrug', bad: 'shake', restless: 'fold' };
export const moodGesture = (mood) => REACT[mood] ?? null;
