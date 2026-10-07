// Who's saying a crew's line (Comms.jsx): one of the crew, by the line's
// first element, or a voice on the radio that isn't the crew's ('comms'),
// which a line may name with a fourth element { name, color } (the galaxy's
// war's commanders: galaxy/warCast.js), in the radio's voice. Pure, tested.

export const COMMS = { name: 'On the comms', color: '#9fb0d0', voice: null };

export function speakerFor(line, crew) {
  const [who, , , named] = line;
  if (who === 'comms') return named ? { ...COMMS, name: named.name, color: named.color } : COMMS;
  return crew?.speakers?.[who] ?? null;
}
