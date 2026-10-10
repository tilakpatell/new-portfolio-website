// Things your father said (pages/Invincible.jsx): each card's line, who it's
// put down to, and whose voice says it aloud when its button's pressed
// (lib/voiced.js; ./voicelines.js lists them for scripts/voices). Mark's
// answer is his. What Dad says back to the first card is his too; the other
// replies are put together as they happen, or are what happens.
export const LINES = [
  { id: 'think', said: 'Think, Mark!', who: 'Omni-Man, to his son, over the city', voice: 'omniman' },
  { id: 'mimic', said: 'Look what they need to mimic a fraction of our power.', who: 'Omni-Man, at a passing plane', voice: 'omniman' },
  { id: 'sure', said: 'Are you sure?', who: 'Omni-Man', voice: 'omniman' },
  { id: 'still', said: 'I’d still have you, Dad.', who: 'Mark, when asked what he’d have left in five hundred years', voice: 'mark' },
];

export const THINK_REPLY = { voice: 'omniman', said: 'Five hundred years from now, you’ll still be here. Think about it.' };
