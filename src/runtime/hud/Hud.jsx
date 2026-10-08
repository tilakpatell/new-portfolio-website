import { useLayoutEffect, useRef } from 'react';
import { layoutRows } from './hud';

// A world's HUD, over its stage: the top row (the world's title, which may
// shrink to a chip, and under it the objective, on the left; the counters
// and one Menu on the right), the foot (the prompt and what sits beside it)
// and, on touch, the thumbs. The rows are laid out by ./hud.js's rules: the
// frame measures the buttons and the thumbs, however they wrap, and sets
// --hud-under (where what hangs under the top row starts) and --hud-foot
// (how far up the foot sits) on itself, for its children and the world's
// own CSS. A world skins it with the --hud-* variables (./hud.css), on its
// own class.
//
//   <Hud className="iw-hud" brand={…} tools={<Menu …/>} foot={…} touch={touch} thumbs={…}>
//     {what hangs under the top row: a compass, a toast}
//   </Hud>
//
// `order`: 'thumbs-under' (the thumbs at the bottom, the foot over them) or
// 'thumbs-over' (the foot at the bottom, the thumbs over it: a world whose
// foot is an instrument the thumbs shouldn't cover).
export default function Hud({ brand = null, tools = null, foot = null, thumbs = null, touch = false, order = 'thumbs-under', className = '', children = null, ...rest }) {
  const root = useRef(null);
  const toolsRef = useRef(null);
  const footRef = useRef(null);
  const thumbsRef = useRef(null);
  // (the thumbs row may come after the first layout: measure again when it does)
  const hasThumbs = Boolean(touch && thumbs);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const fit = () => {
      const box = el.getBoundingClientRect();
      if (!box.width) return;
      const t = toolsRef.current?.getBoundingClientRect();
      const safe = parseFloat(getComputedStyle(el).getPropertyValue('--hud-safe-b')) || 0;
      const rows = layoutRows({
        width: box.width,
        touch,
        order,
        buttonsBottom: t?.height ? t.bottom - box.top : 0,
        thumbsHeight: inner(thumbsRef.current),
        footHeight: inner(footRef.current),
        safeBottom: safe,
      });
      el.style.setProperty('--hud-under', `${rows.top}px`);
      el.style.setProperty('--hud-foot', `${rows.foot}px`);
      el.style.setProperty('--hud-thumbs', `${rows.thumbs}px`);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    for (const n of [el, toolsRef.current, footRef.current, thumbsRef.current]) if (n) ro?.observe(n);
    return () => ro?.disconnect();
  }, [touch, order, hasThumbs]);

  return (
    <div ref={root} className={`hud ${className}`.trim()} data-touch={touch || undefined} data-order={order} {...rest}>
      <div className="hud-row hud-top">
        <div className="hud-brand">{brand}</div>
        <div className="hud-tools" ref={toolsRef}>
          {tools}
        </div>
      </div>
      {children}
      <div className="hud-row hud-foot" ref={footRef}>
        {foot}
      </div>
      {hasThumbs && (
        <div className="hud-row hud-thumbs" ref={thumbsRef}>
          {thumbs}
        </div>
      )}
    </div>
  );
}

// a row's own height, without the padding the frame sets on it (so a row
// moved up by the other never moves the other back)
function inner(n) {
  if (!n?.offsetHeight) return 0;
  const cs = getComputedStyle(n);
  return Math.max(0, n.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
}
