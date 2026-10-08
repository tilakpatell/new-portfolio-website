import { describe, expect, it } from 'vitest';
import { CAST } from '../cast';
import { buildLayout } from '../layout';
import { STATIONS } from '../stations';
import { garrison } from './garrison';

const L1 = buildLayout(STATIONS.ds1);
const L2 = buildLayout(STATIONS.ds2);
const byTag = (list, tag) => list.filter((p) => p.tag === tag);

describe('who is aboard when you come aboard', () => {
  it('puts a garrison on the first Death Star: troopers, crew, droids, every one a known kind on a floor in its room', () => {
    const list = garrison(L1, { side: 'rebel' });
    expect(list.length).toBeGreaterThanOrEqual(25);
    expect(list.length).toBeLessThanOrEqual(70);
    for (const p of list) {
      expect(CAST[p.kind], p.kind).toBeTruthy();
      const room = L1.rooms.get(p.room);
      expect(room, p.id).toBeTruthy();
      expect(L1.floorAt(p.room, p.x, p.z), `${p.id} stands on nothing`).not.toBeNull();
    }
    expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
    expect(list.filter((p) => p.room === 'bay327' && p.kind === 'stormtrooper').length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the people the talks and eggs look for: the detention officer, the librarian, the conference, G7', () => {
    const list = garrison(L1, { side: 'rebel' });
    expect(byTag(list, 'aa23-officer')).toHaveLength(1);
    expect(byTag(list, 'aa23-officer')[0].room).toBe('aa23');
    expect(list.some((p) => p.kind === 'librarian')).toBe(true);
    expect(byTag(list, 'conference')).toHaveLength(1);
    expect(byTag(list, 'g7')).toHaveLength(1);
    expect(byTag(list, 'g7')[0].kind).toBe('mouse');
  });

  it('leaves the lifts, the field, the compactor, the chute, the shafts and the empty cells to nobody', () => {
    const list = garrison(L1, { side: 'imperial' });
    for (const p of list) expect(['lift', 'field', 'compactor', 'chute', 'shaft', 'chasm', 'ship'], p.id).not.toContain(L1.rooms.get(p.room).kind);
    expect(list.filter((p) => L1.rooms.get(p.room).kind === 'cell')).toEqual([]);
  });

  it('shuts Leia in cell 2187 for a Rebel, and nobody in it for an Imperial', () => {
    expect(byTag(garrison(L1, { side: 'rebel' }), 'leia')[0]?.room).toBe('cell2187');
    expect(byTag(garrison(L1, { side: 'imperial' }), 'leia')).toEqual([]);
  });

  it('seats the Emperor on his throne with his guards, and Jerjerrod in the command centre, on the second', () => {
    const list = garrison(L2, { side: 'rebel' });
    const emperor = list.filter((p) => p.kind === 'emperor');
    expect(emperor).toHaveLength(1);
    expect(L2.rooms.get(emperor[0].room).kind).toBe('throne');
    expect(list.filter((p) => p.kind === 'royalguard' && L2.rooms.get(p.room).kind === 'throne').length).toBeGreaterThanOrEqual(2);
    const j = list.filter((p) => p.kind === 'jerjerrod');
    expect(j).toHaveLength(1);
    expect(L2.rooms.get(j[0].room).kind).toBe('command');
    expect(j[0].tag).toBe('jerjerrod');
    for (const p of list) expect(L2.floorAt(p.room, p.x, p.z), `${p.id} stands on nothing`).not.toBeNull();
  });

  it('is the same garrison every time for the same station and side', () => {
    expect(garrison(L1, { side: 'rebel' })).toEqual(garrison(L1, { side: 'rebel' }));
  });
});
