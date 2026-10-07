import { describe, expect, it } from 'vitest';
import { COMMS, speakerFor } from './speakers';
import { crewById, linesFor } from './crews';

const crew = { speakers: { luke: { name: 'Luke', color: '#fff', voice: 'v' } } };

describe('speakerFor', () => {
  it('a crew line is the crew’s speaker’s', () => {
    expect(speakerFor(['luke', 'Hi.'], crew)).toBe(crew.speakers.luke);
    expect(speakerFor(['nobody', 'Hi.'], crew)).toBeNull();
  });
  it('a comms line is the radio’s, or, with a fourth element, the commander’s name and colour on it, in the radio’s voice', () => {
    expect(speakerFor(['comms', 'Hi.'], crew)).toBe(COMMS);
    expect(speakerFor(['comms', 'Hi.', undefined, { name: 'Admiral Ackbar', color: '#ff8844' }], crew)).toEqual({ ...COMMS, name: 'Admiral Ackbar', color: '#ff8844' });
  });
  it('a named comms line with a voice on it is made in that voice, with the name and colour as they were', () => {
    const speaker = speakerFor(['comms', 'Hi.', undefined, { name: 'Admiral Piett', color: '#8899aa', voiced: 'piett' }], crew);
    expect(speaker).toEqual({ ...COMMS, name: 'Admiral Piett', color: '#8899aa', voiced: 'piett' });
    expect(speaker.voice).toBeNull(); // (no blips: the radio's)
  });
  it('a known caller’s comms line has their name on it and their voice to be made in, and no blips', () => {
    const cruiser = crewById('cruiser');
    const [hello] = linesFor(cruiser, 'npc', 'jerry', 'hello');
    expect(speakerFor(hello, cruiser)).toEqual({ ...COMMS, name: 'Jerry', voiced: 'jerry' });
  });
});
