// A 2017 hero's stance from its stroke table (src/data/bf2017/strokes/,
// measured from Battlefront II's clips): the shape combatRules.js's STANCES
// have, so saber.js's swing and strokeFor read the game's strokes through
// the interfaces they have. The chain is the game's six strikes in turn, each
// with its measured contact window and its way back to the guard; the heavies
// are the jump attack and the dash; each way held (DIRS) is a strike the tip
// was measured cutting that way. A _BackToIdle is a strike's return, never
// a strike. Pure; combatRules.js's stanceOf calls it for a hero on the game's
// rig (and passes its own tables in, so the two files don't import each other).
//
//   stanceFromTable(table, { base, dirs, heavy }) → a stance, or null when the set has no strikes
//     base: the site's stance it stands in for (its reach, guard and lunge are kept)
//     dirs, heavy: combatRules.js's DIRS and HEAVY (their damage, and the ways there are)
//   the stance adds to STANCES' fields: heavies [{ clip, speed, damage }], dirs { way: { clip, damage } },
//   blocks { left, right, any } (by the side each holds the blade on, as measured), blocked, cadence { clip: { dur (till
//   the blade rests), back (its return) } } (the duel's), cuts { clip: 'left' | 'right' } (the side of the striker each
//   of the game's strokes was measured coming in from, on the root's axes, the table's `side`, not its `dir`: blockSide.js's;
//   none for one more up or down than across), game (the hero)

// (the first three of a chain cut light, the rest land harder: the site's single stance's weights)
const damageOf = (i) => (i < 3 ? 2 : 3);

export function stanceFromTable(table, { base, dirs, heavy }) {
  const chain = (table?.strikes ?? []).filter((s) => s.variant === 1).sort((a, b) => a.index - b.index);
  if (!chain.length) return null;
  const all = [...(table.strikes ?? [])].sort((a, b) => b.variant - a.variant || a.index - b.index);
  const strokes = chain.map((s, i) => ({
    clip: s.name,
    speed: 1,
    damage: damageOf(i),
    contact: s.contact,
    back: s.return,
    ...(s.site ? { site: s.site } : {}),
  }));
  // (a hero with neither falls back on its second strikes, the _V2 set: still the game's)
  const heavyOf = (k) =>
    k && {
      clip: k.name,
      speed: heavy.speed,
      damage: heavy.damage,
      contact: k.contact,
    };
  let heavies = [table.jump, table.dash].map(heavyOf).filter(Boolean);
  if (!heavies.length) heavies = all.filter((s) => s.variant > 1).map(heavyOf);
  if (!heavies.length) heavies = [heavyOf(chain.at(-1))];
  const ways = Object.fromEntries(
    Object.entries(dirs).map(([way, d]) => {
      const s = all.find((k) => k.dir === way) ?? chain[0];
      return [way, { clip: s.name, damage: d.damage, contact: s.contact }];
    }),
  );
  const cadence = Object.fromEntries((table.strikes ?? []).map((s) => [s.name, { dur: s.settle ?? s.duration, back: s.returnDuration }]));
  const cuts = Object.fromEntries([...(table.strikes ?? []), table.jump, table.dash].filter((s) => s?.side).map((s) => [s.name, s.side]));
  return {
    ...base,
    about: `${base.about} The game’s own chain.`,
    strokes,
    heavies,
    dirs: ways,
    blocks: table.blocks,
    blocked: table.blocked,
    cadence,
    cuts,
    game: table.hero,
  };
}
