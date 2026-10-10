// The 2017 game's own clips, under the names the site asks for. The game's
// people move with the game's clips (one glTF a clip on Walrus_HumanMale,
// web/anims/walrus_humanmale/ in the bf2017-assets bucket), never a UAL or
// Meshy clip baked onto a 2017 figure: the owner's rule. The clip packs
// (scripts/bf2017-clips.mjs) are written from this map, and the loader
// (walrus.js) plays them by these names, so combatRules.js, react.js and
// activity.js ask for `sword.block` or `die.fwd` and get the game's. Pure,
// no three: lane X's stroke tables read the same map.
// (docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 4)
//
//   PACKS: { core, sword, life } the site names each pack holds, as the
//     UAL sets named them (scripts/ual-bake.mjs's SETS), so every caller's
//     name is in one
//   GAME_CLIPS: { siteName: gameClipName } which of the game's clips each
//     site name is. Filled from the bucket's own list
//     (node scripts/bf2017-clips.mjs --list), never guessed: a site name
//     with no entry is simply not in the pack, and the loader falls back
//     (walrusRig.js's CLIP_FALLBACK) or cuts the play
//   keyOf(gameName) → the bucket's object name: a `~<8 hex>` duplicate tag
//     is `-<8 hex>` there (Supabase refuses `~`; 164 were renamed)
//   clipPath(gameName, skeleton) → the clip's path under web/
//   packOf(siteName) → 'core' | 'sword' | 'life' | null
//   planPacks(map, has) → { core: [{ site, game, path }], sword, life,
//     missing: [siteName], absent: [gameName] }: what each pack is made
//     of, which site names have no game clip yet, and which mapped game
//     clips the bucket's list lacks (`has(path)`)

export const SKELETON = 'walrus_humanmale';

export const PACKS = {
  core: ['idle', 'walk', 'run', 'talk', 'hit.chest', 'die', 'sit.idle'],
  sword: [
    'sword.a', 'sword.a.rec', 'sword.b', 'sword.b.rec', 'sword.c', 'sword.combo',
    'sword.light.a', 'sword.light.a.rec', 'sword.light.b', 'sword.light.b.rec', 'sword.light.c', 'sword.light.c.rec', 'sword.light.d', 'sword.light.combo',
    'sword.heavy.a', 'sword.heavy.a.rec', 'sword.heavy.b', 'sword.heavy.b.rec', 'sword.heavy.c', 'sword.heavy.c.rec', 'sword.heavy.d', 'sword.heavy.combo',
    'sword.aerial.a', 'sword.aerial.a.rec', 'sword.aerial.b', 'sword.aerial.combo', 'sword.aerial.idle',
    'sword.block', 'sword.dash', 'sword.pound', 'sword.uppercut',
  ],
  life: [
    'sit.enter', 'sit.talk', 'sit.exit', 'crouch', 'crouch.walk', 'interact', 'pickup', 'kneel.fix',
    'hit.head', 'die.fwd', 'die.back', 'die.blown',
    'aim.pistol', 'aim.pistol.up', 'aim.pistol.down', 'shoot.pistol', 'reload', 'jab', 'cross', 'roll',
    'jump.start', 'jump.loop', 'jump.land', 'push', 'cast.enter', 'cast.idle', 'cast',
    'sprint', 'walk.formal', 'torch', 'swim', 'swim.idle', 'drive', 'idle.calm',
  ],
};

// (empty until a session with the bucket's keys reads web/anims.jsonl:
// docs/superpowers/HANDOFF-bf2017.md, lane 1)
export const GAME_CLIPS = {};

export const keyOf = (gameName) => gameName.replace(/~([0-9a-f]{8})$/i, '-$1');

export const clipPath = (gameName, skeleton = SKELETON) => `anims/${skeleton}/${keyOf(gameName)}.glb`;

export function packOf(siteName) {
  for (const [pack, names] of Object.entries(PACKS)) if (names.includes(siteName)) return pack;
  return null;
}

export function planPacks(map = GAME_CLIPS, has = () => true) {
  const out = { core: [], sword: [], life: [], missing: [], absent: [] };
  for (const [pack, names] of Object.entries(PACKS))
    for (const site of names) {
      const game = map[site];
      if (!game) {
        out.missing.push(site);
        continue;
      }
      const path = clipPath(game);
      if (!has(path)) {
        out.absent.push(game);
        continue;
      }
      out[pack].push({ site, game, path });
    }
  return out;
}
