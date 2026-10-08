import { describe, expect, it } from 'vitest';
import { furnish } from '../../../rules/furnish';
import { buildLayout } from '../../../rules/layout';
import { DS1 } from '../../../rules/stations/ds1';
import { boundsOf } from '../deep/parts';
import { DECK_PROPS } from './props';

const layout = buildLayout(DS1);
const DECK = ['conference', 'overbridge', 'firecontrol', 'archive', 'meditation'];
const propsOf = (id) => furnish(layout.rooms.get(id), DS1).props;
const SLACK = 0.03; // metres a drawing may stand past what it is given

describe('the officers’ deck, drawn', () => {
  it('has a drawing for everything furnished in its rooms', () => {
    for (const id of DECK) for (const p of propsOf(id)) expect(DECK_PROPS[p.kind], `${id}: ${p.kind}`).toBeTypeOf('function');
  });

  it('draws each thing inside the footprint and height it is given, so what you see is what you bump into', () => {
    for (const id of DECK) {
      for (const p of propsOf(id)) {
        const b = boundsOf(DECK_PROPS[p.kind](p));
        const d = p.d ?? 0.4;
        expect(b.x0, `${id}: ${p.kind}`).toBeGreaterThanOrEqual(-p.w / 2 - SLACK);
        expect(b.x1, `${id}: ${p.kind}`).toBeLessThanOrEqual(p.w / 2 + SLACK);
        expect(b.z0, `${id}: ${p.kind}`).toBeGreaterThanOrEqual(-d / 2 - SLACK);
        expect(b.z1, `${id}: ${p.kind}`).toBeLessThanOrEqual(d / 2 + SLACK);
        expect(b.y0, `${id}: ${p.kind}`).toBeGreaterThanOrEqual(-SLACK);
        expect(b.y1, `${id}: ${p.kind}`).toBeLessThanOrEqual(p.h + SLACK);
      }
    }
  });

  it('seats twelve round the conference table and keeps the plans in the archive', () => {
    expect(propsOf('conference').filter((p) => p.kind === 'chair')).toHaveLength(12);
    expect(propsOf('archive').some((p) => p.tag === 'plans')).toBe(true);
  });
});
