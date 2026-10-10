// The systems with a Starfighter Assault, by system id: the space level's
// map rulebook and hand stages (src/data/bf2017/maps/), fetched only when
// one's flown (./starfighter.js makes them a battle), and the level pack
// the flight draws (public/models/galaxy/bf2017/levels/<pack>/). Endor's is
// the first; Kamino's orbit, Fondor and the droid battleship (Ryloth) come
// when their systems and packs do (docs/superpowers/HANDOFF-battlefront.md).

export const STARFIGHTER = {
  endor: {
    level: 'sb_endor_01',
    // (the pack: /models/galaxy/bf2017/levels/sb_endor/level.json, the level's
    // fleet, debris and wrecks without its planet, its moon or its corvettes)
    pack: 'sb_endor',
    name: 'Starfighter Assault: Endor',
    load: () => Promise.all([import('../../../../data/bf2017/maps/sb_endor.json'), import('../../../../data/bf2017/maps/sb_endor.stages.json')]).then(([m, s]) => ({ map: m.default, stages: s.default })),
  },
};

export const starfighterAt = (sys) => STARFIGHTER[sys] ?? null;
