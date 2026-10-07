import { describe, expect, it } from 'vitest';
import { GCW, NEIGHBOURS, WAR_SYSTEMS, warTable } from './gcw';
import { SIDES, WARS, WAR_IDS } from './sides';
import { systemById } from './systems';
import { NAME_LEFT, nearestBattle, opsOf, roomOf } from './warMap';

const H = 3600e3;
const posOf = (id) => systemById(id).pos;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// which way an arrow bends from its way, as the map shows it (z runs down it, so heading east,
// the left's north, where the cross product of the way and the fleet comes out negative)
const sideOf = (op) => {
  const [a, b] = [posOf(op.from), posOf(op.to)];
  return (b[0] - a[0]) * (op.token[1] - a[1]) - (b[1] - a[1]) * (op.token[0] - a[0]) < 0 ? 'left' : 'right';
};
// a crafted Civil War table: the Rebellion's to the west and south, the Empire's the rest
const REBEL = ['hoth', 'endor', 'sorgan', 'yavin', 'kashyyyk'];
const rowOf = (id, o = {}) => ({ id, owner: REBEL.includes(id) ? 'rebel' : id === 'tatooine' ? 'hutt' : 'empire', control: 1, front: false, attack: null, major: false, decisive: false, effRate: null, battle: null, ...o });
const tableOf = (rows = {}) => ({ war: 'gcw', systems: WAR_SYSTEMS.map((id) => rowOf(id, rows[id])) });

