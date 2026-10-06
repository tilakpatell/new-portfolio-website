// Every area of the game and the five courses behind the castle's
// paintings. buildArea(id) makes an area's world: the kit's triangles (its
// shapes and the solid parts of its props) as a collision world with its
// water and death plane, freshly each time (moving colliders are added to
// it), from geometry built once.

import { makeWorld } from '../rules/collide';
import bobomb from './bobomb';
import { CASTLE } from './castle';
import { createKit } from './shapes';

export const AREAS = { ...CASTLE, bobomb };

export const COURSES = [
  { id: 'bobomb', name: 'Bob-omb Ridge', area: 'bobomb', need: 0, live: true, stars: ['King Bob-omb on the summit', 'Eight red coins', 'Free the Chain Chomp'] },
  { id: 'snow', name: 'Frosty Peak', area: null, need: 1, live: false, stars: ['Race the big penguin', 'The lost baby penguin', 'Red coins on the ice'] },
  { id: 'beach', name: 'Koopa Cove', area: null, need: 3, live: false, stars: ['Treasure of the sunken ship', 'Race Koopa the Quick', 'Through the coral rings'] },
  { id: 'haunt', name: 'Boo’s Manor', area: null, need: 5, live: false, stars: ['Big Boo’s banquet', 'Red coins in the manor', 'The balcony star'] },
  { id: 'bowser', name: 'Bowser’s Lava Road', area: null, need: 8, live: false, stars: ['Red coins over the lava', 'The Thwomps’ gauntlet', 'Bowser’s arena'] },
];
export const COURSE = Object.fromEntries(COURSES.map((c) => [c.id, c]));

// the units each material's texture repeats over (the scene uses the same)
export const SCALE = { grass: 520, rock: 700, path: 460, cobble: 300, castle: 420, roof: 260, wood: 260, marble: 360, carpet: 300, plaster: 600, stone: 380, 'grass-stone': 380, 'wood-floor': 300, trim: 200, glass: 560, door: 440 };
const scaleOf = (mat) => SCALE[mat] ?? 400;

const built = new Map();
function geometry(id) {
  if (built.has(id)) return built.get(id);
  const area = AREAS[id];
  const k = createKit({ scaleOf });
  area.build(k);
  // what's solid about the props: a trunk, a boulder
  for (const p of area.props ?? []) if (p.solid) k.cyl({ x: p.x, y: (p.y ?? 0) - 40, z: p.z, r: p.solid.r * (p.s ?? 1), h: p.solid.h * (p.s ?? 1), seg: 10, mat: 'none', show: false });
  const out = k.done();
  built.set(id, out);
  return out;
}

export function buildArea(id) {
  const area = AREAS[id];
  if (!area) throw new Error(`no area ${id}`);
  const out = geometry(id);
  const world = makeWorld(out.tris, out.kinds, { water: area.water ?? [], deathY: area.deathY });
  return { area, world, built: out };
}
