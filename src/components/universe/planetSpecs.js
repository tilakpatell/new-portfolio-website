// The fandom planets' shared shape, as data. Each of them used to be built
// by hand from the same few pieces (a material wearing its baked maps, its
// cities on the night side, a cloud layer turning over it, an orbit for its
// model, a shading hook); SPECS says which pieces each one has, and with
// what numbers, and buildFromSpec puts them on. What's a world's own (the
// sitar's strings, the One Ring, the Stones, the shards and tiles, the
// portal, the Game Boy world's pixels, the debris and flyers, the gate) is
// planets.js's EXTRAS[id](p, T, u), called in the middle. The stations and
// the Rick and Morty moons are built by their own builders (stations.js,
// rmWorlds.js), not from here. A world's air isn't here: it stays on u.air
// (universes.js), which is already data. planetSpecs.test.js pins every
// body's build to what the hand builders made.
//
// SPECS[id] = {
//   base?: the maps' name, when it isn't the id ('earth' for travel)
//   maps: ('colour' | 'normal' | 'rough' | 'night' | 'glow' | 'clouds')[], the baked maps it wears
//   material: 'standard' | 'physical' | null (null: EXTRAS makes its own)
//   params?: { roughness (without a roughness map; with one it's 1), metalness, sheen… }
//   normal?: the normal map's scale (1); glow?: the glow map's strength
//   painted?: true when, without its colour map, EXTRAS paints the world and none of these maps are worn
//   cloud: { r, seg: [w, h], small: [w, h], speed, alpha, tint?, on?: 'body', sway?: [rate, reach] } | null
//   orbit: { r, tilt, speed, phase, slot, size?, turn? } | null (slot: what rides it; size and turn make p.slot)
//   hooks: ('cel' | 'dither' | 'cybertron')[]
// }
// buildFromSpec(p, T, u, extras) → p, dressed; p.ownOrbit() → the orbit in the spec, made the first time it's asked for

import * as THREE from 'three';
import { orbit } from './kit';
import { SIDES, cybertronSkin } from '../cybertron/skin';
import { celShade, ditherShade } from './planetShading';

const HALF = Math.PI / 2;

