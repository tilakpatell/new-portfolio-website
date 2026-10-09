// The cartridges’ look (components/worlds/looks.js): their own. Game
// cartridges on a shelf, lit by a room’s environment map (three’s
// RoomEnvironment), Neutral set on their own renderer (./scene.js): there
// are no lights for houseOn to adopt, and the labels’ whites need the
// shoulder. No bloom.

export const LOOK = {
  art: 'own',
  tone: 'house',
  bloom: false,
  why: {
    art: 'plastic cartridges with printed labels, lit by an environment map alone',
  },
};
