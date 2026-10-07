// The Battle of Yavin: once the station reaches Yavin, the Rebels have this
// long to fly the trench run before the Death Star clears the gas giant and
// the moon, Yavin 4, is in range.
export const BATTLE_SECONDS = 120;

export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// The base's intercom, read out as the clock runs down, the way the film
// counts it (by the seconds left), and when it runs out.
export const CALLS = {
  90: 'The Death Star is rounding Yavin.',
  60: 'Death Star will be in range in one minute.',
  30: 'Thirty seconds until Yavin 4 is in range.',
  10: 'Ten seconds. Stay on target.',
};
export const CLEARED = 'The Death Star has cleared the planet. Yavin 4 is in range.';

// How it ended: the last word, and whose it is.
export const ENDINGS = {
  empire: { line: 'Fear will keep the local systems in line.', by: 'Grand Moff Tarkin' },
  rebels: { line: 'Great shot, kid. That was one in a million!', by: 'Han Solo' },
};
