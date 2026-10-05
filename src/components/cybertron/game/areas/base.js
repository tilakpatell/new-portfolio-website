// Team Prime's base, Transformers: Prime's Omega One: an old missile silo
// under a mesa outside Jasper, Nevada, big enough for robots. Teletraan-1's
// screens fill the north wall with the console under them; Ratchet's bay is
// in the corner; the ground bridge tunnel opens in the east wall (out to the
// desert) and the space bridge console stands on the west side (back to
// Iacon, the way Optimus remembers it).

export const BASE = {
  id: 'base',
  name: 'Autobot base, Jasper',
  era: 'tfp',
  player: { robot: 'optimus-tfp', vehicle: 'truck-tfp' },
  bounds: { minX: -70, maxX: 70, minZ: -45, maxZ: 45 },
  ceiling: 48,
  spawn: { x: 0, z: 18, yaw: Math.PI },
  spawns: {
    start: { x: 0, z: 18, yaw: Math.PI },
    bridge: { x: -38, z: 6, yaw: Math.PI / 2 },
    tunnel: { x: 40, z: 0, yaw: -Math.PI / 2 },
  },
  solids: [
    // Teletraan-1's console, under its screens
    { kind: 'box', x: 0, z: -38, hw: 20, hd: 4, top: 6, tag: 'console' },
    // Ratchet's bay: the berth and his bench
    { kind: 'box', x: 52, z: -32, hw: 8, hd: 3.5, top: 3, tag: 'berth' },
    { kind: 'box', x: 60, z: -18, hw: 3, hd: 7, top: 4.5, tag: 'bench' },
    // the stairs up to the catwalk round the west end
    { kind: 'box', x: -52, z: -30, hw: 10, hd: 6, top: 1.2, tag: 'step' },
    { kind: 'box', x: -60, z: -30, hw: 6, hd: 8, top: 2.4, tag: 'step' },
    // crates of supplies, and Bulkhead's dents in the wall
    { kind: 'box', x: -24, z: 34, hw: 3, hd: 3, top: 6, yaw: 0.2, tag: 'crate' },
    { kind: 'box', x: -16, z: 38, hw: 2.5, hd: 2.5, top: 5, yaw: -0.3, tag: 'crate' },
    { kind: 'box', x: 26, z: 36, hw: 3, hd: 3, top: 6, yaw: 0.5, tag: 'crate' },
    // the pillars holding the roof
    { kind: 'circle', x: -30, z: -10, r: 2.2, tag: 'pillar' },
    { kind: 'circle', x: 30, z: -10, r: 2.2, tag: 'pillar' },
    { kind: 'circle', x: -30, z: 24, r: 2.2, tag: 'pillar' },
    { kind: 'circle', x: 30, z: 24, r: 2.2, tag: 'pillar' },
  ],
  people: [
    {
      id: 'ratchet',
      kind: 'ratchet',
      name: 'Ratchet',
      x: 12,
      z: -28,
      yaw: Math.PI * 0.9,
      lines: ["Optimus. Teletraan-1 has picked up an energon signature in the canyons east of Jasper. Decepticon mining, if I'm not mistaken.", "The ground bridge is warmed up. Try to bring it back in one piece. The bridge, I mean."],
    },
    {
      id: 'bulkhead',
      kind: 'bulkhead',
      name: 'Bulkhead',
      x: -36,
      z: 22,
      yaw: 0.8,
      lines: ['Wrecker rules: hit it till it stops. Works on Vehicons too.', "Miko wanted to come along. I said no. She'll find a way anyway."],
    },
    {
      id: 'arcee',
      kind: 'arcee',
      name: 'Arcee',
      x: -44,
      z: -8,
      yaw: 1.2,
      lines: ["Teletraan-1 decoded another Iacon entry. A relic, buried out in the desert where the Ark's pods came down.", "If Soundwave finds it first, it's Megatron's. Let's not let that happen."],
    },
    {
      id: 'bee',
      kind: 'bumblebee-tfp',
      name: 'Bumblebee',
      x: 34,
      z: 28,
      yaw: -2.4,
      lines: ['(A run of beeps and whirs: he says the kids are at school, and he misses the drive.)', '(Beeps: he bets you can’t beat his time to the canyon.)'],
    },
  ],
  pickups: [],
  exits: [
    { id: 'ground-bridge', x: 62, z: 0, r: 9, to: 'jasper', at: 'bridge', label: 'Ground bridge to the desert' },
    { id: 'space-bridge', x: -60, z: 6, r: 8, to: 'iacon', at: 'bridge', label: 'Space bridge to Iacon (the war, as Optimus remembers it)' },
  ],
  missions: [
    {
      id: 'report',
      title: 'Report to Ratchet',
      giver: 'ratchet',
      achievement: 'cyTeamPrime',
      steps: [
        { type: 'talk', target: 'ratchet', text: 'Talk to Ratchet at the console' },
        { type: 'talk', target: 'bulkhead', text: 'Check in with Bulkhead' },
        { type: 'talk', target: 'arcee', text: 'Check in with Arcee' },
        { type: 'talk', target: 'bee', text: 'Check in with Bumblebee' },
        { type: 'talk', target: 'ratchet', text: 'Back to Ratchet' },
      ],
    },
    {
      id: 'mine',
      title: 'The energon mine',
      giver: 'ratchet',
      area: 'jasper',
      requires: ['report'],
      achievement: 'cyEnergonMine',
      steps: [
        { type: 'talk', target: 'ratchet', area: 'base', text: 'Talk to Ratchet' },
        { type: 'exit', to: 'jasper', area: 'base', text: 'Through the ground bridge to the desert' },
        { type: 'reach', at: { x: 300, z: -250, r: 60 }, text: 'Find the Decepticon mine in the canyons' },
        { type: 'clear', count: 4, spawn: [0, 1, 2, 3].map((i) => ({ kind: 'vehicon', x: 290 + i * 14, z: -310 - (i % 2) * 12 })), text: 'Clear the Vehicons out' },
        { type: 'clear', count: 4, spawn: [0, 1, 2, 3].map((i) => ({ kind: 'vehicon', x: 360 - i * 10, z: -260 + i * 10 })), text: 'More Vehicons, from the mine' },
        { type: 'collect', kind: 'crystal', count: 5, text: 'Take the energon: five crystals' },
        { type: 'exit', to: 'base', text: 'Back through the ground bridge' },
        { type: 'talk', target: 'ratchet', area: 'base', text: 'Bring Ratchet the energon' },
      ],
    },
    {
      id: 'relic',
      title: 'An Iacon relic',
      giver: 'arcee',
      area: 'jasper',
      requires: ['mine'],
      achievement: 'cyRelic',
      steps: [
        { type: 'talk', target: 'arcee', area: 'base', text: 'Talk to Arcee' },
        { type: 'exit', to: 'jasper', area: 'base', text: 'Through the ground bridge' },
        { type: 'reach', at: { x: -180, z: 330, r: 30 }, text: 'Find where the pod came down, north of the road' },
        { type: 'collect', kind: 'relic', count: 1, text: 'Dig out the relic' },
        { type: 'exit', to: 'base', text: 'Back to base' },
        { type: 'talk', target: 'arcee', area: 'base', text: 'Give Arcee the relic' },
      ],
    },
  ],
  look: {
    sky: 'base',
    fog: ['#0d1614', 80, 260],
    sun: { dir: [0.2, 1, 0.3], color: '#d8f0e8', intensity: 0.9 },
    ambient: ['#5a7a74', 0.7],
    exposure: 1.0,
    bloom: 0.7,
  },
  stage: {
    screens: { x: 0, z: -44, w: 56, h: 22, y: 9 },
    tunnel: { x: 70, z: 0, w: 22, h: 26 },
    bridgeConsole: { x: -60, z: 6 },
    catwalk: { y: 18, depth: 8 },
  },
};
