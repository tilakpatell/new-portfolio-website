import { describe, expect, it } from 'vitest';
import { NAMES, VOICELINES, surfaceLines, voiceFor } from './voicelines';
import { voiceOf } from '../../../lib/voiced';

describe('the voices down on the worlds', () => {
  it('know a voice by its speaker’s name, a crew’s by its id, and give none to the rest', () => {
    expect(voiceFor('C-3PO')).toBe('threepio');
    expect(voiceFor('Sandtrooper')).toBe('stormtrooper');
    expect(voiceFor('han')).toBe('han');
    expect(voiceFor('Chewbacca')).toBeNull();
    expect(voiceFor('Ewok')).toBeNull();
    expect(voiceFor('toString')).toBeNull();
    expect(voiceFor(null)).toBeNull();
  });

  it('list what people say, their quests and missions, said aloud and in their voices', () => {
    const places = [
      {
        life: [
          { kind: 'stormtrooper', name: 'Stormtrooper', says: ['Move along.', '(It stares.)', ['Darth Vader', 'I find your lack of faith disturbing.']] },
          { kind: 'ghostben', name: 'Obi-Wan Kenobi', voice: 'ben', says: ['Use the Force.'] },
          { kind: 'jawa', name: 'Jawa', says: ['Utinni!'] },
          { kind: 'farmer', name: 'Owen Lars', quest: 'chores' },
        ],
        quests: [{ id: 'chores', intro: [['Owen Lars', 'Those vaporators won’t fix themselves.']], done: [[null, '(The suns go down.)']] }],
      },
    ];
    const missions = { hoth: { run: { lines: { start: { xwing: [['luke', 'Hang on.']], all: [['Rebel trooper', 'Here they come!']] } } } } };
    expect(surfaceLines(places, missions)).toEqual([
      { who: 'stormtrooper', text: 'Move along.' },
      { who: 'vader', text: 'I find your lack of faith disturbing.' },
      { who: 'ben', text: 'Use the Force.' },
      { who: 'owen', text: 'Thanks again.' },
      { who: 'owen', text: 'Those vaporators won’t fix themselves.' },
      { who: 'rebeltrooper', text: 'Here they come!' },
    ]);
  });

  it('make every voice under an id of its own', () => {
    for (const v of new Set([...Object.values(NAMES), ...VOICELINES.map((l) => l.who)])) {
      expect(v).toMatch(/^[a-z0-9]+$/);
      expect(voiceOf(v), v).toBe(v);
    }
    expect(VOICELINES.length).toBeGreaterThan(400);
  });
});
