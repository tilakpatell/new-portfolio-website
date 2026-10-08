// A small world for the ground's tests: flat land round the pad, the sea
// past x = −350 (water at −2), and the edge of the walkable world at 600 m.
export const SITE = {
  id: 'fixture',
  land: { at: [0, 0], yaw: 0 },
  places: [],
  ground: { seed: 7, layers: [] },
  water: { level: -2 },
  reach: 600,
};
export const heightOf = (x) => (x < -350 ? -5 : 0);
export const kit = { standable: ([x, z]) => heightOf(x, z) >= -1.8, height: heightOf, rand: () => 0.5 };
export const E = { owner: 'empire', control: 0.7, front: false, attack: false, war: 'gcw', side: null };
