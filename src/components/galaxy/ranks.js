// What a pilot's called in the war they swore in, by the points they've
// scored for their side this campaign (warState.js's `mine`): a title,
// nothing more. It names you on the comms (warCast.js's {rank}) and the
// holotable. Data, tested.
//
// RANKS[side]: [{ id, name, at }] (at: points, from 0, rising); rankOf(side,
// points) → the rank, or null for nobody's side.

const AT = [0, 5, 15, 35, 70, 120];
const ladder = (names) => names.map((name, i) => ({ id: name.toLowerCase().replace(/[^a-z]+/g, '-'), name, at: AT[i] }));

const PILOTS = ['Flight Cadet', 'Pilot', 'Flight Leader', 'Squadron Leader', 'Captain', 'Commander'];
const OFFICERS = ['Ensign', 'Lieutenant', 'Flight Officer', 'Wing Commander', 'Captain', 'Admiral'];

export const RANKS = {
  republic: ladder(['Clone Cadet', 'Trooper', 'Sergeant', 'Lieutenant', 'Commander', 'General']),
  separatists: ladder(['Droid Cadet', 'Tactical Droid', 'Commander', 'General', 'Warlord', 'Head of State']),
  rebel: ladder(PILOTS),
  empire: ladder(OFFICERS),
  newrepublic: ladder(PILOTS),
  remnant: ladder(OFFICERS),
};

export function rankOf(side, points = 0) {
  const ranks = RANKS[side];
  if (!ranks) return null;
  let out = ranks[0];
  for (const r of ranks) if (points >= r.at) out = r;
  return out;
}
