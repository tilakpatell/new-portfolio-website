import { describe, expect, it } from 'vitest';
import { furnish } from '../../../rules/furnish';
import { buildLayout } from '../../../rules/layout';
import { DS1 } from '../../../rules/stations/ds1';
import { facedWall, windowRect } from './rooms';

const layout = buildLayout(DS1);

describe('the officers’ deck’s rooms', () => {
  it('holes the overbridge’s north wall for the window, between its sills and on the wall’s line', () => {
    const room = layout.rooms.get('overbridge');
    const frame = furnish(room, DS1).props.find((p) => p.kind === 'window-frame');
    const hole = windowRect(room, frame);
    expect(hole.z0).toBe(room.box.z0);
    expect(hole.z1).toBe(room.box.z0);
    expect(hole.x1 - hole.x0).toBeGreaterThan(room.w / 2);
    expect(hole.x0).toBeGreaterThan(room.box.x0);
    expect(hole.x1).toBeLessThan(room.box.x1);
    expect(hole.y0).toBeGreaterThan(room.y);
    expect(hole.y1).toBeLessThan(room.y + room.h);
  });

  it('knows which wall someone faces', () => {
    const room = layout.rooms.get('firecontrol');
    expect(facedWall(room, room, 0)).toBe('north');
    expect(facedWall(room, room, Math.PI / 2)).toBe('east');
    expect(facedWall(room, room, Math.PI)).toBe('south');
    expect(facedWall(room, room, -Math.PI / 2)).toBe('west');
  });
});
