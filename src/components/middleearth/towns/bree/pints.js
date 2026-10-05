// "It comes in pints?" Pouring at Butterbur's tap: hold to pour, let go
// with the top of the head between the two lines on the tankard. The ale
// rises steadily and the head builds as it fills; too soon is short, a
// shade late is all head, and holding on spills it over the brim. Three
// good pints for Pippin, in six goes.
//
// `level` is the ale and `head` the foam on it, as fractions of the
// tankard; `state` is ready | pouring | good | short | over | spilt | won
// | out.

export const POUR = { rate: 0.34, foam: 0.1, lo: 0.82, hi: 0.95, need: 3, tries: 6 };

export const newPour = () => ({ level: 0, head: 0, pouring: false, tries: 0, good: 0, state: 'ready' });

export const top = (p) => p.level + p.head;

export function startPour(p) {
  if (p.state !== 'ready') return;
  p.pouring = true;
  p.state = 'pouring';
}

// after a go: won, out of goes, or showing how that one went
function settle(p, how) {
  p.tries += 1;
  if (how === 'good') p.good += 1;
  p.state = p.good >= POUR.need ? 'won' : p.tries >= POUR.tries ? 'out' : how;
}

// let go of the tap: 'good', 'short', 'over' (too much head), or null if
// it wasn't pouring
export function stopPour(p) {
  if (!p.pouring) return null;
  p.pouring = false;
  const t = top(p);
  const how = t < POUR.lo ? 'short' : t > POUR.hi ? 'over' : 'good';
  settle(p, how);
  return how;
}

// one step: events { type: 'spilt' }, then 'won' or 'out' if that ends it
export function stepPour(p, dt) {
  if (!p.pouring) return [];
  p.level += POUR.rate * dt;
  p.head = POUR.foam * Math.min(1, p.level / 0.5);
  if (top(p) < 1) return [];
  p.pouring = false;
  p.level = 1 - p.head;
  settle(p, 'spilt');
  const ev = [{ type: 'spilt' }];
  if (p.state === 'out') ev.push({ type: 'out' });
  return ev;
}

// a clean tankard under the tap
export function nextMug(p) {
  if (p.state === 'won' || p.state === 'out' || p.state === 'pouring') return;
  p.level = 0;
  p.head = 0;
  p.state = 'ready';
}
