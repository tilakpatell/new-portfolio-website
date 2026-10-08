import { describe, expect, it } from 'vitest';
import { BOUNTY_EVERY, COP_SIGHT, WITNESS, copSkill, createLaw } from './law';
import { CRIMES, LOSE_SIGHT, REPORT, RESPONSE, SEARCH, bountyTier, createWanted } from './wanted';
import { SIDES } from './sides';

const ship = (x = 0) => ({ x, y: 0, z: 0 });
// the scene's hunters and traffic, as the law sees them
const fakes = ({ sees = false, near = [] } = {}) => {
  const hunters = {
    packs: [],
    left: [],
    sees: () => hunters.seeing,
    seeing: sees,
    strength: (f) => hunters.packs.filter((p) => p.faction === f && !p.gone).reduce((n, p) => n + p.kinds.length, 0),
    pack: (faction, s, opts) => hunters.packs.push({ faction, ...opts }),
    leave: (f) => {
      hunters.left.push(f);
      for (const p of hunters.packs) if (p.faction === f) p.gone = true;
    },
    active: false,
  };
  const traffic = { ships: near, near: (p, r) => traffic.ships.filter((n) => Math.abs(n.at - p.x) <= r) };
  return { hunters, traffic };
};
const make = (over = {}) => {
  const wanted = createWanted();
  wanted.side('starwars');
  const { hunters, traffic } = fakes(over);
  const said = [];
  const sent = [];
  const law = createLaw({ wanted, hunters, traffic, side: () => SIDES.starwars, difficulty: () => ({ skill: over.skill ?? 'regular', search: 1, pace: 1 }), bounty: (tier) => sent.push(tier), say: (e) => said.push(e) });
  return { law, wanted, hunters, traffic, said, sent };
};
const run = (law, seconds, s = ship(), dt = 0.1) => {
  for (let t = 0; t < seconds; t += dt) law.step(dt, s);
};

