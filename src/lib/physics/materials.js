// What a surface is made of, from the 2017 game's material grid (lane P4's
// rulebook, src/data/bf2017/physics/materials.json, one book per level):
// what a bolt, a grenade or a foot does when it meets a collider whose `tag`
// is a material index (lane P0 writes the Havok shape's index as the tag; a
// walker world's solids carry the site's hand stand-in). Pure: no three.js.
//
// materialOf(book, tag) → { index, name, … } (an unknown tag: the default's)
// impactOf(book, { tag, speed, by = 'blaster' }) → { effect, family, sound, decal, exitDecal }
//   the pair of the surface with the striker; else the default surface's
//   pair with it; else the site's generic puff (effect 'generic'). Never undefined.
// footprintOf(book, tag, by = 'foot') → { effect, family } | null
// frictionOf(book, tag) → { friction, restitution }
// familyOf(effect) → 'snow' | 'metal' | 'sand' | 'rock' | 'wood' | 'generic'
// tagOf(materials, hit) → a material index for a hit on a walker world:
//   the solid's own numeric tag (lane P0's), else the site's `materials`
//   ({ ground, box, circle }) by what was hit
// loadMaterials(level) → Promise<book | null> (the rulebook, fetched with the code that wants it)

// the engine's own (world.js's defaults), where the grid says nothing
export const ENGINE = { friction: 0.2, restitution: 0.15 };
export const GENERIC = 'generic';

const indexOf = (book, tag) => {
  const i = typeof tag === 'number' ? tag : Number.parseInt(tag, 10);
  return Number.isFinite(i) && book?.materials?.[i] ? i : (book?.default ?? 0);
};

export function materialOf(book, tag) {
  const index = indexOf(book, tag);
  return { index, ...(book?.materials?.[index] ?? { name: GENERIC }) };
}

// The game's effect name → the site's look for it (hand: NOTES.md). Rock
// under snow is rock (its blaster puff is FX_Impact_Blaster_RockSnow); a
// pine floor is wood; mud, gravel and sand kick up the same.
const FAMILIES = [
  ['rock', /rock|stone|concrete|cliff/i],
  ['snow', /snow|ice|frost/i],
  ['metal', /metal|pipe|vehicle|invulnerable|shield/i],
  ['sand', /sand|mud|gravel|dirt|dust/i],
  ['wood', /wood|pine|ffloor|forest|bark/i],
];
export function familyOf(effect) {
  if (!effect) return GENERIC;
  for (const [f, re] of FAMILIES) if (re.test(effect)) return f;
  return GENERIC;
}

// the band that holds `speed` (else the nearest; no speed: the first)
function band(effects, speed) {
  if (!effects?.length) return null;
  if (speed == null) return effects[0];
  let best = effects[0];
  let off = Infinity;
  for (const e of effects) {
    if (speed >= e.min && speed <= e.max) return e;
    const d = Math.min(Math.abs(speed - e.min), Math.abs(speed - e.max));
    if (d < off) {
      off = d;
      best = e;
    }
  }
  return best;
}

const strikerOf = (book, by) => (typeof by === 'number' ? by : (book?.by?.[by] ?? null));

export function impactOf(book, { tag = null, speed = null, by = 'blaster' } = {}) {
  const j = strikerOf(book, by);
  const i = indexOf(book, tag);
  const pairs = book?.pairs ?? {};
  for (const surface of [i, book?.default ?? 0]) {
    const p = j == null ? null : pairs[`${surface},${j}`];
    const e = band(p?.effects, speed);
    if (!p || (!e && !p.decal)) continue;
    // (a pair with a scorch and no puff: the surface's family from its scorch)
    const effect = e?.effect ?? GENERIC;
    return { effect, family: familyOf(e ? effect : p.decal), sound: p.sound ?? null, decal: p.decal ?? null, exitDecal: p.exitDecal ?? null };
  }
  return { effect: GENERIC, family: familyOf(book?.materials?.[i]?.name), sound: null, decal: null, exitDecal: null };
}

export function footprintOf(book, tag, by = 'foot') {
  const j = strikerOf(book, by);
  const p = j == null ? null : book?.pairs?.[`${indexOf(book, tag)},${j}`];
  if (!p?.footprint) return null;
  return { effect: p.footprint, family: familyOf(p.footprint) };
}

// A zero friction is "the engine's" (Hoth's grid gives 0 with a modifier of
// 1 where it means no change), scaled by the material's modifier.
export function frictionOf(book, tag) {
  const ph = book?.materials?.[indexOf(book, tag)]?.physics;
  if (!ph) return { ...ENGINE };
  const base = ph.dynamicFriction > 0 ? ph.dynamicFriction : ENGINE.friction;
  return { friction: base * (ph.dynamicFrictionModifier ?? 1), restitution: ph.restitution > 0 ? ph.restitution : ENGINE.restitution };
}

export function tagOf(materials, hit) {
  if (typeof hit?.tag === 'number') return hit.tag;
  if (!materials) return null;
  if (hit?.ground) return materials.ground ?? null;
  if (hit?.solid?.type === 'circle') return materials.circle ?? materials.solid ?? null;
  if (hit?.solid) return materials.box ?? materials.solid ?? null;
  return materials.ground ?? null;
}

let books = null;
export async function loadMaterials(level) {
  if (!level) return null;
  books ??= import('../../data/bf2017/physics/materials.json').then((m) => m.default ?? m);
  return (await books)[level] ?? null;
}
