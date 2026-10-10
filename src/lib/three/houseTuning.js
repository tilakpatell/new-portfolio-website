// The house look's values for the tuning panel (lib/debugPanel), so a world
// on the look (lib/three/house) tunes it in one line: the Shire's first
// round of groups made general. Each is read from the house's uniforms and
// written back live; the shade colour through house.set, the rest straight
// to the uniform the shader reads each frame. A world adds its own groups
// after this one, and swaps any item it keeps its own way (the galaxy
// surface's fog is its sky's, not the house's).
//
//   houseGroups(house, { exposure: { get, set } | null }) → [{ name: 'look', items }]

const hex = (c) => `#${c.getHexString()}`;

export function houseGroups(house, { exposure = null } = {}) {
  const u = house.uniforms;
  const range = (key, label, min, max, get, set) => ({ key, ...(label ? { label } : {}), type: 'range', min, max, get, set });
  const colour = (key, label, value, set) => ({ key, ...(label ? { label } : {}), type: 'colour', get: () => hex(value()), set });
  const items = [
    colour('shadow', null, () => u.uLookShadow.value, (v) => house.set({ shadow: v })),
    range('edgeFrom', 'shade until', 0, 1, () => u.uLookEdge.value.x, (v) => (u.uLookEdge.value.x = v)),
    range('edgeTo', 'light from', 0, 1.5, () => u.uLookEdge.value.y, (v) => (u.uLookEdge.value.y = v)),
    range('mix', 'look', 0, 1, () => u.uLookMix.value, (v) => (u.uLookMix.value = v)),
    range('bounce', null, 0, 1, () => u.uLookBounce.value.y, (v) => (u.uLookBounce.value.y = v)),
    colour('fogLow', 'horizon', () => u.uLookFogLow.value, (v) => house.set({ fogLow: v })),
    colour('fogHigh', 'zenith', () => u.uLookFogHigh.value, (v) => house.set({ fogHigh: v })),
    range('fogBelow', 'haze below', 0, 1.5, () => u.uLookFogBelow.value, (v) => (u.uLookFogBelow.value = v)),
    range('fogMix', 'sky in fog', 0, 1, () => u.uLookFogMix.value, (v) => (u.uLookFogMix.value = v)),
  ];
  if (exposure) items.push(range('exposure', null, 0.4, 3, exposure.get, exposure.set));
  return [{ name: 'look', items }];
}
