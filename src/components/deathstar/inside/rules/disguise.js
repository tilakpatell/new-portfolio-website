// How sure the garrison is that a trooper is not a trooper. A Rebel in
// stolen armour carries a doubt from 0 (nobody wonders) to 1 (blown). It
// rises only while someone is watching, at a rate for each odd thing they
// see, added up: running, standing in a restricted room, an officer close
// enough for a good look, walking a prisoner nobody ordered moved. With
// nobody watching it fades. Two things need no doubting: a shot fired, or
// a face where a helmet should be, blows it the step it is seen. Blown
// stays blown, since nobody unsees a Rebel. That makes the doubt a trap
// for a Rebel who has no armour yet: seen once, he would be blown for good
// before he ever put any on. So the game steps the doubt only while
// `disguised(you)`, and sets it back to FRESH whenever armour is put on
// (a pickup, a story’s give, a checkpoint that restores it). When the doubt
// climbs over half, someone challenges you, by what made them wonder;
// whoever wears TK-421’s armour hears the one famous line. Pure.
//
//   RATES                          doubt a second for each odd thing seen, and the fade unseen
//   CHALLENGE                      0.5, the doubt at which someone asks who you are
//   FRESH                          0, the doubt that armour just put on starts at
//   LINES                          { [key]: text } every line this says
//   disguised(you) → bool          whether there is a disguise to doubt: a Rebel in armour
//   doubtStep(doubt, ctx, dt) → { doubt, blown, says }
//     ctx: { armour, helmet, running, shooting, restricted, escorting, ordered, officerAt, watchers, tk? }
//       officerAt: metres to the nearest officer who can see you (null or absent when none)
//       watchers: how many can see you now, officers included; tk: the operating number on the armour
//     blown: the doubt stands at 1; says: { key, text } on the step it crosses CHALLENGE or blows, else null

export const RATES = Object.freeze({
  running: 0.12,
  restricted: 0.08,
  officer: 0.05,
  escorting: 0.06,
  unseen: -0.04,
});

export const CHALLENGE = 0.5;

export const FRESH = 0;

// An Imperial has nothing to hide and a Rebel out of armour has no disguise
// yet; stepping the doubt for either would only blow a disguise not worn.
export function disguised(you) {
  return you?.side === 'rebel' && Boolean(you.armour);
}

// an officer this close looks at the trooper and not just the armour
const OFFICER_NEAR = 3;

export const LINES = Object.freeze({
  challenge: 'You there. Your operating number?',
  'challenge-tk421': 'TK-421, why aren’t you at your post?',
  'challenge-prisoner': 'Hold on, trooper. Whose orders moved that prisoner?',
  'challenge-restricted': 'You’ve no business in here, trooper. Who sent you?',
  'challenge-officer': 'Stand still, trooper. Which unit are you with?',
  blown: 'You’re no trooper. Sound the alarm.',
  'blown-face': 'That face isn’t one of ours. Sound the alarm.',
  'blown-shot': 'That trooper’s turned on us. Open fire.',
});

const line = (key) => ({ key, text: LINES[key] });

// The challenge asks after the oddest thing in sight: a prisoner moved
// without orders is a story no trooper can tell, a closed room the next,
// an officer’s close look the next; running alone gets the plain question.
function challengeFor(ctx, unordered) {
  if (ctx.tk === 421) return 'challenge-tk421';
  if (unordered) return 'challenge-prisoner';
  if (ctx.restricted) return 'challenge-restricted';
  if (ctx.officerAt != null && ctx.officerAt <= OFFICER_NEAR) return 'challenge-officer';
  return 'challenge';
}

export function doubtStep(doubt, ctx, dt) {
  const was = Math.min(1, Math.max(0, Number.isFinite(doubt) ? doubt : 0));
  if (was >= 1) return { doubt: 1, blown: true, says: null };

  const seen = ctx.watchers > 0;
  if (seen && ctx.shooting) return { doubt: 1, blown: true, says: line('blown-shot') };
  // no armour at all shows a face as plainly as a helmet off does
  if (seen && (!ctx.armour || !ctx.helmet)) return { doubt: 1, blown: true, says: line('blown-face') };

  const unordered = ctx.escorting && !ctx.ordered;
  let rate = RATES.unseen;
  if (seen) {
    rate = 0;
    if (ctx.running) rate += RATES.running;
    if (ctx.restricted) rate += RATES.restricted;
    if (ctx.officerAt != null && ctx.officerAt <= OFFICER_NEAR) rate += RATES.officer;
    if (unordered) rate += RATES.escorting;
  }

  const now = Math.min(1, Math.max(0, was + rate * dt));
  if (now >= 1) return { doubt: 1, blown: true, says: line('blown') };
  const says = was < CHALLENGE && now >= CHALLENGE ? line(challengeFor(ctx, unordered)) : null;
  return { doubt: now, blown: false, says };
}
