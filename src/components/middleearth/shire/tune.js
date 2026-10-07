// The Shire's values for the ?debug panel (lib/debugPanel): its look (the
// moods' shadow colours, which ./sky.js's atmosphere writes each frame, the
// edge between shade and light, the exposure), its grass, its wind and its
// walking lens, each read and written live.

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const num = (s) => parseInt(s.replace('#', ''), 16);

export function shireTuning({ house, grass, wind, lens, moods }) {
  const u = house.uniforms;
  const g = grass.uniforms;
  const shadow = (mood) => ({ key: `${mood}Shadow`, label: `${mood} shadow`, type: 'colour', get: () => hex(moods[mood].shadow), set: (v) => (moods[mood].shadow = num(v)) });
  return [
    {
      name: 'look',
      items: [
        shadow('day'),
        shadow('dawn'),
        shadow('night'),
        { key: 'edgeFrom', label: 'shade until', type: 'range', min: 0, max: 1, get: () => u.uLookEdge.value.x, set: (v) => (u.uLookEdge.value.x = v) },
        { key: 'edgeTo', label: 'light from', type: 'range', min: 0, max: 1.5, get: () => u.uLookEdge.value.y, set: (v) => (u.uLookEdge.value.y = v) },
        { key: 'mix', label: 'look', type: 'range', min: 0, max: 1, get: () => u.uLookMix.value, set: (v) => (u.uLookMix.value = v) },
        { key: 'exposure', type: 'range', min: 0.6, max: 2.4, get: () => house.exposure, set: (v) => (house.exposure = v) },
        { key: 'bounce', type: 'range', min: 0, max: 1, get: () => u.uLookBounce.value.y, set: (v) => (u.uLookBounce.value.y = v) },
      ],
    },
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
