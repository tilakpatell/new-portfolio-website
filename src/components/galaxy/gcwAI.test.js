import { describe, expect, it } from 'vitest';
import { areaWhole, cutOff, frontPace, frontsFor, lean, orderOver, orderTarget, originOf, phaseAt, pointsCount, raiderOrder, soft, supplied, targetOf } from './gcwAI';
import { GCW, NEIGHBOURS, WAR_SYSTEMS, areaBonusOf, areaOf, opening, pressureOn, supplyOf } from './gcw';
import { WARS } from './sides';

// a map of everything one side's, with a few others'
const map = (rest, some) => ({ ...Object.fromEntries(WAR_SYSTEMS.map((id) => [id, rest])), ...some });
const whole = () => Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 1]));
const still = () => 0;

describe('the campaign’s phases', () => {
  it('go Opening, Escalation, Decisive, Climax, by step, each faster than the last', () => {
    expect(GCW.phases.map((p) => p.name)).toEqual(['Opening', 'Escalation', 'Decisive', 'Climax']);
    expect([0, 59, 60, 239, 240, 329, 330, 359].map(phaseAt)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    const mults = GCW.phases.map((p) => p.mult);
    expect(mults).toEqual([...mults].sort((a, b) => a - b));
    expect(GCW.phases.at(-1).every).toBeLessThan(GCW.phases[1].every);
  });
});

describe('what players do, as the war counts it', () => {
  it('counts in full to the knee, a share past it, and never more than the cap a step', () => {
    expect(soft(0.2)).toBeCloseTo(0.2, 9);
    expect(soft(GCW.knee)).toBeCloseTo(GCW.knee, 9);
    expect(soft(GCW.knee + 0.1)).toBeCloseTo(GCW.knee + 0.1 * GCW.beyond, 9);
    expect(soft(1)).toBe(GCW.playerCap);
    expect(soft(1000)).toBe(GCW.playerCap);
    expect(soft(0)).toBe(0);
    expect(GCW.knee).toBe(0.3);
    expect(GCW.playerCap).toBe(0.45);
  });
  it('counts a side’s points where there’s a battle, or at its own systems, and nowhere else', () => {
    expect(pointsCount('rebel', 'empire', true)).toBe(true);
    expect(pointsCount('rebel', 'rebel', false)).toBe(true);
    expect(pointsCount('rebel', 'empire', false)).toBe(false);
    expect(pointsCount('empire', 'hutt', false)).toBe(false);
  });
});

describe('the underdog and the leader', () => {
  it('a side with under GCW.underdog.below of the systems goes faster, one with over .above slower', () => {
    const n = WAR_SYSTEMS.length;
    expect(lean({ rebel: 2 }, 'rebel')).toBe(GCW.underdog.boost);
    expect(lean({ rebel: Math.ceil(n * 0.5) }, 'rebel')).toBe(1);
    expect(lean({ rebel: n - 2 }, 'rebel')).toBe(GCW.underdog.damp);
    expect(GCW.underdog.boost).toBeGreaterThan(1);
    expect(GCW.underdog.damp).toBeLessThan(1);
  });
});

describe('supply lines', () => {
  // the Rebellion's Yavin, Kashyyyk and Lothal in a line, and Hoth, alone among the Empire's
  const owner = map('empire', { yavin: 'rebel', kashyyyk: 'rebel', lothal: 'rebel', hoth: 'rebel' });
  it('run from a side’s capital through its own systems: one encircled is cut off', () => {
    expect([...supplied(owner, 'rebel', 'yavin')].sort()).toEqual(['kashyyyk', 'lothal', 'yavin']);
    expect(supplied(owner, 'hutt', 'tatooine').size).toBe(0);
  });
  it('run from its worthiest system when the capital’s fallen (the first of the worthiest, in the map’s order)', () => {
    // (Hoth and Lothal are both worth 2: Hoth comes first, and it's alone)
    const lost = { ...owner, yavin: 'empire' };
    expect([...supplied(lost, 'rebel', 'yavin')]).toEqual(['hoth']);
    expect([...supplied({ ...lost, hoth: 'empire' }, 'rebel', 'yavin')].sort()).toEqual(['kashyyyk', 'lothal']);
  });
  it('count what taking a system would cut off from its holder’s capital', () => {
    expect(cutOff(owner, 'kashyyyk', 'yavin')).toBe(1);
    expect(cutOff(owner, 'lothal', 'yavin')).toBe(0);
    expect(cutOff(owner, 'hoth', 'yavin')).toBe(0);
  });
  it('know when taking a system makes its area whole for the taker', () => {
    const area = areaOf('naboo');
    const rest = WAR_SYSTEMS.filter((id) => areaOf(id) === area && id !== 'naboo');
    const all = map('rebel', Object.fromEntries(rest.map((id) => [id, 'empire'])));
    expect(areaWhole(all, 'naboo', 'empire')).toBe(1);
    expect(areaWhole({ ...all, [rest[0]]: 'hutt' }, 'naboo', 'empire')).toBe(0);
  });
});

describe('picking a target', () => {
  const capitals = WARS.gcw.capitals;
  // the attacker at Tatooine, the Rebellion everywhere else: Coruscant whole, Naboo nearly gone
  const at = (by) => {
    const owner = map('rebel', { tatooine: by });
    const control = { ...whole(), naboo: 0.35 };
    return { by, border: ['coruscant', 'naboo'], owner, control, rate: 500, hours: 1.6, capitals: { ...capitals, [by]: 'tatooine' }, lastHit: {}, k: 100, rand: still };
  };
  it('goes by the side’s doctrine: the Empire for what’s worth most and cuts most off, the Hutts for what’s falling', () => {
    expect(targetOf(at('empire'))).toBe('coruscant');
    expect(targetOf(at('hutt'))).toBe('naboo');
  });
  it('won’t throw an attack at what it can’t take: not a Hutt world the Hutts’ halving keeps out of reach', () => {
    const owner = map('rebel', { geonosis: 'empire', tatooine: 'hutt' });
    const control = { ...whole(), naboo: 0.6 };
    const c = { by: 'empire', border: ['kamino', 'naboo', 'tatooine'], owner, control, rate: 40, hours: GCW.attackFor / 3600e3, capitals, lastHit: {}, k: 100, rand: still };
    expect(pressureOn('hutt', 40 + supplyOf('tatooine', owner, 'empire')) * 1.6).toBeLessThan(80);
    expect(targetOf(c)).toBe('naboo');
  });
  it('goes elsewhere than where it went lately', () => {
    const c = at('hutt');
    expect(targetOf({ ...c, control: whole(), border: ['kamino', 'naboo'], lastHit: {} })).toBe('kamino');
    expect(targetOf({ ...c, control: whole(), border: ['kamino', 'naboo'], lastHit: { kamino: 90 } })).toBe('naboo');
  });
  it('won’t attack a last stand before the Climax (it can’t fall): it goes elsewhere', () => {
    expect(targetOf({ ...at('hutt'), holdsOut: new Set(['naboo']) })).toBe('coruscant');
  });
  it('has nothing to pick on no border', () => {
    expect(targetOf({ ...at('empire'), border: [] })).toBeNull();
  });
  it('comes from the attacker’s neighbour of the target with the firmest hold (the first by name on a tie)', () => {
    const owner = map('rebel', { coruscant: 'empire', naboo: 'empire', geonosis: 'empire' });
    const control = { ...whole(), coruscant: 0.5 };
    expect(originOf(owner, control, 'tatooine', 'empire')).toBe('geonosis');
    expect(originOf(owner, { ...control, geonosis: 0.4 }, 'tatooine', 'empire')).toBe('naboo');
    for (const id of ['tatooine', 'kashyyyk']) {
      const from = originOf(owner, control, id, 'empire');
      expect(NEIGHBOURS[id]).toContain(from);
      expect(owner[from]).toBe('empire');
    }
  });
});

describe('the liberator’s fronts and orders', () => {
  const { owner } = opening('gcw');
  const plan = [...WAR_SYSTEMS];
  it('works a retaking and its order first, then the plan’s order, a rested front last, no more than GCW.fronts', () => {
    const border = plan.filter((id) => owner[id] !== 'rebel' && NEIGHBOURS[id].some((o) => owner[o] === 'rebel'));
    expect(border.length).toBeGreaterThan(GCW.fronts);
    const plain = frontsFor({ owner, order: plan, liberator: 'rebel', busy: new Set(), rest: {}, k: 10, lead: [] });
    expect(plain).toEqual(border.slice(0, GCW.fronts));
    const last = border.at(-1);
    const led = frontsFor({ owner, order: plan, liberator: 'rebel', busy: new Set(), rest: {}, k: 10, lead: [last, null, last] });
    expect(led[0]).toBe(last);
    expect(led.length).toBe(GCW.fronts);
    const rested = frontsFor({ owner, order: plan, liberator: 'rebel', busy: new Set([border[1]]), rest: { [border[0]]: 40 }, k: 10, lead: [] });
    expect(rested).not.toContain(border[1]);
    expect(rested).not.toContain(border[0]);
    // (a last stand, which can't fall before the Climax, is worked only when there's nothing else)
    const later = frontsFor({ owner, order: plan, liberator: 'rebel', busy: new Set(), rest: {}, k: 10, lead: [], later: new Set([border[0]]) });
    expect(later).not.toContain(border[0]);
    expect(frontsFor({ owner, order: plan, liberator: 'rebel', busy: new Set(border.slice(1)), rest: {}, k: 10, lead: [], later: new Set([border[0]]) })).toEqual([border[0]]);
    // (a rested front comes back when there's nothing else to work)
    const few = frontsFor({ owner, order: plan, liberator: 'rebel', busy: new Set(border.slice(1)), rest: { [border[0]]: 40 }, k: 10, lead: [] });
    expect(few).toEqual([border[0]]);
  });
  it('a front’s pace: the liberator’s rate, its supply and areas, less the holder’s defence (less still cut off), as the holder feels it', () => {
    const supply = { empire: new Set(WAR_SYSTEMS.filter((id) => owner[id] === 'empire')) };
    const id = 'coruscant';
    const paced = frontPace({ id, owner, liberator: 'rebel', rate: 6, supply });
    expect(paced).toBeCloseTo(6 + supplyOf(id, owner, 'rebel') - GCW.defence, 9);
    const cut = frontPace({ id, owner, liberator: 'rebel', rate: 6, supply: { empire: new Set() } });
    expect(cut).toBeCloseTo(6 + supplyOf(id, owner, 'rebel') - GCW.defence * GCW.cutDefence, 9);
    const core = { ...owner, coruscant: 'rebel' };
    expect(areaBonusOf('tatooine', core, 'rebel')).toBe(GCW.areaBonus);
    expect(frontPace({ id: 'tatooine', owner: core, liberator: 'rebel', rate: 6, supply: { hutt: new Set(['tatooine']) } })).toBeCloseTo(pressureOn('hutt', 6 + supplyOf('tatooine', core, 'rebel') + GCW.areaBonus - GCW.defence), 9);
  });
  it('orders the liberator to a front it can move, not one stuck, and not the last one again', () => {
    const border = ['coruscant', 'endor'];
    const supply = { empire: new Set(WAR_SYSTEMS.filter((id) => owner[id] === 'empire')) };
    const c = { liberator: 'rebel', border, owner, control: whole(), might: 1, capitals: WARS.gcw.capitals, supply, previous: null, rand: still };
    expect(orderTarget({ ...c, rates: { coruscant: 0.5, endor: 8 } })).toBe('endor');
    expect(orderTarget({ ...c, rates: { coruscant: 8, endor: 8 } })).toBe('coruscant');
    expect(orderTarget({ ...c, rates: { coruscant: 8, endor: 8 }, previous: 'coruscant' })).toBe('endor');
    expect(orderTarget({ ...c, rates: { coruscant: 8, endor: 8 }, holdsOut: new Set(['coruscant']) })).toBe('endor');
    expect(orderTarget({ ...c, border: [], rates: {} })).toBeNull();
  });
  it('orders the raider to take what it’s attacking, else hold its weakest system under threat', () => {
    const control = { ...whole(), coruscant: 0.4, endor: 0.8 };
    expect(raiderOrder({ raider: 'empire', owner, control, attacks: [{ sys: 'hoth', by: 'empire' }], fronts: ['coruscant'] })).toEqual({ sys: 'hoth', verb: 'take' });
    expect(raiderOrder({ raider: 'empire', owner, control, attacks: [{ sys: 'hoth', by: 'hutt' }], fronts: ['endor', 'coruscant'] })).toEqual({ sys: 'coruscant', verb: 'hold' });
    expect(raiderOrder({ raider: 'empire', owner, control, attacks: [], fronts: ['tatooine'] })).toBeNull();
    // (only where the threat's real: a front that's stalled needs no holding)
    const eff = { coruscant: GCW.stuck - 0.1, endor: 3 };
    expect(raiderOrder({ raider: 'empire', owner, control, attacks: [], fronts: ['endor', 'coruscant'], eff })).toEqual({ sys: 'endor', verb: 'hold' });
    expect(raiderOrder({ raider: 'empire', owner, control, attacks: [], fronts: ['coruscant'], eff })).toBeNull();
  });
  it('an order’s over when it’s done or can’t be', () => {
    const s = { owner, attacks: [{ sys: 'hoth', by: 'empire' }], fronts: ['coruscant'], liberator: 'rebel', raider: 'empire' };
    expect(orderOver({ sys: 'coruscant', verb: 'liberate' }, s)).toBe(false);
    expect(orderOver({ sys: 'coruscant', verb: 'liberate' }, { ...s, owner: { ...owner, coruscant: 'rebel' } })).toBe(true);
    // (nowhere near the liberator any more)
    expect(orderOver({ sys: 'geonosis', verb: 'liberate' }, s)).toBe(true);
    expect(orderOver({ sys: 'hoth', verb: 'take' }, s)).toBe(false);
    expect(orderOver({ sys: 'hoth', verb: 'take' }, { ...s, attacks: [] })).toBe(true);
    expect(orderOver({ sys: 'coruscant', verb: 'hold' }, s)).toBe(false);
    expect(orderOver({ sys: 'coruscant', verb: 'hold' }, { ...s, fronts: [] })).toBe(true);
    expect(orderOver({ sys: 'coruscant', verb: 'hold' }, { ...s, owner: { ...owner, coruscant: 'rebel' } })).toBe(true);
    // (and when the push there has stalled: the liberator's going nowhere, the raider's threat is spent)
    expect(orderOver({ sys: 'coruscant', verb: 'liberate' }, { ...s, eff: { coruscant: GCW.stuck } })).toBe(true);
    expect(orderOver({ sys: 'coruscant', verb: 'liberate' }, { ...s, eff: { coruscant: 2 } })).toBe(false);
    expect(orderOver({ sys: 'coruscant', verb: 'liberate' }, { ...s, eff: {} })).toBe(false);
    expect(orderOver({ sys: 'coruscant', verb: 'hold' }, { ...s, eff: { coruscant: 0.1 } })).toBe(true);
    expect(orderOver({ sys: 'hoth', verb: 'take' }, { ...s, eff: { hoth: 0.1 } })).toBe(false);
    expect(GCW.stuck).toBe(0.5);
  });
});
