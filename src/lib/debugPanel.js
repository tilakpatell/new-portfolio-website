// A small panel for tuning a world by eye, after the #debug panel on Bruno
// Simon's folio (docs/research/2026-10-06-why-theirs-look-expensive.md):
// sliders and colour wells bound to the world's live values (the house look,
// the wind, the grass, the lens), and a button that copies them as code to
// paste back into the world. Plain DOM, nothing downloaded, and only built
// when the address asks for it: ?debug, before or after the hash route
// (#/middle-earth/shire?debug).
//
//   debugOn(location) → boolean                            (pure)
//   toCode(groups) → the values as a JS object literal     (pure)
//   debugPanel({ title, groups }) → { dispose() }
//
// A group is { name, items: [{ key, label, type: 'range' | 'colour', min,
// max, step, get(), set(v) }] }; a colour's value is '#rrggbb'.

export function debugOn(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return false;
  const query = [loc.search ?? '', (loc.hash ?? '').split('?')[1] ?? ''];
  return query.some((q) => {
    const v = new URLSearchParams(q.replace(/^\?/, '')).get('debug');
    return v != null && v !== '0' && v !== 'false';
  });
}

const round = (v) => Number(Number(v).toFixed(4));

export function toCode(groups) {
  const lines = groups.map((g) => {
    const items = g.items.map((it) => `${it.key}: ${it.type === 'colour' ? `0x${String(it.value).replace('#', '')}` : round(it.value)}`);
    return `  ${g.name}: { ${items.join(', ')} },`;
  });
  return `{\n${lines.join('\n')}\n}`;
}

const STYLE = `
.tp-debug { position: fixed; top: 12px; right: 12px; z-index: 99999; width: 260px; max-height: calc(100vh - 24px); overflow: auto;
  font: 12px/1.3 ui-monospace, Menlo, monospace; color: #e8e6f0; background: rgba(18, 16, 28, 0.86); border: 1px solid #3a3550;
  border-radius: 8px; padding: 8px 10px; backdrop-filter: blur(6px); }
.tp-debug h4 { margin: 8px 0 4px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #a89cf0; }
.tp-debug label { display: grid; grid-template-columns: 88px 1fr 44px; gap: 6px; align-items: center; margin: 3px 0; }
.tp-debug input[type=range] { width: 100%; }
.tp-debug input[type=color] { width: 100%; height: 18px; border: 0; padding: 0; background: none; }
.tp-debug output { text-align: right; color: #c9c4e0; }
.tp-debug button { margin-top: 8px; width: 100%; padding: 5px; background: #3a3260; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
`;

export function debugPanel({ title = 'Tuning', groups = [] } = {}) {
  if (typeof document === 'undefined') return { dispose() {} };
  const style = document.createElement('style');
  style.textContent = STYLE;
  const box = document.createElement('div');
  box.className = 'tp-debug';
  box.innerHTML = `<strong>${title}</strong>`;
  const live = [];
  for (const g of groups) {
    const h = document.createElement('h4');
    h.textContent = g.name;
    box.append(h);
    for (const it of g.items) {
      const row = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = it.label ?? it.key;
      const input = document.createElement('input');
      const out = document.createElement('output');
      if (it.type === 'colour') {
        input.type = 'color';
        input.value = it.get();
      } else {
        input.type = 'range';
        input.min = it.min ?? 0;
        input.max = it.max ?? 1;
        input.step = it.step ?? 0.01;
        input.value = it.get();
        out.textContent = round(input.value);
      }
      input.addEventListener('input', () => {
        const v = it.type === 'colour' ? input.value : Number(input.value);
        it.set(v);
        if (it.type !== 'colour') out.textContent = round(v);
      });
      row.append(name, input, out);
      box.append(row);
      live.push({ group: g.name, it, input });
    }
  }
  const copy = document.createElement('button');
  copy.textContent = 'Copy values as code';
  copy.addEventListener('click', () => {
    const code = toCode(groups.map((g) => ({ name: g.name, items: g.items.map((it) => ({ key: it.key, type: it.type, value: it.get() })) })));
    navigator.clipboard?.writeText(code).catch(() => {});
    console.info(code);
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy values as code'), 1200);
  });
  box.append(copy);
  // (keys typed into the panel stay in the panel, not the world's controls)
  box.addEventListener('keydown', (e) => e.stopPropagation());
  document.head.append(style);
  document.body.append(box);
  return {
    dispose() {
      box.remove();
      style.remove();
    },
  };
}
