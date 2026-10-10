import { STONES } from '../../interests/stones';

// The words and numbers the compound's HUD and its cards share.

// seconds as 0:41.3
export const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
// (either half of the Soul Stone is the Soul Stone)
const STONE_OF = { 'soul-clint': 'soul', 'soul-natasha': 'soul' };
export const stoneFor = (p) => (p.stone ? STONES.find((s) => s.id === (STONE_OF[p.stone] ?? p.stone)) : null);
// what a door's card and the lists say about its stone
export const stoneLine = (p) => {
  const st = stoneFor(p);
  if (!st) return 'No stone here: just Peter, and school';
  return p.done ? `${st.name}: won back` : `Win it for the ${p.stone.startsWith('soul-') ? 'half of the ' : ''}${st.name}`;
};
