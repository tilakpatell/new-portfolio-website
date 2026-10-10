// Mario 64’s look (components/worlds/looks.js): its own, a faithful port.
// The N64’s vertex colours and flat-lit textures (./looks.js has the
// modern, the ultra and the N64 picks), under the runtime’s renderer with
// Neutral set for the port’s own time (module.js, put back on leaving) and
// no bloom.

export const LOOK = {
  art: 'own',
  tone: 'house',
  bloom: false,
  why: {
    art: 'the N64’s own look, ported: vertex colours and flat textures, picked by ./looks.js',
  },
};
