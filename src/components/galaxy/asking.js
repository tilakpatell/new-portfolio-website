// What the page asking for a system means for the scene (scene.js): the
// page names the system it wants every time it draws, and only a new name is
// a request. While a jump of the scene's own is on its way (J, the map, out
// past the edge) the page still names the system you left until you're out
// the other side, and drawing again then isn't asking to go back there.
//
// asking(asked, wanted, { here, to, midJump }) → { asked, act }
// asked: the system the page last asked for; wanted: the one it names now;
// here: the system you're in; to: where a jump's taking you, if one is;
// midJump: whether that jump's past coming round (it can't be turned back).
// act: 'jump' (go now), 'queue' (go once this jump's out) or null.
export function asking(asked, wanted, { here = null, to = null, midJump = false } = {}) {
  if (!wanted || wanted === asked) return { asked, act: null };
  if (wanted === here || wanted === to) return { asked: wanted, act: null };
  return { asked: wanted, act: midJump ? 'queue' : 'jump' };
}
