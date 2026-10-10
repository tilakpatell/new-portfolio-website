import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_IDS, CHOKE, GAME_HP, JET, KINDS, KNOCK_FOR, LIGHTNING, abilitiesOf, accrue, chainFrom, forceOf, fromGame, gameHealth, gameRow, hitOf, holdOf, holdVy, jetStep, kindOf, knockSpeed, newJet, pickOne, rushHits, SABER_THROWS, clipFor, soak, takenOf, throwOf, toSite } from './abilityRules';

describe('the abilities', () => {
  it('each have a name, a word about them and a cooldown, and the thrown ones a blast', () => {
    expect(ABILITY_IDS.length).toBeGreaterThanOrEqual(10);
    for (const id of ABILITY_IDS) {
      const a = ABILITIES[id];
      expect(a.name.length, id).toBeGreaterThan(2);
      expect(a.about.length, id).toBeGreaterThan(10);
      expect(a.cool, id).toBeGreaterThanOrEqual(0);
      // (`hold` says a card is held, not pressed: never a number)
      if (a.hold != null) expect(a.hold, id).toBe(true);
      if (a.radius != null) {
        expect(a.fuse).toBeGreaterThan(0);
        expect(a.speed).toBeGreaterThan(0);
        expect(a.damage).toBeGreaterThan(0);
      }
    }
    expect(ABILITIES.jetpack.hold).toBe(true);
  });

  it('gives a spec its own pair, else the Force to a saber and a detonator to a gun', () => {
    expect(abilitiesOf({ abilities: { power: 'jetpack', second: 'rocket' } })).toEqual({ power: 'jetpack', second: 'rocket' });
    expect(abilitiesOf({ saber: { color: '#fff' } })).toEqual({ power: 'push', second: 'pull' });
    expect(abilitiesOf({ gun: 'portal' })).toEqual({ power: 'detonator', second: 'overcharge' });
    expect(abilitiesOf({ abilities: { power: 'nope', second: 'rocket' } })).toEqual({ power: 'detonator', second: 'overcharge' });
    expect(abilitiesOf(null)).toEqual({ power: 'detonator', second: 'overcharge' });
  });

  it('burns the jetpack while held, runs dry, and refills on the ground', () => {
    const jet = newJet();
    expect(jet.fuel).toBe(JET.tank);
    jetStep(jet, { hold: true, grounded: true, dt: 0.5 });
    expect(jet.on).toBe(true);
    expect(jet.fuel).toBeCloseTo(JET.tank - 0.5);
    for (let i = 0; i < 20; i++) jetStep(jet, { hold: true, grounded: false, dt: 0.5 });
    expect(jet.fuel).toBe(0);
    expect(jet.on).toBe(false);
    // in the air with the key up: nothing, and no refill
    jetStep(jet, { hold: false, grounded: false, dt: 1 });
    expect(jet.fuel).toBe(0);
    // down: it fills over its refill time, and never past the tank
    jetStep(jet, { hold: false, grounded: true, dt: JET.refill / 2 });
    expect(jet.fuel).toBeCloseTo(JET.tank / 2);
    jetStep(jet, { hold: false, grounded: true, dt: 10 });
    expect(jet.fuel).toBe(JET.tank);
    expect(jet.on).toBe(false);
  });
});

