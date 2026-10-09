// Dot Matrix’s look (components/worlds/looks.js): its own. The island is
// drawn small into a target and dithered onto the canvas in four Game Boy
// greens (./dither.js): the dither is the art, so there is no tone mapper
// and no bloom to come between the colours and their shade.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: false,
  why: {
    art: 'a Game Boy’s dither in four greens (./dither.js), from a small render target',
    tone: 'the dither picks its shade from the colour as drawn; a tone mapper would move every pixel to another of the four',
  },
};
