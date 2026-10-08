import { describe, expect, it } from 'vitest';
import { furnish } from '../../../rules/furnish';
import { buildLayout } from '../../../rules/layout';
import { DS1 } from '../../../rules/stations/ds1';
import { boundsOf } from '../deep/parts';
import { BAY_PROPS } from './bays';

const layout = buildLayout(DS1);
const SLACK = 0.03;

describe('the chasm’s and the TIE bay’s things, drawn', () => {
  it('draws the fighters, the bridge’s controls and the grapple’s outcrop inside what they are given', () => {
    for (const id of ['chasm', 'tiebay']) {
      const props = furnish(layout.rooms.get(id), DS1).props.filter((p) => BAY_PROPS[p.kind]);
      expect(props.length, id).toBeGreaterThan(0);
      for (const p of props) {
        const b = boundsOf(BAY_PROPS[p.kind](p));
        expect(b.x0, p.kind).toBeGreaterThanOrEqual(-p.w / 2 - SLACK);
        expect(b.x1, p.kind).toBeLessThanOrEqual(p.w / 2 + SLACK);
        expect(b.z0, p.kind).toBeGreaterThanOrEqual(-p.d / 2 - SLACK);
        expect(b.z1, p.kind).toBeLessThanOrEqual(p.d / 2 + SLACK);
        expect(b.y0, p.kind).toBeGreaterThanOrEqual(-SLACK);
        expect(b.y1, p.kind).toBeLessThanOrEqual(p.h + SLACK);
      }
    }
  });

  it('hangs a bay full of fighters', () => {
    expect(furnish(layout.rooms.get('tiebay'), DS1).props.filter((p) => p.kind === 'tie').length).toBeGreaterThan(4);
  });
});
