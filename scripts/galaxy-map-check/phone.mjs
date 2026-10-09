/* global window, document, innerHeight */
// The galaxy map check's phone runs (scripts/galaxy-map-check.mjs): at a phone's width, with the mouse's or a touch screen's zoom
// buttons, the names apart, inside and clear of every control; nothing under 0.7 rem; the header row and the Films panel; the
// key under the zoom row; on a short phone the side panel's jump.
import { PHONE_GRAZE, asTouch, check, dotsCheck, headerAndFilms, J, namesProblems, open, out, overlayProblems, settle, smallText } from './lib.mjs';

// a phone: the names apart, inside and clear of the controls, nothing under 0.7 rem, the strip, layers, key and zoom row clear of one
// another, the key under the zoom row; on a short phone (side) the side panel showing the jump without scrolling the frame; with touch
// the zoom buttons at their touch sizes
export const phone = async (viewport, { touch = false, side = false } = {}) => {
  const size = `${viewport.width}x${viewport.height}${touch ? ' touch' : ''}`;
  const say = (ok, what) => check(ok, `${size}: ${what}`);
  const { ctx, page, errors } = await open(viewport);
  if (touch) say((await asTouch(page)) > 0, 'the touch rules found');
  await settle(page, 400);
  // (the buttons' size by the map's width, as galaxy.css has it: 36; on a touch screen 44 over 337 px, 40 over 327, else 36)
  const { w, mapW } = await J(page, () => ({ w: Math.round(document.querySelector('.holomap-zoom button').getBoundingClientRect().width), mapW: window.__mc.map().width }));
  const want = touch ? (mapW > 337 ? 44 : mapW > 327 ? 40 : 36) : 36;
  say(w === want, `the zoom buttons are ${w} px on a ${mapW.toFixed(0)} px map${touch ? ' with touch' : ''} (${want} wanted)`);
  const names = await namesProblems(page);
  say(names.meets.length === 0 && names.outside.length === 0, `names apart and inside${names.meets.length ? ` (${names.meets.slice(0, 5).join(', ')})` : ''}${names.outside.length ? ` (outside: ${names.outside.slice(0, 5).join(', ')})` : ''}`);
  const dots = dotsCheck(names.dots, viewport.width);
  say(dots.ok, `no name over another system's dot deeper than ${PHONE_GRAZE} px${dots.text}`);
  say(names.under.length === 0, `no name under the strip's board, the layers chip, the key chip or the zoom buttons${names.under.length ? ` (${names.under.slice(0, 6).join(', ')})` : ''}`);
  const meets = await overlayProblems(page);
  say(meets.length === 0, `the strip's title and board clear of the zoom row, and the layers and key${meets.length ? ` (${meets.join(', ')})` : ''}`);
  await headerAndFilms(page, say);
  const small = await smallText(page);
  say(small.length === 0, `nothing under 0.7 rem${small.length ? `: ${[...new Set(small)].slice(0, 4).join('; ')}` : ''}`);
  await page.mouse.move(2, 2); // (off the dots: no hover card in the shot)
  await settle(page, 250);
  await page.locator('.holomap-frame').screenshot({ path: `${out}/map-${size.replace(' ', '-')}-whole.png` });
  await page.locator('.holomap-legend-toggle').click();
  await settle(page, 300);
  const key = await J(page, () => {
    const p = document.querySelector('.holomap-legend-panel').getBoundingClientRect();
    const z = document.querySelector('.holomap-zoom').getBoundingClientRect();
    const m = window.__mc.map();
    return { meets: p.left < z.right && z.left < p.right && p.top < z.bottom && z.top < p.bottom, gap: p.top - z.bottom, inside: p.left >= m.left && p.right <= m.right && p.top >= m.top && p.bottom <= m.bottom };
  });
  say(!key.meets && key.inside, `the open key sits under the zoom row (${Math.round(key.gap)} px below it) and inside the map`);
  await page.locator('.holomap-legend-toggle').click();
  if (side) {
    await page.locator('.holomap-find input').fill('hoth');
    await page.keyboard.press('Enter');
    await settle(page, 800);
    const r = await J(page, () => {
      const j = document.querySelector('.holomap-jump').getBoundingClientRect();
      const s = document.querySelector('.holomap-side').getBoundingClientRect();
      const f = document.querySelector('.holomap-frame');
      return { jt: j.top, jb: j.bottom, st: s.top, sb: s.bottom, frameScroll: f.scrollTop + f.scrollLeft, vh: innerHeight };
    });
    say(r.jt >= r.st - 0.5 && r.jb <= r.sb + 0.5 && r.jb <= r.vh, `the side panel shows the jump button without scrolling (side ${Math.round(r.st)}-${Math.round(r.sb)}, jump ${Math.round(r.jt)}-${Math.round(r.jb)}, window ${r.vh})`);
    say(r.frameScroll === 0, 'the whole frame is not scrolled');
    await page.screenshot({ path: `${out}/map-${size}-side.png` });
  }
  say(errors.length === 0, `no errors${errors.length ? ` (${[...new Set(errors)].slice(0, 3).join('; ')})` : ''}`);
  await ctx.close();
};
