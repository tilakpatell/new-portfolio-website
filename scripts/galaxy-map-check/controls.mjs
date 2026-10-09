/* global window, document, getComputedStyle, MouseEvent */
// The galaxy map check's controls (suite.mjs calls these where the map is in the state each wants): the find's list, Escape's order
// (the innermost open thing first), a double click whose second press lands elsewhere, the picked system's marks, the cursor, and
// where the focus is after a film is picked or the whole galaxy is asked for.
import { J, hasMap, settle } from './lib.mjs';

// the find's list: plain buttons (no listbox or option roles), a line for no match, and shut by Escape (which empties the field and
// leaves the map), by a press outside it and by Tab away (a press leaves the words in the field)
export const findList = async (page, say) => {
  const state = () =>
    J(page, () => ({
      value: document.querySelector('.holomap-find input').value,
      list: Boolean(document.querySelector('.holomap-find-list')),
      buttons: document.querySelectorAll('.holomap-find-list button').length,
      none: document.querySelector('.holomap-find-none')?.textContent ?? null,
      roles: document.querySelectorAll('.holomap-find [role="listbox"], .holomap-find [role="option"]').length,
      focus: document.activeElement?.matches('.holomap-find input') ?? false,
    }));
  await page.keyboard.press('/');
  await page.keyboard.type('ha');
  let st = await state();
  say(st.list && st.buttons > 0 && st.roles === 0, `find "ha": a list of ${st.buttons} plain buttons (${st.roles} listbox or option roles)`);
  await page.keyboard.press('Escape');
  st = await state();
  say((await hasMap(page)) && !st.list && st.value === '' && st.focus, 'Escape in the find empties it and shuts its list, and the map stays');
  await page.keyboard.type('zzz');
  st = await state();
  say(st.list && st.buttons === 0 && /No system called/.test(st.none ?? '') && /zzz/.test(st.none ?? ''), `find "zzz": "${st.none}"`);
  await page.keyboard.press('Escape');
  await page.keyboard.type('ha');
  await page.locator('.holomap-title').click(); // (a press outside the find)
  st = await state();
  say(!st.list && st.value === 'ha', 'a press outside the find shuts its list and leaves its words');
  await page.locator('.holomap-find input').focus();
  st = await state();
  say(st.list, 'and focusing the field brings the list back');
  await page.keyboard.press('Tab'); // (into the list's first button: it stays)
  st = await state();
  say(st.list, "Tab from the field into the list's buttons keeps it open");
  for (let i = 0; i < st.buttons; i++) await page.keyboard.press('Tab'); // (past the last: focus leaves for the next control)
  st = await state();
  say(!st.list, 'and Tab on out of the find shuts its list');
  await page.locator('.holomap-find input').fill('');
  await page.locator('.holomap-title').click();
};

// Escape shuts the innermost open thing, the map last: the find's list, the films' panel, the key, and on a phone the layers
export const escapeOrder = async (page, say) => {
  const open = () =>
    J(page, () => ({
      find: Boolean(document.querySelector('.holomap-find-list')),
      films: document.querySelector('details.holomap-filmpick').open,
      key: document.querySelector('.holomap-legend-toggle').getAttribute('aria-expanded') === 'true',
      layers: document.querySelector('.holomap-layers-toggle').getAttribute('aria-expanded') === 'true',
      focus: document.activeElement?.className ?? '',
    }));
  const chip = await page.locator('.holomap-layers-toggle').isVisible();
  if (chip) await page.locator('.holomap-layers-toggle').click();
  await page.locator('.holomap-legend-toggle').click(); // (on a phone it hides the layers' chip while it's open: they're still open)
  await page.locator('.holomap-filmpick summary').click(); // (a press anywhere outside the films' panel shuts it: it goes last)
  await page.keyboard.press('/'); // (by key: a press on the field would shut the films' panel)
  await page.keyboard.type('ha');
  let st = await open();
  say(st.find && st.films && st.key && (!chip || st.layers), `the find's list, the films' panel, the key${chip ? ' and the layers' : ''} all open`);
  await page.keyboard.press('Escape');
  st = await open();
  say(!st.find && st.films && st.key, 'the first Escape shuts the find\'s list');
  await page.keyboard.press('Escape');
  st = await open();
  say(!st.films && st.key, 'the second shuts the films\' panel');
  await page.keyboard.press('Escape');
  st = await open();
  say(!st.key && (!chip || st.layers), 'the third shuts the key');
  if (chip) {
    await page.keyboard.press('Escape');
    st = await open();
    say(!st.layers && /layers-toggle/.test(st.focus), 'the fourth shuts the layers, the focus on their chip');
  }
  say(await hasMap(page), 'and the map is still there');
};

