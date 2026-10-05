// Simple Rick's line: a wafer is five layers, wafer and cream in turn. The
// dispenser swings back and forth over the belt; drop to lay the next
// layer on the one below. Whatever hangs over the edge is cut off, so the
// stack narrows (the arcade game Stacker's rule), and a layer that misses
// altogether spoils the wafer. The dispenser speeds up a layer at a time.
// Three good wafers (the top layer still most of the width) out of six.
// Widths are in wafer widths: a whole layer is 1.

// layers a wafer, good wafers wanted, wafers a shift, how wide a good
// wafer's top must be, the dispenser's swings a second (and how much
// quicker each layer), how far it swings each way, and the narrowest
// overlap that still sticks
export const LINE = { layers: 5, need: 3, wafers: 6, good: 0.7, speed: 0.55, speedUp: 0.12, travel: 0.75, miss: 0.02 };

const TRAY = { x: 0, w: 1 };

export const newLine = () => ({ state: 'ready', layer: 0, below: { ...TRAY }, x: 0, w: 1, phase: 0, stack: [], last: null, good: 0, made: 0, dropped: false });

// The dispenser, moving on.
export function stepLine(line, dt) {
  line.dropped = false;
  if (line.state !== 'ready') return;
  line.phase += dt * (LINE.speed + line.layer * LINE.speedUp) * Math.PI * 2;
  line.x = Math.sin(line.phase) * LINE.travel;
}

// a wafer done with: on to the next, and the shift won or over?
function finish(line, events, spoilt) {
  line.made += 1;
  line.last = { stack: line.stack, spoilt };
  if (!spoilt) {
    const good = line.w >= LINE.good;
    events.push({ type: 'wafer', w: line.w });
    if (good) {
      line.good += 1;
      events.push({ type: 'good', w: line.w });
    }
  }
  line.layer = 0;
  line.below = { ...TRAY };
  line.w = 1;
  line.stack = [];
  if (line.good >= LINE.need) {
    line.state = 'won';
    events.push({ type: 'won' });
  } else if (line.made >= LINE.wafers) {
    line.state = 'out';
    events.push({ type: 'out' });
  }
}

// Drop the next layer where the dispenser is. One a press: a second drop
// before the dispenser has moved on does nothing.
export function dropLayer(line) {
  if (line.state !== 'ready' || line.dropped) return [];
  line.dropped = true;
  const events = [];
  const lo = Math.max(line.x - line.w / 2, line.below.x - line.below.w / 2);
  const hi = Math.min(line.x + line.w / 2, line.below.x + line.below.w / 2);
  const w = hi - lo;
  if (w < LINE.miss) {
    events.push({ type: 'spoilt', layer: line.layer, x: line.x });
    finish(line, events, true);
    return events;
  }
  const laid = { x: (lo + hi) / 2, w, cream: line.layer % 2 === 1 };
  const cut = line.w - w;
  line.stack.push(laid);
  events.push({ type: 'layer', layer: line.layer, ...laid });
  if (cut > 1e-9) events.push({ type: 'cut', w: cut, side: line.x > line.below.x ? 1 : -1 });
  line.below = { x: laid.x, w };
  line.w = w;
  line.layer += 1;
  if (line.layer >= LINE.layers) finish(line, events, false);
  return events;
}