export const SPECS = {
  // (not a planet: the gate and its guard are all EXTRAS)
  starwars: { maps: [], material: null, cloud: null, orbit: null, hooks: [] },
  music: { maps: ['colour'], material: 'standard', cloud: null, orbit: { r: 1.2, tilt: -0.55, speed: 0.2, phase: 0.6, slot: 'sitar', size: 0.78, turn: [0, HALF, 0.35] }, hooks: [] },
  middleearth: {
    maps: ['colour', 'normal', 'rough', 'glow', 'night', 'clouds'],
    material: 'standard',
    glow: 2.2,
    // (on the body, so the pall stays over Mordor; it sways a little, as weather)
    cloud: { r: 1.01, seg: [72, 48], small: [44, 28], speed: 0, alpha: false, on: 'body', sway: [0.021, 0.035] },
    orbit: { r: 1.55, tilt: 0.42, speed: 0.22, phase: 4, slot: 'ring' },
    hooks: [],
  },
  transformers: { maps: ['colour', 'normal'], material: 'standard', params: { roughness: 0.55, metalness: 0.45 }, normal: 1.1, cloud: null, orbit: { r: 1.55, tilt: 0.3, speed: 0.12, phase: 1.2, slot: 'optimus' }, hooks: ['cybertron'] },
  marvel: { maps: ['colour'], material: 'standard', cloud: null, orbit: { r: 1.55, tilt: -0.4, speed: 0.16, phase: 3, slot: 'gauntlet', size: 0.62, turn: [0, HALF, 0] }, hooks: [] },
  breakingbad: {
    maps: ['colour', 'normal', 'rough', 'night', 'clouds'],
    material: 'standard',
    normal: 1.3,
    cloud: { r: 1.008, seg: [64, 40], small: [44, 28], speed: 0.06, alpha: true },
    orbit: { r: 1.5, tilt: 1.0, speed: 0.2, phase: 0.4, slot: 'rv', size: 0.6, turn: [0, HALF, 0] },
    hooks: [],
  },
  // (lit as paper: a sheen in its own colour, so its fibre shows under a grazing light)
  office: { maps: ['colour', 'normal', 'rough'], material: 'physical', params: { sheen: 0.6, sheenColor: '#f3ecd8', sheenRoughness: 0.8 }, cloud: null, orbit: { r: 1.5, tilt: 0.32, speed: 0.28, phase: 5, slot: 'mug' }, hooks: [] },
  rickmorty: {
    maps: ['colour', 'glow', 'rough', 'clouds'],
    material: 'standard',
    // (the seas glossy, so they catch the sun: scripts/planets/rickmorty.mjs)
    params: { roughness: 0.85 },
    glow: 1.3,
    cloud: { r: 1.012, seg: [64, 40], small: [44, 28], speed: 0.05, alpha: false },
    // (its nose, the headlights, is +z: turned along the orbit)
    orbit: { r: 1.55, tilt: 0.36, speed: 0.24, phase: 1, slot: 'saucer', size: 0.58, turn: [0.15, Math.PI, 0] },
    // lit as the show lights it: in flat bands, its limb inked (its clouds too, uninked)
    hooks: ['cel'],
  },
  // (its maps and clouds painted in pixels, in EXTRAS: one random stream runs through them all)
  gaming: { maps: [], material: null, cloud: null, orbit: { r: 1.55, tilt: -0.3, speed: 0.22, phase: 2.6, slot: 'gameboy', size: 0.6, turn: [0, Math.PI, 0.2] }, hooks: ['dither'] },
  caribbean: {
    maps: ['colour', 'normal', 'rough', 'night', 'clouds'],
    material: 'standard',
    normal: 1.2,
    painted: true,
    cloud: { r: 1.01, seg: [64, 40], small: [44, 28], speed: 0.07, alpha: true },
    // (her bow is −x: along the orbit)
    orbit: { r: 1.5, tilt: 0.22, speed: 0.2, phase: 0.7, slot: 'pearl', size: 0.9, turn: [0.1, -HALF, 0] },
    hooks: [],
  },
  invincible: {
    maps: ['colour', 'normal', 'glow', 'rough', 'night', 'clouds'],
    material: 'standard',
    // (the old sea beds glossy: scripts/build-invincible-planet.mjs)
    params: { roughness: 0.92 },
    normal: 1.35,
    glow: 2.4,
    painted: true,
    // (high dust, streaming round it)
    cloud: { r: 1.016, seg: [64, 40], small: [44, 28], speed: 0.065, alpha: true, tint: '#f3d4b4' },
    orbit: null,
    hooks: [],
  },
  // (the oceans catch the sun, the cities light the night side; the clouds the same on a phone)
  travel: { base: 'earth', maps: ['colour', 'rough', 'night', 'clouds'], material: 'standard', params: { roughness: 0.85 }, cloud: { r: 1.012, seg: [64, 40], small: [64, 40], speed: 0.075, alpha: true }, orbit: null, hooks: [] },
};

// The body's material, wearing the maps the spec names (each one missing
// is just left off; without its colour map, the world's own colour)
function surface(spec, T, u, name) {
  const has = (k) => spec.maps.includes(k);
  const { roughness = 1, ...params } = spec.params ?? {};
  const look = {};
  if (has('colour')) Object.assign(look, { map: T[name('colour')] ?? null, color: T[name('colour')] ? '#ffffff' : u.palette.base });
  if (has('normal')) Object.assign(look, { normalMap: T[name('normal')] ?? null, normalScale: new THREE.Vector2(spec.normal ?? 1, spec.normal ?? 1) });
  if (has('rough')) look.roughnessMap = T[name('rough')] ?? null;
  look.roughness = has('rough') && T[name('rough')] ? 1 : roughness;
  if (has('glow')) Object.assign(look, { emissive: '#ffffff', emissiveMap: T[name('glow')] ?? null, emissiveIntensity: T[name('glow')] ? spec.glow : 0 });
  Object.assign(look, params);
  return spec.material === 'physical' ? new THREE.MeshPhysicalMaterial(look) : new THREE.MeshStandardMaterial(look);
}

