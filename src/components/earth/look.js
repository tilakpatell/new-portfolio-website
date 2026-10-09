// Earth’s look (components/worlds/looks.js): its own. The globe’s shaders
// (./scene.js: the day and night maps, the atmosphere’s scatter, the
// clouds and the sea’s glint) make the picture as it is to be seen; no tone
// mapper, and no bloom.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: false,
  why: {
    art: 'the globe’s own shaders: the maps, the atmosphere, the clouds, the glint',
    tone: 'the atmosphere’s scatter is written in display colour; a tone mapper would dull the limb and the city lights',
  },
};