describe('the operations on the map', () => {
  it('one for each front and attack on a real war, from a system its side holds next to the target', () => {
    let seen = 0;
    for (const war of WAR_IDS)
      for (const h of [0.5, 6, 20, 40, 60, 69]) {
        const table = warTable(war, GCW.start + h * H);
        const rows = Object.fromEntries(table.systems.map((r) => [r.id, r]));
        const ops = opsOf(table);
        const wanted = table.systems.filter((r) => r.attack || (r.front && r.owner !== WARS[war].liberator)).map((r) => r.id);
        expect(ops.map((o) => o.to).sort(), `${war} ${h}h`).toEqual(wanted.sort());
        for (const op of ops) {
          const row = rows[op.to];
          expect(op.by).toBe(row.attack ? row.attack.by : WARS[war].liberator);
          expect(NEIGHBOURS[op.to]).toContain(op.from);
          expect(rows[op.from].owner, `${op.from} → ${op.to}`).toBe(op.by);
          expect(op.progress).toBeGreaterThanOrEqual(0);
          expect(op.progress).toBeLessThanOrEqual(1);
          expect(op.progress).toBeCloseTo(1 - row.control, 9);
          expect(op.colour).toBe(SIDES[op.by].colour);
          expect(op.width).toBeGreaterThanOrEqual(0.05);
          expect(op.width).toBeLessThanOrEqual(0.13);
          expect(op.major).toBe(row.major);
          seen += 1;
        }
      }
    expect(seen).toBeGreaterThan(30);
  });

  it('knows a front, the decisive battle, an attack, a counter-attack and a Hutt raid apart', () => {
    const ops = opsOf(
      tableOf({
        bespin: { front: true, control: 0.6, effRate: 5 },
        coruscant: { front: true, decisive: true, major: true, control: 0.5, effRate: 9 },
        hoth: { attack: { by: 'empire', origin: 'bespin', counter: false }, control: 0.4, effRate: 40 },
        kashyyyk: { attack: { by: 'empire', origin: 'coruscant', counter: true }, control: 0.8, effRate: 30 },
        naboo: { attack: { by: 'hutt', origin: 'tatooine', counter: false }, control: 0.9, effRate: 10 },
      }),
    );
    const kind = Object.fromEntries(ops.map((o) => [o.to, o.kind]));
    expect(kind).toEqual({ bespin: 'front', coruscant: 'decisive', hoth: 'attack', kashyyyk: 'counter', naboo: 'raid' });
    const by = Object.fromEntries(ops.map((o) => [o.to, o.by]));
    expect(by).toEqual({ bespin: 'rebel', coruscant: 'rebel', hoth: 'empire', kashyyyk: 'empire', naboo: 'hutt' });
    // (a faster push is a heavier arrow, up to a cap: 0.13, down from 0.16, which drew an attack's
    // arrow heavier than anything else on the holotable)
    const width = Object.fromEntries(ops.map((o) => [o.to, o.width]));
    expect(width.coruscant).toBeGreaterThan(width.bespin);
    expect(width.hoth).toBe(0.13);
  });

  // (on a tie, the nearest, not the first by name as at first: Coruscant's front came all the way from
  // Hoth, with Kashyyyk next door and as well held)
  it('brings a front from the liberator’s best-held neighbour of it (the nearest, on a tie)', () => {
    const [op] = opsOf(tableOf({ bespin: { front: true }, hoth: { control: 0.7 } }));
    expect(op.from).toBe('hoth');
    // (Bespin's neighbours: Hoth, Mustafar, Nevarro; give the Rebellion Nevarro whole and Hoth less)
    const rebelNevarro = tableOf({ bespin: { front: true }, hoth: { control: 0.7 }, nevarro: { owner: 'rebel', control: 0.9 } });
    expect(opsOf(rebelNevarro)[0].from).toBe('nevarro');
    const tie = tableOf({ bespin: { front: true }, nevarro: { owner: 'rebel' } });
    expect(opsOf(tie)[0].from).toBe('hoth');
    // (Coruscant's next to Hoth, Kashyyyk, Sorgan and Yavin 4, all the Rebellion's and whole: Kashyyyk's nearest)
    expect(opsOf(tableOf({ coruscant: { front: true } }))[0].from).toBe('kashyyyk');
  });

  it('brings an attack from where it was launched while that’s still the attacker’s, or else from its best-held neighbour, or not at all', () => {
    const launched = tableOf({ hoth: { attack: { by: 'empire', origin: 'mustafar' } } });
    expect(opsOf(launched)[0].from).toBe('mustafar');
    // (Mustafar's fallen to the Rebellion since: the attack's fleets are from Bespin now)
    const lost = tableOf({ hoth: { attack: { by: 'empire', origin: 'mustafar' } }, mustafar: { owner: 'rebel' }, bespin: { control: 0.8 }, nevarro: { control: 0.5 }, coruscant: { control: 0.6 } });
    expect(opsOf(lost)[0].from).toBe('bespin');
    // (an attack with nothing of its side next to it any more: no arrow to draw)
    const cut = tableOf({ endor: { attack: { by: 'hutt', origin: 'sorgan' } } });
    expect(opsOf(cut)).toEqual([]);
  });

  it('draws an arrow from clear of one system to clear of the other, and the fleet closes in as its side gains', () => {
    // (Sorgan, the Empire's, from Endor, the Rebellion's: Hoth's as well held, but further)
    const at = (control) => opsOf(tableOf({ sorgan: { owner: 'empire', front: true, control } }))[0];
    const far = at(0.9);
    const near = at(0.1);
    for (const op of [far, near]) {
      expect(op.from).toBe('endor');
      expect(op.d).toMatch(/^M-?[\d.]+ -?[\d.]+ Q-?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+$/);
      expect(op.head.split(' ')).toHaveLength(3);
      expect(dist(op.tip, posOf('sorgan'))).toBeCloseTo(0.42, 6);
      expect(dist(op.start, posOf('endor'))).toBeCloseTo(0.42, 6);
    }
    expect(dist(near.token, posOf('sorgan'))).toBeLessThan(dist(far.token, posOf('sorgan')));
    expect(dist(far.token, posOf('endor'))).toBeLessThan(dist(far.token, posOf('sorgan')));
    // (and a short one, Hoth to Bespin, still clears both dots)
    const short = opsOf(tableOf({ bespin: { front: true } }))[0];
    expect(dist(short.start, posOf('hoth'))).toBeCloseTo(0.42, 6);
    expect(dist(short.tip, posOf('bespin'))).toBeCloseTo(0.42, 6);
  });

  // (at first every arrow bent to the left of its way; drawn, the south's short ones swept over
  // Mustafar's and Nevarro's names with room to spare on the other side. Two along one lane still
  // bend each to its own left, so they part.)
  it('bends two arrows along one lane each to the left of its way, so they don’t lie on one another', () => {
    const ops = opsOf(
      tableOf({
        sorgan: { owner: 'empire', front: true, control: 0.7 },
        endor: { attack: { by: 'empire', origin: 'sorgan' }, control: 0.7 },
        hoth: { control: 0.5 },
      }),
    );
    // (both fleets halfway: straight, they'd pass within a head's length of each other)
    const there = ops.find((o) => o.to === 'sorgan');
    const back = ops.find((o) => o.to === 'endor');
    expect([there.from, back.from]).toEqual(['endor', 'sorgan']);
    expect(dist(there.token, back.token)).toBeGreaterThan(0.5);
    expect([sideOf(there), sideOf(back)]).toEqual(['left', 'left']);
  });

  it('bends a lone arrow to whichever side has more room from the systems and their names', () => {
    // (Hoth and Bespin: to the south-west, Mustafar's name and Nevarro; to the north-east, nothing.
    // So either way along the lane, its arrow bends north-east: left going to Bespin, right coming back.)
    const there = opsOf(tableOf({ bespin: { front: true } }))[0];
    const back = opsOf(tableOf({ hoth: { attack: { by: 'empire', origin: 'bespin' } } }))[0];
    expect([there.from, back.from]).toEqual(['hoth', 'bespin']);
    expect([sideOf(there), sideOf(back)]).toEqual(['left', 'right']);
    // (and the fleet on it stays off every other system's dot and name as it closes in)
    for (const control of [0.95, 0.5, 0.05]) {
      const front = opsOf(tableOf({ bespin: { front: true, control } }))[0];
      expect(roomOf(front.token, ['hoth', 'bespin']), `${control}`).toBeGreaterThan(0);
    }
  });

  it('knows how much room a point has from the systems’ dots and names', () => {
    const hoth = posOf('hoth');
    expect(roomOf(hoth)).toBeLessThan(0);
    // (Hoth's name is on the left of its dot)
    expect(roomOf([hoth[0] - 1, hoth[1]], ['hoth'])).toBe(0);
    expect(roomOf([hoth[0] + 0.6, hoth[1] - 0.6], ['hoth', 'bespin'])).toBeGreaterThan(0.2);
    // (out in the Unknown Regions, nothing for grid squares about)
    expect(roomOf([1, 10])).toBeGreaterThan(2);
  });

  it('puts the names of the systems by the map’s eastern edge on the inside of their dots', () => {
    // (on a phone Kamino's name ran off the map)
    for (const id of ['lothal', 'kamino']) expect(NAME_LEFT.has(id)).toBe(true);
  });
});

