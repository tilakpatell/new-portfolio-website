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
//   copyText(groups, code = toCode) → what the copy button copies: the
//     groups' live values through `code` (a world's own printer)  (pure)
//   restore(id, groups, storage) → how many values it set from the tab's
//     store (pure: `storage` is sessionStorage or a stand-in)
//   keep(id, groups, storage) → writes the groups' live values there
//   debugPanel({ title, groups, code, id }) → { open(groups, { title, id, code }),
//     close(), dispose() }
//
// A group is { name, items: [{ key, label, type: 'range' | 'colour' | 'bool'
// | 'select', min, max, step, options, get(), set(v) }] }; a colour's value
// is '#rrggbb', a switch's true or false, a choice's one of its `options`.
// With an `id` the values are kept under tp-tune-<id> in sessionStorage as
// they're set, and put back when the panel opens, so a reload keeps them
// while tuning; nothing outlives the tab. One panel serves worlds in turn:
// open() shows another's groups in the same box, close() takes it away.

export function debugOn(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return false;
  const query = [loc.search ?? '', (loc.hash ?? '').split('?')[1] ?? ''];
  return query.some((q) => {
    const v = new URLSearchParams(q.replace(/^\?/, '')).get('debug');
    return v != null && v !== '0' && v !== 'false';
  });
}

const round = (v) => Number(Number(v).toFixed(4));
const print = (it) => {
  if (it.type === 'colour') return `0x${String(it.value).replace('#', '')}`;
  if (it.type === 'bool') return String(Boolean(it.value));
  if (it.type === 'select') return `'${String(it.value).replace(/'/g, "\\'")}'`;
  return round(it.value);
};

const KEY = (id) => `tp-tune-${id}`;
const session = () => {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null; // (storage refused: nothing kept)
  }
};
// whether a kept value still fits its item (a choice since taken away, a
// slider since made a switch, is left as the world has it)
const fits = (it, v) => {
  if (it.type === 'colour') return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  if (it.type === 'bool') return typeof v === 'boolean';
  if (it.type === 'select') return (it.options ?? []).includes(v);
  return typeof v === 'number' && Number.isFinite(v);
};

export function restore(id, groups, storage = session()) {
  if (id == null || !storage) return 0;
  let kept;
  try {
    kept = JSON.parse(storage.getItem(KEY(id)) ?? 'null');
  } catch {
    return 0;
  }
  if (!kept || typeof kept !== 'object') return 0;
  let n = 0;
  for (const g of groups) {
    const values = kept[g.name];
    if (!values || typeof values !== 'object') continue;
    for (const it of g.items) {
      if (!(it.key in values) || !fits(it, values[it.key])) continue;
      it.set(values[it.key]);
      n += 1;
    }
  }
  return n;
}

export function keep(id, groups, storage = session()) {
  if (id == null || !storage) return;
  const values = Object.fromEntries(groups.map((g) => [g.name, Object.fromEntries(g.items.map((it) => [it.key, it.get()]))]));
  try {
    storage.setItem(KEY(id), JSON.stringify(values));
  } catch {
    /* storage full or refused: the panel works on without it */
  }
}

export function toCode(groups) {
  const lines = groups.map((g) => {
    const items = g.items.map((it) => `${it.key}: ${print(it)}`);
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
.tp-debug input[type=checkbox] { justify-self: start; margin: 0; }
.tp-debug select { width: 100%; font: inherit; color: inherit; background: #2a2540; border: 1px solid #3a3550; border-radius: 3px; }
.tp-debug input[type=color] { width: 100%; height: 18px; border: 0; padding: 0; background: none; }
.tp-debug output { text-align: right; color: #c9c4e0; }
.tp-debug button { margin-top: 8px; width: 100%; padding: 5px; background: #3a3260; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
`;

export const copyText = (groups, code = toCode) => code(groups.map((g) => ({ name: g.name, items: g.items.map((it) => ({ key: it.key, type: it.type, value: it.get() })) })));

const NONE = { open() {}, close() {}, dispose() {} };

// one row: its input bound to the item, set live (and kept, with an id)
function row(it, changed) {
  const label = document.createElement('label');
  const name = document.createElement('span');
  name.textContent = it.label ?? it.key;
  const out = document.createElement('output');
  let input;
  let read;
  if (it.type === 'select') {
    input = document.createElement('select');
    for (const o of it.options ?? []) input.append(new Option(o, o));
    input.value = it.get();
    read = () => input.value;
  } else {
    input = document.createElement('input');
    if (it.type === 'colour') {
      input.type = 'color';
      input.value = it.get();
      read = () => input.value;
    } else if (it.type === 'bool') {
      input.type = 'checkbox';
      input.checked = Boolean(it.get());
      read = () => input.checked;
    } else {
      input.type = 'range';
      input.min = it.min ?? 0;
      input.max = it.max ?? 1;
      input.step = it.step ?? 0.01;
      input.value = it.get();
      out.textContent = round(input.value);
      read = () => Number(input.value);
    }
  }
  input.addEventListener(it.type === 'bool' || it.type === 'select' ? 'change' : 'input', () => {
    const v = read();
    it.set(v);
    if (it.type === 'range' || it.type == null) out.textContent = round(v);
    changed();
  });
  label.append(name, input, out);
  return label;
}

export function debugPanel({ title = 'Tuning', groups = [], code = toCode, id = null } = {}) {
  if (typeof document === 'undefined') return NONE;
  let style = null;
  let box = null;
  const close = () => {
    box?.remove();
    box = null;
  };
  const open = (gs = [], { title: t = title, id: key = null, code: print = code } = {}) => {
    close();
    restore(key, gs);
    if (!style) {
      style = document.createElement('style');
      style.textContent = STYLE;
      document.head.append(style);
    }
    box = document.createElement('div');
    box.className = 'tp-debug';
    const head = document.createElement('strong');
    head.textContent = t;
    box.append(head);
    const changed = () => keep(key, gs);
    for (const g of gs) {
      const h = document.createElement('h4');
      h.textContent = g.name;
      box.append(h);
      for (const it of g.items) box.append(row(it, changed));
    }
    const copy = document.createElement('button');
    copy.textContent = 'Copy values as code';
    copy.addEventListener('click', () => {
      const text = copyText(gs, print);
      navigator.clipboard?.writeText(text).catch(() => {});
      console.info(text);
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy values as code'), 1200);
    });
    box.append(copy);
    // (keys typed into the panel stay in the panel, not the world's controls)
    box.addEventListener('keydown', (e) => e.stopPropagation());
    document.body.append(box);
  };
  // (made with groups, it opens at once, as the scenes that make their own expect)
  if (groups.length) open(groups, { title, id, code });
  return {
    open,
    close,
    dispose() {
      close();
      style?.remove();
      style = null;
    },
  };
}