describe('the law on the map', () => {
  it('knows whose law it is before anything else has happened', () => {
    const wanted = createWanted();
    const law = createLaw({ wanted, side: () => SIDES.rickmorty });
    law.crime('shotLaw', ship());
    expect(wanted.sideId).toBe('rickmorty');
    expect(wanted.stars).toBe(1);
  });

  it('counts only crimes, and sees the ones that are its own business', () => {
    const { law, wanted } = make();
    law.crime('killPirate', ship());
    law.crime('helped', ship());
    expect(wanted.stars).toBe(0);
    law.crime('shotLaw', ship());
    expect(wanted.stars).toBe(CRIMES.shotLaw.stars);
  });

  it('sees a kill when one of its ships is near, and starts a report when only the ordinary ships are', () => {
    const lawNear = make({ near: [{ ref: 'tie', at: WITNESS.law - 5, law: true, civil: false }] });
    lawNear.law.crime('killCivil', ship());
    expect(lawNear.wanted.stars).toBe(CRIMES.killCivil.stars);
    const civilNear = make({ near: [{ ref: 'freighter', at: WITNESS.civil - 5, law: false, civil: true }] });
    civilNear.law.crime('killCivil', ship());
    expect(civilNear.wanted.stars).toBe(0);
    expect(civilNear.said.map((e) => e.type)).toContain('witness');
    run(civilNear.law, REPORT + 0.5);
    expect(civilNear.wanted.stars).toBe(CRIMES.killCivil.stars);
    // the witness shot down: no report
    const silenced = make({ near: [{ ref: 'freighter', at: 5, law: false, civil: true }] });
    silenced.law.crime('killCivil', ship());
    silenced.traffic.ships = [];
    run(silenced.law, REPORT + 0.5);
    expect(silenced.wanted.stars).toBe(0);
    expect(silenced.said.map((e) => e.type)).toContain('silenced');
    // nobody about: nothing
    const alone = make();
    alone.law.crime('killCivil', ship());
    expect(alone.wanted.stars).toBe(0);
    expect(alone.said).toEqual([]);
  });

  it('counts a cop shot down, and nobody else', () => {
    const { law, wanted } = make();
    expect(law.killed('weequay', ship())).toBe(false);
    expect(wanted.stars).toBe(0);
    expect(law.killed('isb', ship())).toBe(true);
    expect(law.killed('empire', ship())).toBe(true);
    expect(wanted.stars).toBeGreaterThan(0);
  });

  it('sends the police by stars, better with more of them, and no more than the response allows', () => {
    const { law, wanted, hunters } = make({ sees: true });
    law.crime('killPatrol', ship()); // two stars
    run(law, 0.2);
    expect(hunters.packs).toHaveLength(1);
    const first = hunters.packs[0];
    expect(first.faction).toBe('isb');
    expect(first.kinds).toEqual(RESPONSE[2].units.map((u) => SIDES.starwars.police.units[u]));
    expect(first.skill).toBe(copSkill('regular', RESPONSE[2].skill));
    // more come only once those are down to under the max, every so often
    run(law, RESPONSE[2].every + 1);
    expect(hunters.strength('isb')).toBeLessThanOrEqual(RESPONSE[2].max + RESPONSE[2].units.length);
    // five stars: the next lot come at once, holding the drive down
    const n = hunters.packs.length;
    law.crime('capitalKill', ship());
    for (const p of hunters.packs) p.gone = true;
    run(law, 0.2);
    expect(hunters.packs.length).toBe(n + 1);
    expect(hunters.packs.at(-1)).toMatchObject({ interdict: true, skill: copSkill('regular', RESPONSE[5].skill) });
    expect(wanted.stars).toBe(5);
  });

  it('loses you out of its sight, and the police leave once it has', () => {
    const { law, wanted, hunters, said } = make({ sees: true });
    law.crime('killPatrol', ship());
    run(law, 1);
    hunters.seeing = false;
    run(law, LOSE_SIGHT + SEARCH[2] + 1);
    expect(wanted.stars).toBe(0);
    expect(said.map((e) => e.type)).toEqual(expect.arrayContaining(['search', 'lost']));
    expect(hunters.left).toContain('isb');
    expect(COP_SIGHT).toBeGreaterThan(WITNESS.law);
  });

  it('counts a patrol going past as seeing you, a moment', () => {
    const { law, wanted, hunters } = make({ sees: true });
    law.crime('killPatrol', ship());
    hunters.seeing = false;
    run(law, LOSE_SIGHT + 0.5);
    expect(wanted.phase).toBe('search');
    law.spotted();
    run(law, 0.2);
    expect(wanted.phase).toBe('pursuit');
  });

  it('sends bounty hunters by the bounty, while the law is not on you, and never at once', () => {
    const { law, wanted, hunters, sent } = make({ sees: true });
    law.crime('capitalKill', ship()); // a big bounty, five stars
    run(law, 30);
    expect(sent).toEqual([]); // (the law's on you: no bounty hunters)
    law.down();
    expect(wanted.stars).toBe(0);
    hunters.seeing = false;
    run(law, 5);
    expect(sent).toEqual([]); // (not at once)
    const tier = bountyTier(wanted.bounty);
    expect(tier).toBeGreaterThan(1);
    run(law, BOUNTY_EVERY[tier]);
    expect(sent).toEqual([tier]);
  });

  it('pays the bounty off out of the wallet on landing, if it covers it, and says what is owed if not', () => {
    const { law, wanted, said } = make();
    law.crime('shotLaw', ship());
    law.down();
    const owed = wanted.bounty;
    const poor = { credits: owed - 1, spend: () => false };
    law.arrive(poor);
    expect(wanted.bounty).toBe(owed);
    expect(said.at(-1)).toMatchObject({ type: 'owed', bounty: owed, need: 1 });
    let took = 0;
    const rich = { credits: owed + 50, spend: (n) => ((took = n), true) };
    law.arrive(rich);
    expect(took).toBe(owed);
    expect(wanted.bounty).toBe(0);
    expect(said.map((e) => e.type)).toContain('paid');
    // no paying while they're after you
    law.crime('shotLaw', ship());
    took = 0;
    law.arrive(rich);
    expect(took).toBe(0);
  });

  it('flies the police a tier better per the response, never past the best', () => {
    expect(copSkill('regular', 0)).toBe('regular');
    expect(copSkill('regular', 2)).toBe('elite');
    expect(copSkill('elite', 2)).toBe('elite');
    expect(copSkill('nonsense', 1)).toBe('regular');
  });
});
