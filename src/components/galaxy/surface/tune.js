// A galaxy world's values for the ?debug panel (lib/debugPanel), the
// Shire's tune.js for the surfaces: its look (the house's shade colour and
// the edge between shade and light, the bounce off the ground; the fog's
// halo and the haze below the horizon, skyfog.js; the exposure through the
// post: the house's part from lib/three/houseTuning), its grass and its
// wind, each read and written live. The copy button prints them as the site's own blocks (`look`, `exposure`, `grass`), to
// paste into its file in sites/.
//
//   surfaceTuning({ house, skyFog, post, exposure, grass, wind }) → groups
//   siteCode(values) → the site's blocks, as code (pure)

import { houseGroups } from '../../../lib/three/houseTuning';

const hex = (c) => `#${c.getHexString()}`;
const round = (v) => Number(Number(v).toFixed(3));

export function surfaceTuning({ house, skyFog, post, exposure = 1, grass = null, wind }) {
  const f = skyFog.uniforms;
  let k = exposure;
  // the house's own look (lib/three/houseTuning), less its fog: a surface's
  // fog is its sky's (skyfog.js), so the halo and the haze below are that's
  const [look] = houseGroups(house, {
    exposure: {
      get: () => k,
      set: (v) => {
        k = v;
        post.exposure(v);
      },
    },
  });
  const own = (key) => look.items.find((it) => it.key === key);
  const groups = [
    {
      name: 'look',
      items: [
        ...['shadow', 'edgeFrom', 'edgeTo', 'mix', 'bounce'].map(own),
        { key: 'halo', type: 'colour', get: () => hex(f.uSfHalo.value), set: (v) => skyFog.look({ halo: v }) },
        { key: 'fogBelow', label: 'haze below', type: 'range', min: 0, max: 1.5, get: () => f.uSfBelowK.value, set: (v) => skyFog.look({ below: v }) },
        own('exposure'),
      ],
    },
  ];
  if (grass) {
    const g = grass.uniforms;
    groups.push({
      name: 'grass',
      items: [
        { key: 'height', type: 'range', min: 0, max: 1.5, get: () => g.uGrassHeight.value, set: (v) => (g.uGrassHeight.value = v) },
        { key: 'width', type: 'range', min: 0.01, max: 0.2, step: 0.005, get: () => g.uGrassWidth.value, set: (v) => (g.uGrassWidth.value = v) },
        { key: 'root', label: 'root light', type: 'range', min: 0, max: 1, get: () => g.uGrassRoot.value, set: (v) => (g.uGrassRoot.value = v) },
      ],
    });
  }
  groups.push({
    name: 'wind',
    items: [
      { key: 'strength', type: 'range', min: 0, max: 1, get: () => wind.uniforms.uWindStrength.value, set: (v) => wind.set({ strength: v }) },
      { key: 'angle', type: 'range', min: 0, max: Math.PI * 2, get: () => (Math.atan2(wind.uniforms.uWindDir.value.y, wind.uniforms.uWindDir.value.x) + Math.PI * 2) % (Math.PI * 2), set: (v) => wind.set({ angle: v }) },
    ],
  });
  return groups;
}

// the panel's values ([{ name, items: [{ key, type, value }] }]) as the
// site's blocks: `look: { shadow, edge, fogBelow, halo }, exposure, grass: {
// h, w, wind }` (the lib's blades run from 0.45 of the height up to it; the
// wind's way is the ground's, `ground.wind`, noted above them)
export function siteCode(values) {
  const v = Object.fromEntries(values.map((g) => [g.name, Object.fromEntries(g.items.map((it) => [it.key, it.value]))]));
  const look = v.look ?? {};
  const lines = [`look: { shadow: '${look.shadow}', edge: [${round(look.edgeFrom)}, ${round(look.edgeTo)}], fogBelow: ${round(look.fogBelow)}, halo: '${look.halo}' },`, `exposure: ${round(look.exposure)},`];
  if (v.grass) lines.push(`grass: { h: [${round(v.grass.height * 0.45)}, ${round(v.grass.height)}], w: ${round(v.grass.width)}, wind: ${round(v.wind?.strength ?? 0.4)} },`);
  if (v.wind) lines.unshift(`// ground.wind: ${round(v.wind.angle)}`);
  return lines.join('\n');
}
