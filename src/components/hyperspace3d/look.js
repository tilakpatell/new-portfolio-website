// The jump to lightspeed’s look (components/worlds/looks.js): its own. A
// field of stars drawn as streaks in a shader, over a deep blue-black, every
// colour written as it should show: no tone mapper and no bloom, so the
// streaks’ white is the screen’s white and the tunnel’s blue is the one
// chosen (./scene.js, ./timeline.js).

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: false,
  why: {
    art: 'stars as streaks in a shader, nothing lit',
    tone: 'colours as final: the streaks’ white and the tunnel’s blue are written as they should show',
  },
};
