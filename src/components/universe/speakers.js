// Who's saying a crew's line (Comms.jsx): one of the crew, by the line's
// first element, or a voice on the radio that isn't the crew's ('comms'),
// which a line may name with a fourth element { name, color } (the galaxy's
// war's commanders: galaxy/warCast.js), in the radio's voice. A radio line
// whose caller is known (callers.js: Tammy, Vader, Saul) has their name on it,
// and `voiced`, the voice its line is made in (lib/voiced.js); it has no blips
// of its own, like the rest of the radio. Pure, tested.

import { callerOf } from './callers';

export const COMMS = { name: 'On the comms', color: '#9fb0d0', voice: null };

export function speakerFor(line, crew) {
  const [who, , , named] = line;
  if (who === 'comms') {
    if (named) return { ...COMMS, name: named.name, color: named.color };
    const caller = callerOf(crew, line);
    return caller ? { ...COMMS, name: caller.name, voiced: caller.voice } : COMMS;
  }
  return crew?.speakers?.[who] ?? null;
}
