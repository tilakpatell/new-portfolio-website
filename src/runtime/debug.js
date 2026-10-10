// The tuning panel, from the runtime (rt.debug): made when the address asks
// for it (?debug, lib/debugPanel's debugOn), and then one panel for every
// world in turn. Once a world is placed and ready, the runtime asks it for
// its groups (`world.tune?.()`, module.js) and shows them under the
// module's id, which is also the key its values are kept under for the tab;
// a world let go hides it. Without ?debug nothing is made, and a world with
// nothing to tune shows nothing and says nothing. (`on` is read afresh at
// each world by default: the runtime outlives a route, and ?debug can be
// added to the next address without a reload.)
//
//   createDebug({ on: boolean | () => boolean, panel }) → { on, show(id, groups), hide(), current }

import { debugOn, debugPanel } from '../lib/debugPanel';

export function createDebug({ on = () => debugOn(), panel: makePanel = debugPanel } = {}) {
  const isOn = typeof on === 'function' ? () => Boolean(on()) : () => Boolean(on);
  let panel = null; // made the first time a world has something to tune
  let current = null;
  const hide = () => {
    panel?.close();
    current = null;
  };
  return {
    get on() {
      return isOn();
    },
    get current() {
      return current;
    },
    show(id, groups) {
      if (!isOn()) return;
      if (!Array.isArray(groups) || !groups.length) {
        hide(); // (the last world's values aren't this one's)
        return;
      }
      panel ??= makePanel({ title: id });
      panel.open(groups, { title: id, id });
      current = id;
    },
    hide,
  };
}
