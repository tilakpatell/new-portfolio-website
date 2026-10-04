// The first connected gamepad, read once a frame, with a dead zone so a
// resting stick reads as zero. Standard mapping: A/Cross 0, B/Circle 1,
// X/Square 2, Y/Triangle 3, LB 4, RB 5, LT 6, RT 7, Start 9.

const DEAD = 0.18;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export function readPad() {
  let pads = [];
  try {
    pads = navigator.getGamepads?.() ?? [];
  } catch {
    return null; // blocked by a permissions policy
  }
  const p = [...pads].find((g) => g && g.connected && g.mapping === 'standard') ?? [...pads].find((g) => g && g.connected);
  if (!p) return null;
  const b = (i) => Boolean(p.buttons[i]?.pressed);
  return {
    lx: dz(p.axes[0] ?? 0),
    ly: dz(p.axes[1] ?? 0),
    rx: dz(p.axes[2] ?? 0),
    ry: dz(p.axes[3] ?? 0),
    a: b(0),
    b: b(1),
    x: b(2),
    y: b(3),
    lb: b(4),
    rb: b(5),
    lt: b(6),
    rt: b(7),
    start: b(9),
    left: b(14),
    right: b(15),
    up: b(12),
    down: b(13),
  };
}

// Presses (not holds) since the last frame, for buttons that act once.
export function edges(now, before) {
  const out = {};
  if (!now) return out;
  for (const k of Object.keys(now)) if (typeof now[k] === 'boolean' && now[k] && !before?.[k]) out[k] = true;
  return out;
}

// Whether a key press belongs to a text field (where the game keeps out).
export const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
