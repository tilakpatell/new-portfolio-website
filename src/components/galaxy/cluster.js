// The flight cluster's writer (FlightCluster.jsx's markup), called by
// galaxy/scene.js every frame: the deflectors, the speed against the
// boost's top, the kills this flight and the target, each written only
// when what it shows has changed (the HUD kit's rule: numbers through refs
// in the frame loop, never React's state).
export function createCluster() {
  let els = { root: null };
  const was = new Map();
  const put = (el, key, value, write) => {
    if (!el || was.get(key) === value) return;
    was.set(key, value);
    write(el, value);
  };
  const text = (el, s) => (el.textContent = s);
  const prop = (el, s) => el.style.setProperty('--v', s);
  const flag = (name) => (el, on) => el.toggleAttribute(name, on);
  return {
    place(root, v) {
      if (root !== els.root) {
        const q = (c) => root?.querySelector(c) ?? null;
        els = { root, shield: q('.fc-shield'), shieldN: q('.fc-shield-n'), speed: q('.fc-speed'), speedN: q('.fc-speed-n'), kills: q('.fc-kills-n'), target: q('.fc-target'), tName: q('.fc-target-name'), tDist: q('.fc-target-dist'), tHp: q('.fc-target-hp') };
        was.clear();
      }
      if (!root) return;
      put(root, 'on', Boolean(v.on), flag('data-on'));
      if (!v.on) return;
      const sh = Math.max(0, Math.min(100, v.shield));
      put(els.shield, 'sh', String(Math.round(sh) / 100), prop);
      put(els.shield, 'low', Boolean(v.low), flag('data-low'));
      put(els.shieldN, 'shn', `${Math.round(sh)}%`, text);
      const k = v.top > 0 ? Math.min(1, Math.abs(v.speed) / v.top) : 0;
      put(els.speed, 'sp', String(Math.round(k * 50) / 50), prop);
      put(els.speed, 'boost', Boolean(v.boosting), flag('data-boost'));
      put(els.speedN, 'spn', `SPD ${Math.round(Math.abs(v.speed) * 10)}`, text);
      put(els.kills, 'kills', String(v.kills), text);
      const t = v.lock;
      put(els.target, 'ton', Boolean(t), flag('data-on'));
      if (!t) return;
      put(els.tName, 'tn', t.name, text);
      put(els.tDist, 'td', t.dist, text);
      put(els.tHp, 'thon', t.hp !== null && t.hp !== undefined, flag('data-on'));
      if (t.hp !== null && t.hp !== undefined) put(els.tHp, 'thp', String(Math.round(t.hp * 50) / 50), prop);
    },
  };
}
