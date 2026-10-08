// Aboard the Death Star as a world module on the runtime: both battle
// stations walked room by room, at /deathstar/inside. For now it only holds
// the world's place, so the route, the phone gate and every registry work
// before there is a station to draw; the walkable station joins the rules
// and the scene here as they are built.
//
//   KEYS                    the world's controls, by action, as KeyboardEvent codes
//   create(rt, props) → world   a world that draws nothing yet

// filled with the walk, the gun and the rest as the controls arrive
export const KEYS = {};

export default {
  id: 'deathstar-inside',
  shading: 'glsl',
  mb: 6, // (WORLD_MB['/deathstar/inside']: the first room's kit and the cast)
  label: 'Aboard the Death Star',
  async create() {
    return { resize() {}, draw() {}, dispose() {} };
  },
};