// a double click's second press that lands on another system than the first (the first reframed the map) picks that one and jumps
// nowhere (a `dblclick` on it used to jump). Neither system is picked to begin with: `from` is pressed first, then, once the map has
// settled, the events of a double click's second press (a click with detail 2, then the dblclick) go to another system that isn't
// where you are (a double click on that one picks it, and again, clears it)
export const doubleClickElsewhere = async (page, say, from) => {
  const a = await J(page, (id) => window.__mc.dot(id), from);
  await page.mouse.click(a.x, a.y);
  await settle(page, 300);
  const to = await J(page, (f) => window.__mc.free().find((id) => id !== f && id !== window.__galaxy().system), from);
  await J(page, (id) => {
    const el = window.__mc.sys(id);
    for (const type of ['click', 'dblclick']) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, detail: 2, view: window }));
  }, to);
  await settle(page, 300);
  const r = await J(page, () => ({ picked: window.__mc.picked(), jump: window.__galaxy().jump }));
  say(!r.jump && r.picked.length === 1 && r.picked[0] === to, `a double click's second press on ${to}, after a press on ${from}, picks ${to} and starts no jump (picked ${r.picked.join(',') || 'none'}${r.jump ? `; a jump to ${r.jump.to}` : ''})`);
};

// the picked system's marks: its dot brighter and a ring round it, and the panel's details summary reading "More about <name>"
export const pickedMarks = async (page, say, id) => {
  const r = await J(page, (i) => {
    const sys = window.__mc.sys(i);
    const other = [...document.querySelectorAll('.holomap-system')].find((b) => b !== sys && b.getAttribute('aria-pressed') !== 'true');
    const ring = (b) => getComputedStyle(b, '::before');
    const core = (b) => getComputedStyle(b.querySelector('.holomap-dot')).backgroundImage;
    return {
      ring: ring(sys).content !== 'none' && parseFloat(ring(sys).borderTopWidth) >= 1.5,
      otherRing: ring(other).content !== 'none' && parseFloat(ring(other).borderTopWidth) > 0,
      brighter: core(sys) !== core(other) && core(sys).includes('rgb(255, 255, 255)'),
      summary: document.querySelector('.holomap-more > summary')?.textContent ?? null,
      name: document.querySelector('.holomap-sys')?.textContent ?? null,
    };
  }, id);
  say(r.ring && !r.otherRing, `the picked system has a ring of its own (${id}), and no other has`);
  say(r.brighter, "and a brighter dot than the rest's");
  say(r.summary === `More about ${r.name}`, `the panel's details summary reads "${r.summary}"`);
};

// the cursor over the map is a grab only once there is something to drag
export const cursorFor = async (page, say, zoomed) => {
  const cursor = await J(page, () => getComputedStyle(document.querySelector('.holomap-map')).cursor);
  say(zoomed ? cursor === 'grab' : cursor !== 'grab' && cursor !== 'grabbing', `the cursor over the ${zoomed ? 'zoomed' : 'whole'} map is ${cursor}`);
};

// the "whole galaxy" button is aria-disabled, not disabled, at the whole galaxy, and keeps the focus it was pressed with
export const fitButton = async (page, say) => {
  const btn = page.locator('.holomap-zoom button[aria-label="Show the whole galaxy"]');
  await btn.focus();
  await btn.press('Enter');
  await settle(page, 400);
  const r = await J(page, () => {
    const b = document.querySelector('.holomap-zoom button[aria-label="Show the whole galaxy"]');
    return { k: window.__mc.view().k, aria: b.getAttribute('aria-disabled'), disabled: b.disabled, focus: document.activeElement === b };
  });
  say(r.k === 1 && r.aria === 'true' && !r.disabled && r.focus, `the whole-galaxy button, pressed, is aria-disabled and not disabled, and keeps the focus (k ${r.k}, aria-disabled ${r.aria}, disabled ${r.disabled}, focused ${r.focus})`);
};

// the SVG's lines keep their weight at any zoom: a stroke's width in the SVG's units times k (the stage scales the units) is its
// width at the whole map (the course's glow 0.32, a lane 0.045), and a dash is its whole-map length over k the same way
export const strokesKeepWeight = async (page, say) => {
  const r = await J(page, () => {
    const k = window.__mc.view().k;
    const width = (sel) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).strokeWidth) * k : null;
    };
    const dash = parseFloat(getComputedStyle(document.querySelector('.holomap-course')).strokeDasharray) * k;
    return { k, glow: width('.holomap-course-glow'), course: width('.holomap-course'), lane: width('.holomap-lane'), dash };
  });
  const near = (v, want) => v !== null && Math.abs(v - want) < want * 0.03;
  say(r.k > 1.2 && near(r.glow, 0.32) && near(r.course, 0.085) && near(r.lane, 0.045) && near(r.dash, 0.18), `at k=${r.k.toFixed(2)} the course's glow, its line, a lane and its dashes weigh what they do at the whole map (x k: ${r.glow?.toFixed(3)} of 0.32, ${r.course?.toFixed(3)} of 0.085, ${r.lane?.toFixed(3)} of 0.045, dash ${r.dash.toFixed(3)} of 0.18)`);
};