describe('the nearest battle to join', () => {
  const battle = (attacker, defender) => ({ attacker, defender, fighting: true });
  const table = tableOf({
    hoth: { attack: { by: 'empire', origin: 'bespin' }, battle: battle('empire', 'rebel') },
    endor: { front: true, owner: 'empire', battle: battle('rebel', 'empire') },
    naboo: { attack: { by: 'hutt', origin: 'tatooine' }, battle: battle('hutt', 'empire') },
  });
  it('is the one your side’s in that’s the shortest jump away, the one where you are first of all', () => {
    expect(nearestBattle(table, 'bespin', 'rebel').id).toBe('hoth');
    expect(nearestBattle(table, 'sorgan', 'rebel').id).toBe('endor');
    expect(nearestBattle(table, 'hoth', 'rebel')).toEqual({ id: 'hoth', seconds: 0 });
    expect(nearestBattle(table, 'tatooine', 'empire').id).toBe('naboo');
    expect(nearestBattle(table, 'kamino', 'rebel').seconds).toBeGreaterThan(0);
  });
  it('is nowhere for nobody’s side, or a side with no battle on', () => {
    expect(nearestBattle(table, 'hoth', null)).toBeNull();
    expect(nearestBattle(table, 'hoth', 'republic')).toBeNull();
    expect(nearestBattle(tableOf(), 'hoth', 'rebel')).toBeNull();
  });
});
