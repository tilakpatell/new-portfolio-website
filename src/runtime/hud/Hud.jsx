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
        thumbsHeight: thumbsRef.current?.offsetHeight ?? 0,
        footHeight: footRef.current?.offsetHeight ?? 0,
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
  }, [touch, order]);

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
      {touch && thumbs && (
        <div className="hud-row hud-thumbs" ref={thumbsRef}>
          {thumbs}
        </div>
      )}
    </div>
  );
}
