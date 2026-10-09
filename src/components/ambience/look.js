// The look of the home page’s ambient motifs (components/worlds/looks.js): a page scene, its own,
// drawn on lib/three/renderer with its default (no tone mapper) and no
// bloom: its colours are authored as they are to be seen over the page.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: false,
  why: {
    art: 'a page scene: shapes and colours drawn for the page, not a world',
    tone: 'colours authored as final, by the renderer’s default',
  },
};
