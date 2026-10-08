// What a key does at the portal gun's dial (./DimensionDial.jsx): 'down' or
// 'up' moves it a row, 'pick' dials the row it's on, 'close' puts the gun
// down, 'ignore' is the dial's key but does nothing, and null isn't the
// dial's at all (it's left to the page). A pick or a close is a press, not a
// key held down: E or Enter held from opening it would otherwise pick the row
// it opened on. The arrows repeat.
export function dialKey(e) {
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') return 'down';
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') return 'up';
  if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') return e.repeat ? 'ignore' : 'pick';
  if (e.key === 'Escape') return e.repeat ? 'ignore' : 'close';
  return null;
}
