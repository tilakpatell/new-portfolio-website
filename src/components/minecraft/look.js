// The Minecraft tribute’s look (components/worlds/looks.js): its own. The
// game’s texture atlas under its own flat light (the sky’s brightness and a
// block light per vertex, ./scene/shaders.js), with no tone mapper (set for
// the tribute’s time, module.js, and put back on leaving) and no bloom, as
// the game has none.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: false,
  why: {
    art: 'the game’s own texture atlas and flat light per vertex, faithful to it',
    tone: 'the game’s light is in its shader; a tone mapper would grey its whites and its torchlight',
  },
};
