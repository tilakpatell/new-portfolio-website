// What a 2017 hero's saber takes from the game, for saber.js: its clips by
// the game's names as well as the pack's (a stance from the stroke table
// names the game's), and the hero those clips are, read from the strike's
// own name (the pack keeps each clip's game name in its extras, `source`).
// Pure: clip objects in, names out.
//
//   heroOfClips(clips) → the hero ('luke', 'obiwan', …) its strikes are, or null
//   gameClips(clips)   → the clips under their pack names and their game names both

const STRIKE = /^A_([A-Za-z]+)_AttackLoop_Strike/;
// (the pack's names a strike can be under: walrusClips.js's, the first that's there)
const STRIKES = ['sword.light.a', 'sword.light.b', 'sword.a', 'sword.heavy.a'];

export function heroOfClips(clips) {
  for (const name of STRIKES) {
    const m = STRIKE.exec(clips?.[name]?.userData?.source ?? '');
    if (m) return m[1].toLowerCase();
  }
  return null;
}

export function gameClips(clips) {
  const out = { ...(clips ?? {}) };
  for (const c of Object.values(clips ?? {})) {
    const game = c?.userData?.source;
    if (game && !(game in out)) out[game] = c;
  }
  return out;
}
