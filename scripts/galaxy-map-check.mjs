// A browser check of the galaxy map (galaxy/HoloMap.jsx, labelPlace.js, mapView.js, useMapView.js, mapKeys.js). With the dev
// server up (npx vite --port 5188 --host 127.0.0.1, or BASE= for another):
//   BASE=http://127.0.0.1:5188 OUT=/tmp/map node scripts/galaxy-map-check.mjs
// It starts nothing itself. Opens #/galaxy, flies the X-wing, presses M, and at 1440x900, 1280x720 and 390x844 (the suite,
// galaxy-map-check/suite.mjs) and then at phone widths (phone.mjs: 375x667 with the side panel, 375x667, 390x844 and 360x640 with
// a touch screen's zoom buttons, 360x640). Shared parts are in galaxy-map-check/lib.mjs.
//   names: no two system names meet, none is out of the map (whole, zoomed in twice over Hoth, framed on Endor); none is under
//     the strip's board, the layers, the key chip or the zoom buttons (at the whole map, at every width); nothing a player reads
//     is under 0.7 rem (11.2 px; the SVG's text by its rendered size); the strip, layers, key and zoom buttons clear of one another
//   header: the title, era chips, Films, find and close buttons meet nowhere and sit inside the frame; the Films panel, a popover
//     that may cover the map's controls while open, is shut by a press on the map outside it, the zoom buttons pressable again
//   find: "endo" + Enter picks Endor and has it on view; J then jumps; a YOU tag on the system you're at
//   zoom: the wheel zooms about the pointer, + - 0, a drag (pressed on a system's button, checked) pans and never picks the
//     system it starts on or ends over; Tab through the systems zoomed in keeps the box from scrolling and frames each one
//   panels: the layers (and the chip on a phone), the era chips dim what isn't of the era, the films' panel (Escape shuts it,
//     not the map), the key (a wheel over it scrolls it and not the page behind; on a phone it sits under the zoom row), the side
//     panel's wheel, the hover card staying inside the map, the side panel on a short phone still showing the jump
//   phone: the zoom buttons a row in the top right corner (36 px; on touch 44 over a 337 px map, 40 over 327, else 36), clear of
//     the strip's title and the names
//   keys: M (held, too) and Escape close it, / finds
//   sharp: zoomed in to k=3.4, the stage is as sharp as without will-change
// Prints a line per check, ok or FAIL, and exits 1 on any FAIL. Shots are in OUT (map-<size>-<what>.png).
import { browser, check, problems } from './galaxy-map-check/lib.mjs';
import { phone } from './galaxy-map-check/phone.mjs';
import { suite } from './galaxy-map-check/suite.mjs';

const stopped = (size, e) => check(false, `${size}: the check stopped: ${String(e.message).split('\n')[0]}`);
for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  await suite(viewport, { full: viewport.width === 1440 }).catch((e) => stopped(`${viewport.width}x${viewport.height}`, e));
}
for (const [viewport, opts] of [[{ width: 375, height: 667 }, { side: true }], [{ width: 375, height: 667 }, { touch: true }], [{ width: 390, height: 844 }, { touch: true }], [{ width: 360, height: 640 }, { touch: true }], [{ width: 360, height: 640 }, {}]]) {
  await phone(viewport, opts).catch((e) => stopped(`${viewport.width}x${viewport.height}${opts.touch ? ' touch' : ''}`, e));
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall ok');
process.exit(problems.length ? 1 : 0);
