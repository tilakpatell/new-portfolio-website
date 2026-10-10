import { useLayoutEffect, useRef } from 'react';
import { GAP } from './hud';

// A world's list of things to do: each with its seal, where it is, and a way
// there. Under them, anything the world has on the side (`side`: the same
// shape, with `done`), which the story never waits on; or a world's own
// list of them, as children. Closes with its Close button, or Esc (the
// world's own keys say so). `sub`: a line of the world's own flavour under
// the title ("This week at Dunder Mifflin").
// `under`: a selector for what it hangs under in its stage (a world whose
// rows aren't in the HUD frame: the towns' map and chips), measured, so it
// opens just below them however many chips there are, and stops above the
// site's "?". In the frame it hangs under the top row already.
// (Moved here from the towns' HUD, where sixteen files shared it.)
export default function QuestList({ title = 'Things to do', label = title, sub = null, under = null, quests, next, onClose, onGo, canGo = () => false, side = [], className = '', children = null }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const stage = el?.offsetParent;
    if (!under || !stage) return undefined;
    let above = null;
    // (found again each time: a world may take its top row away and bring it
    // back while the list is open; with nothing shown to hang under, the
    // world's own CSS places it, so its Close never leaves the stage)
    const fit = () => {
      const now = stage.querySelector(under);
      if (now !== above) {
        if (above) ro?.unobserve(above);
        above = now;
        if (above) ro?.observe(above);
      }
      const b = above?.getBoundingClientRect();
      if (!b?.height) return el.style.removeProperty('--hud-under');
      el.style.setProperty('--hud-under', `${Math.round(b.bottom - stage.getBoundingClientRect().top + GAP)}px`);
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(fit) : null;
    ro?.observe(stage);
    mo?.observe(stage, { childList: true }); // (its rows come and go as children of the stage; not the subtree, where a frame loop writes numbers)
    fit();
    return () => {
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [under]);
  return (
    <div ref={ref} className={`hud-list ${className}`.trim()} role="dialog" aria-label={label}>
      <div className="hud-list-head">
        <p>{title}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      {sub && <p className="hud-list-flavour">{sub}</p>}
      <ul>
        {quests.map((q) => (
          <Row key={q.id} q={q} next={q.id === next} canGo={canGo} onGo={onGo} />
        ))}
      </ul>
      {children}
      {side.length > 0 && (
        <>
          <p className="hud-list-side">On the side</p>
          <ul>
            {side.map((q) => (
              <Row key={q.id} q={{ ...q, open: true }} side canGo={canGo} onGo={onGo} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Row({ q, next = false, side = false, canGo, onGo }) {
  return (
    <li data-done={q.done || undefined} data-open={q.open || undefined} data-next={next || undefined} data-side={side || undefined}>
      <span className="hud-seal" aria-hidden="true">
        {q.done ? '✓' : ''}
      </span>
      <div>
        <p className="hud-list-name">{q.name}</p>
        <p className="hud-list-sub">{side || q.open ? [q.where, q.blurb].filter(Boolean).join('. ') : q.locked}</p>
      </div>
      {canGo(q) && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo(q)}>
          Go there
        </button>
      )}
    </li>
  );
}
