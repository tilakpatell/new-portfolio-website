import { describe, expect, it } from 'vitest';
import { STATIONS } from '../../rules/stations';
import { drawsOwn } from './index';

describe('the rooms’ builders', () => {
  it('draw every room of both stations in its own way, none left to the plain shell', () => {
    for (const [id, station] of Object.entries(STATIONS)) {
      for (const room of station.rooms) expect(drawsOwn(id, room.kind), `${id}: ${room.id} (${room.kind})`).toBe(true);
    }
  });
});