describe('the 2017 heroes’ own, from the game’s data', () => {
  it('turns the game’s hit points into the site’s: a trooper’s 150 is a stormtrooper’s 2, and anything that lands at least 1', () => {
    expect(GAME_HP).toBe(75);
    expect(toSite(150)).toBe(2);
    expect(toSite(90)).toBe(1);
    expect(toSite(10)).toBe(1);
    expect(toSite(0)).toBe(0);
  });

  it('reads a card’s numbers from bf2017Abilities.json: Luke’s push is the game’s', () => {
    const row = gameRow('luke', 'Ability_Luke_ForcePush');
    expect(row).toMatchObject({ recharge: 20, cone: 30, range: 12, knock: 10, damage: { hero: 90, trooper: 150 } });
    const card = fromGame('luke', 'Ability_Luke_ForcePush');
    expect(card).toMatchObject({ cool: 20, wind: 0.5, range: 12, knock: 10, hit: { hero: 1, trooper: 2 } });
    expect(card.cone).toBeCloseTo((30 * Math.PI) / 180);
    expect(() => fromGame('luke', 'Ability_Nope')).toThrow();
  });

  it('keeps a choke’s damage by the second, for as long as the game holds it', () => {
    const c = fromGame('vader', 'Ability_DarthVader_ForceChoke_02');
    expect(c.perSecond).toBeCloseTo(86 / 75);
    expect(c.grip).toBe(1.5);
    // (not `hold`: that says a card is held, not pressed)
    expect(c.hold).toBeUndefined();
    expect(c.hit).toBeUndefined();
  });

  it('gives a shield as a share of the hero’s own health, the site’s 100 being theirs', () => {
    expect(gameHealth('vader')).toBe(800);
    expect(fromGame('vader', 'Ability_Vader_FocusRage')).toMatchObject({ dur: 10, taken: 0.92, shield: 25 });
  });

  it('every card of a game kit has the kind it plays as, and its cooldown as the game has it', () => {
    const own = ABILITY_IDS.filter((id) => ABILITIES[id].game);
    expect(own.length).toBeGreaterThanOrEqual(16);
    for (const id of own) {
      const a = ABILITIES[id];
      expect(KINDS, id).toContain(a.kind);
      const [hero, asset] = a.game.split(': ');
      expect(a.cool, id).toBe(gameRow(hero, asset).recharge ?? 0);
    }
    expect(ABILITIES.vaderChoke).toMatchObject({ kind: 'choke', range: 12 });
    expect(ABILITIES.palpatineLightning).toMatchObject({ kind: 'lightning', hold: true, range: 15 });
    expect(ABILITIES.palpatineChain).toMatchObject({ kind: 'chainLightning', range: 18, hit: { trooper: 2 } });
    expect(ABILITIES.lukeRepulse).toMatchObject({ kind: 'repulse', range: 12, knock: 3 });
    expect(ABILITIES.lukeRepulse.cone).toBe(Math.PI);
  });

  it('plays an old card by its id, a new one by its kind', () => {
    expect(kindOf('push')).toBe('push');
    expect(kindOf('vaderChoke')).toBe('choke');
    expect(kindOf('nope')).toBeNull();
  });

  it('shapes a card for the Force’s cone and shove: a game card’s knock carried over the site’s shove time', () => {
    const f = forceOf(ABILITIES.lukePush);
    expect(f).toMatchObject({ range: 12, force: 10 / KNOCK_FOR });
    expect(f.cone).toBeCloseTo((30 * Math.PI) / 180);
    // (an old card is the Force's own numbers)
    expect(forceOf(ABILITIES.push)).toMatchObject({ range: 9, force: 11 });
    expect(knockSpeed(9)).toBeCloseTo(9 / KNOCK_FOR);
  });

  it('lands a card’s hit by who it lands on', () => {
    expect(hitOf(ABILITIES.lukePush, true)).toBe(1);
    expect(hitOf(ABILITIES.lukePush, false)).toBe(2);
    expect(hitOf(ABILITIES.push, false)).toBe(1);
  });

  it('holds a choked body up: the vy that puts a knock at the height wanted', () => {
    // the knock's own step (activity.js): vy -= 14·dt, then y += vy·dt
    let y = 0;
    for (let i = 0; i < 60; i++) {
      let vy = holdVy(y, CHOKE.lift, 1 / 60);
      vy -= 14 / 60;
      y = Math.max(0, y + vy / 60);
    }
    expect(y).toBeGreaterThan(CHOKE.lift * 0.95);
    expect(y).toBeLessThan(CHOKE.lift * 1.01);
  });

  it('accrues a stream of small hits into whole ones', () => {
    let acc = 0;
    let dealt = 0;
    for (let i = 0; i < 10; i++) {
      const r = accrue(acc, 0.3);
      acc = r.acc;
      dealt += r.deal;
    }
    expect(dealt).toBe(3);
    expect(acc).toBeCloseTo(0);
  });

  it('chains lightning from the first in the cone to the nearest of the rest, each hop no longer than a hop', () => {
    const me = { x: 0, z: 0, yaw: 0 };
    const ts = [
      { x: 0, z: 5, id: 'a' },
      { x: 3, z: 9, id: 'b' },
      { x: 40, z: 40, id: 'far' },
      { x: 0, z: -5, id: 'behind' },
      { x: 6, z: 14, id: 'c' },
    ];
    const card = { range: 18, cone: (22 * Math.PI) / 180 };
    expect(chainFrom(me, ts, card).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(chainFrom(me, ts, { ...card, cone: 0.01, range: 3 })).toEqual([]);
    expect(chainFrom(me, ts, card, { hops: 1 }).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('picks the one a choke takes: the nearest in its cone and reach', () => {
    const me = { x: 0, z: 0, yaw: 0 };
    const ts = [{ x: 0, z: 9 }, { x: 0.5, z: 4 }, { x: 0, z: -2 }, { x: 0, z: 30 }];
    expect(pickOne(me, ts, ABILITIES.vaderChoke)).toBe(ts[1]);
    expect(pickOne(me, [ts[2], ts[3]], ABILITIES.vaderChoke)).toBeNull();
  });

  it('finds who a rush passes: near the line it runs, not behind it', () => {
    const ts = [{ x: 0.5, z: 3 }, { x: 3, z: 3 }, { x: 0, z: -1 }, { x: 0, z: 6.5 }];
    expect(rushHits({ x: 0, z: 0 }, { x: 0, z: 6 }, ts, 1.5)).toEqual([ts[0], ts[3]]);
  });

  it('runs a held power off its own tank: the jetpack’s, the lightning’s', () => {
    expect(holdOf(ABILITIES.jetpack)).toBe(JET);
    expect(holdOf(ABILITIES.palpatineLightning)).toBe(LIGHTNING);
    expect(holdOf(ABILITIES.push)).toBeNull();
  });

  it('soaks a hit in a rage: the shield first, the rest cut by the game’s multiplier, nothing once it’s over', () => {
    const rage = { until: 10, taken: 0.9, shield: 5 };
    expect(soak(rage, 10, 1)).toEqual({ n: 4, shield: 0 });
    expect(soak({ ...rage, shield: 20 }, 10, 1)).toEqual({ n: 0, shield: 11 });
    expect(soak(rage, 10, 11)).toEqual({ n: 10, shield: 0 });
    expect(soak(null, 3, 0)).toEqual({ n: 3, shield: 0 });
  });

  it('throws Vader’s and Maul’s blades by the game: the recharge, the hit, the flight from the projectile’s speed', () => {
    const base = { range: 16, dur: 1.5, damage: 2, radius: 1.3, spins: 7 };
    const v = throwOf(SABER_THROWS.vader, base);
    expect(v).toMatchObject({ cool: 8, damage: 2, range: 16, radius: 1.3 });
    expect(v.dur).toBeCloseTo((Math.PI * 16) / 35);
    expect(throwOf(SABER_THROWS.maul, base).dur).toBeCloseTo((Math.PI * 16) / 50);
    expect(throwOf(undefined, base)).toBe(base);
  });

  it('plays a kind’s clip where the hero’s pack has one, best first', () => {
    const has = (n) => ['sword.pound', 'force.push'].includes(n);
    expect(clipFor('repulse', has)).toBe('sword.pound');
    expect(clipFor('pull', has)).toBe('force.push');
    expect(clipFor('choke', has)).toBeNull();
    expect(clipFor('nope', has)).toBeNull();
  });

  it('weakens by the game’s number, and lets it lapse', () => {
    expect(takenOf({ weakUntil: 5, weak: 1.2 }, 4)).toBe(1.2);
    expect(takenOf({ weakUntil: 5, weak: 1.2 }, 6)).toBe(1);
    expect(takenOf({}, 0)).toBe(1);
  });
});
