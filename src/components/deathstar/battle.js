// The Battle of Yavin: once the station reaches Yavin, the Rebels have this
// long to fly the trench run before the Death Star clears the gas giant and
// the moon, Yavin 4, is in range.
export const BATTLE_SECONDS = 120;

export const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
