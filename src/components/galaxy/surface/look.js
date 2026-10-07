// A world's look for the house (lib/three/house: shade as a colour, fog as
// the sky), from its site: what the site says in `look`, and the rest from
// its sky. Pure, so it's tested.
//
//   lookOf(site) → { shadow, edge, mix, fogLow, fogHigh, fogBelow, halo,
//     fogMix, exposure } (the house's LOOK shape, colours as ints)
//   exposureOf(site, base = 1) → the exposure: the site's own (1 unless it
//     says) times `base` (1: the surface's post does its own tone map, the
//     shoulder in universe/post.js, so the house's ACES-to-Neutral lift
//     isn't wanted here)
//   groundPieces(site) → { map, grass, bounce }: which of the ground pieces
//     a world gets (none with no ground under it; grass only where the site
//     grows some)
//   adoptLater(house, object) → how many lit materials of something added
//     after the scene was adopted the house took on (0 for nothing)
//
// A site's `look`: { shadow, edge: [from, to], fogBelow, halo, exposure }
// (colours as '#rrggbb', as the sites write them); left out, the shadow is the sky a third
// of the way from its zenith to its horizon, darkened: a blue sky shades
// blue, a sunset violet.

import * as THREE from 'three';
import { LOOK } from '../../../lib/three/house';

const SHADOW_MIX = 1 / 3;
const SHADOW_DARK = 0.55;

const isColour = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isUnit = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const toInt = (v) => new THREE.Color(v).getHex();

export function lookOf(site) {
  const sky = site?.sky ?? {};
  const zenith = new THREE.Color(sky.zenith ?? '#3f7ccc');
  const horizon = new THREE.Color(sky.horizon ?? '#f6dfb0');
  const shadow = zenith.clone().lerp(horizon, SHADOW_MIX).multiplyScalar(SHADOW_DARK);
  const own = site?.look && typeof site.look === 'object' ? site.look : {};
  return {
    ...LOOK,
    shadow: isColour(own.shadow) ? toInt(own.shadow) : shadow.getHex(),
    edge: Array.isArray(own.edge) && own.edge.length === 2 && own.edge.every(isUnit) ? [own.edge[0], own.edge[1]] : LOOK.edge,
    fogLow: horizon.getHex(),
    fogHigh: zenith.getHex(),
    fogBelow: isUnit(own.fogBelow) ? own.fogBelow : LOOK.fogBelow,
    halo: isColour(own.halo) ? toInt(own.halo) : LOOK.halo,
    exposure: exposureOf(site, LOOK.exposure),
  };
}

export const exposureOf = (site, base = 1) => (isUnit(site?.exposure) && site.exposure > 0 ? site.exposure : 1) * base;

export function groundPieces(site) {
  if (site?.noGround) return { map: false, grass: false, bounce: false };
  return { map: true, grass: Boolean(site?.grass), bounce: true };
}

export const adoptLater = (house, object) => (object ? house.adopt(object) : 0);
