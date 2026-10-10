import { describe, expect, it } from 'vitest';
import { furnish } from '../../../rules/furnish';
import { buildLayout } from '../../../rules/layout';
import { DS2 } from '../../../rules/stations/ds2';
import { boundsOf } from '../deep/parts';
import { HEIGHT_PROPS, roundWindowHole } from './heights';

const layout = buildLayout(DS2);
const SLACK = 0.05;

describe('the second Death Star’s heights, drawn', () => {
  it('has a drawing for everything furnished in the throne room, the gallery and the superstructure', () => {
    for (const id of ['throne', 'gallery', 'superstructure']) {
      for (const p of furnish(layout.rooms.get(id), DS2).props) {
        if (p.kind === 'stairs') continue; // (the steps are the room’s own floors, drawn with it)
        expect(HEIGHT_PROPS[p.kind], `${id}: ${p.kind}`).toBeTypeOf('function');
      }
    }
  });

  it('draws each thing inside the footprint and height it is given', () => {
    for (const id of ['throne', 'gallery', 'superstructure']) {
      for (const p of furnish(layout.rooms.get(id), DS2).props.filter((q) => HEIGHT_PROPS[q.kind])) {
        const b = boundsOf(HEIGHT_PROPS[p.kind](p));
        const d = p.d ?? 0.4;
        expect(b.x0, p.kind).toBeGreaterThanOrEqual(-p.w / 2 - SLACK);
        expect(b.x1, p.kind).toBeLessThanOrEqual(p.w / 2 + SLACK);
        expect(b.z0, p.kind).toBeGreaterThanOrEqual(-d / 2 - SLACK);
        expect(b.z1, p.kind).toBeLessThanOrEqual(d / 2 + SLACK);
        expect(b.y0, p.kind).toBeGreaterThanOrEqual(-SLACK);
        expect(b.y1, p.kind).toBeLessThanOrEqual(p.h + SLACK);
      }
    }
  });

  it('holes the throne room’s north wall in a square round the round window', () => {
    const room = layout.rooms.get('throne');
    const hole = roundWindowHole(room);
    expect(hole).toEqual({ x0: room.window.x - 5, x1: room.window.x + 5, z0: room.box.z0, z1: room.box.z0, y0: room.window.y - 5, y1: room.window.y + 5 });
    expect(roundWindowHole(layout.rooms.get('command'))).toBeNull();
  });
});
