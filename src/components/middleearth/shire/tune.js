// The Shire's values for the ?debug panel (lib/debugPanel): its look (the
// house's group, with the moods' shadow colours, which ./sky.js's
// atmosphere writes each frame), its grass, its wind and its walking lens,
// each read and written live.

import { houseGroups } from '../../../lib/three/houseTuning';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const num = (s) => parseInt(s.replace('#', ''), 16);

export function shireTuning({ house, grass, wind, lens, moods }) {
  const g = grass.uniforms;
  const shadow = (mood) => ({ key: `${mood}Shadow`, label: `${mood} shadow`, type: 'colour', get: () => hex(moods[mood].shadow), set: (v) => (moods[mood].shadow = num(v)) });
  return [
    // the house's look group (lib/three/houseTuning), with the moods' three
    // shadows in place of its one shade and without the sky in the fog:
    // ./sky.js and the Ring write those every frame
    ...houseGroups(house, { exposure: { get: () => house.exposure, set: (v) => (house.exposure = v) } }).map((look) => ({
      ...look,
      items: [shadow('day'), shadow('dawn'), shadow('night'), ...look.items.filter((i) => i.key !== 'shadow' && i.key !== 'fogMix')],
    })),
    {
      name: 'grass',
      items: [
        { key: 'height', type: 'range', min: 0, max: 1.5, get: () => g.uGrassHeight.value, set: (v) => (g.uGrassHeight.value = v) },
        { key: 'width', type: 'range', min: 0.01, max: 0.2, step: 0.005, get: () => g.uGrassWidth.value, set: (v) => (g.uGrassWidth.value = v) },
        { key: 'root', label: 'root light', type: 'range', min: 0, max: 1, get: () => g.uGrassRoot.value, set: (v) => (g.uGrassRoot.value = v) },
      ],
    },
    {
      name: 'wind',
      items: [
        { key: 'strength', type: 'range', min: 0, max: 1, get: () => wind.uniforms.uWindStrength.value, set: (v) => wind.set({ strength: v }) },
        { key: 'angle', type: 'range', min: 0, max: Math.PI * 2, get: () => Math.atan2(wind.uniforms.uWindDir.value.y, wind.uniforms.uWindDir.value.x), set: (v) => wind.set({ angle: v }) },
      ],
    },
    {
      name: 'lens',
      items: [{ key: 'walk', label: 'walking fov', type: 'range', min: 18, max: 60, step: 1, get: () => lens.walk, set: (v) => (lens.walk = v) }],
    },
  ];
}
