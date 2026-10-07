// The three worlds' lane (docs/superpowers/specs/2026-10-07-three-worlds-design.md):
// Cloud City's towers and its plaza, Dex's diner, the Outlander club and 500
// Republica, made by scripts/meshy-galaxy-buildings.mjs like its own and in
// its format (that script's header has the fields), each lifted out of a
// real picture of the place. Kept in a file of their own so no earlier
// lane's lines are touched; their tasks go in
// scripts/meshy-galaxy-three-tasks.json (MESHY_TASKS).
//
//   MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs <step> <kind …>
export const BUILDINGS = {
  // Bespin: one of Cloud City's white towers (the game's shot of its
  // streets: the round-topped tower at the left), scattered round the deck
  cloudtower: {
    ref: 'File:Cloud City Streets SWB.png',
    crop: [0.52, 0.0, 0.26, 0.5],
    lift: 'the tall round cream-white tower (a cylinder with tall vertical bands of windows round its upper half, plain ribbed walls below, a flared ribbed base with small doorways)',
    metres: 60,
    along: 'h',
    tris: 12000,
    tex: 1024,
  },
  // Bespin: another, the domed block at the right of the same shot
  cloudtower2: {
    ref: 'File:Cloud City Streets SWB.png',
    crop: [0.27, 0.4, 0.27, 0.42],
    lift: 'the ribbed cream-white domed building (a broad low dome of ribbed panels on a short round base, a slim spire on top, square doorways at its base)',
    metres: 40,
    along: 'h',
    tris: 12000,
    tex: 1024,
  },
  // Bespin: the plaza's façade (the same shot: the white walls and the
  // walkways round the court in the middle)
  cloudplaza: {
    ref: 'File:Cloud City Streets SWB.png',
    crop: [0.46, 0.14, 0.46, 0.44],
    lift: 'the curved cream-white terraces (low curved walls and walkways in two tiers round a sunken court, wide steps down between them, low railings)',
    metres: 48,
    along: 'w',
    tris: 20000,
    tex: 2048,
    hero: true,
  },
  // Coruscant: Dex's diner (the film's shot of its front; the built one's
  // floor and door stay: solids 'built')
  dexdiner: {
    ref: 'File:Dexs Diner.jpg',
    crop: [0.08, 0.1, 0.8, 0.72],
    lift: 'the small chrome diner (a low rounded building of brushed steel panels with a long band of windows, a curved roof with round vents, red-brown trim and a round sign over the door)',
    metres: 22,
    along: 'w',
    tris: 20000,
    tex: 2048,
  },
  // Coruscant: the Outlander club's front (the film's shot of its neon sign
  // and door; its floor and door stay built)
  club: {
    ref: 'File:Outlander Club.png',
    crop: [0.0, 0.0, 1.0, 1.0],
    lift: 'the night club entrance (a dark metal façade with a wide curved neon sign in alien lettering over the doorway, red and white strip lights, blue lit panels at the side)',
    metres: 24,
    along: 'w',
    tris: 20000,
    tex: 2048,
  },
  // Coruscant: 500 Republica, the tower (the film's shot of it at dusk)
  republica: {
    ref: 'File:500Republica.png',
    crop: [0.1, 0.0, 0.75, 1.0],
    lift: 'the tall dark skyscraper (a slim stepped tower of dark bronze-brown metal, narrowing to a spire, every face lit with tiny windows)',
    metres: 330,
    along: 'h',
    tris: 20000,
    tex: 1024,
  },
};