// A cloud layer over it, turning (or swaying) on its own: an alpha map read
// as white cloud, or a picture with its own alpha
function clouds(p, c, map, T, u, cel) {
  const r = u.size;
  const [w, h] = T.small ? c.small : c.seg;
  const mat = c.alpha
    ? new THREE.MeshStandardMaterial({ color: c.tint ?? '#ffffff', alphaMap: map, transparent: true, depthWrite: false, roughness: 1 })
    : new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1, metalness: 0 });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(r * c.r, w, h), cel ? celShade(mat, { ink: 0 }) : mat);
  (c.on === 'body' ? p.body : p.group).add(sky);
  p.tick.push(c.sway ? (t) => (sky.rotation.y = Math.sin(t * c.sway[0]) * c.sway[1]) : (t) => (sky.rotation.y = t * c.speed));
}

const HOOKS = {
  cel: (p) => celShade(p.body.material),
  // the four greens, dithered, sized by the frame's ratio (p.dpr, which EXTRAS shares with its clouds and blocks;
  // the palette is EXTRAS.gaming's GREENS, in planets.js, in the same order)
  dither: (p, T, u) => ditherShade(p.body.material, { palette: [u.palette.dark, u.palette.glow, u.palette.base, u.palette.light], dpr: (p.dpr ??= { value: 1 }), outline: true }),
  // cybertron/skin.js colours the energon, lights the cities on the night
  // side and carries the plating on in the shader up close
  cybertron: (p, T) => {
    // (EXTRAS.transformers, in planets.js, lights the war on the same two maps)
    if (!(T.transformers && T['transformers-glow-sm'])) return;
    const skin = cybertronSkin(p.body.material, { glow: T['transformers-glow-sm'], sun: p.sun });
    // (its seams glow a little in the colour of the light it's in: the scene's key)
    p.keyColour = skin.uKeyColour.value;
    // the energon breathes, and turns from the Autobots' blue to the
    // Decepticons' violet and back as the war goes one way and the other
    const blue = SIDES.autobot.energon;
    const violet = SIDES.decepticon.energon;
    p.tick.push((t) => {
      skin.uTime.value = t;
      skin.uEnergon.value.copy(blue).lerp(violet, 0.5 + 0.5 * Math.sin(t * 0.05));
    });
  },
};

export function buildFromSpec(p, T, u, extras) {
  const spec = SPECS[u.id];
  const r = u.size;
  const name = (k) => (k === 'colour' ? (spec.base ?? u.id) : `${spec.base ?? u.id}-${k}`);
  // (a world that paints itself without its colour map wears none of the rest)
  const worn = !spec.painted || Boolean(T[name('colour')]);
  if (spec.material && worn) p.body.material = surface(spec, T, u, name);
  if (spec.maps.includes('night') && worn) p.night = T[name('night')] ?? null;
  if (spec.cloud && worn && T[name('clouds')]) clouds(p, spec.cloud, T[name('clouds')], T, u, spec.hooks.includes('cel'));
  let own = null;
  p.ownOrbit = () => {
    if (!own) {
      const o = spec.orbit;
      own = orbit(p.group, { radius: r * o.r, tilt: o.tilt, speed: o.speed, phase: o.phase });
      p.orbits.push(own);
    }
    return own;
  };
  extras?.(p, T, u);
  for (const hook of spec.hooks) HOOKS[hook](p, T, u);
  if (spec.orbit) {
    const o = p.ownOrbit();
    if (spec.orbit.size) p.slot = { holder: o.holder, size: r * spec.orbit.size, turn: [...spec.orbit.turn] };
  }
  return p;
}
