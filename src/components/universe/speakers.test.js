import { describe, expect, it } from 'vitest';
import { COMMS, speakerFor } from './speakers';

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
});
