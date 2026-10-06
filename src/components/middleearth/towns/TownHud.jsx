import { forwardRef } from 'react';
import { useVoiced } from '../../../lib/useVoiced';
import '../../../styles/lazy/middleearth.css';

// The HUD parts a walkable town shares (the Shire's look: its shire-*
// classes, ../shire/shire.css): the list of things to do, a speech bubble,
// a conversation, and the touch stick. The corner map is ./map.js.

// The list of things to do: each with its seal, where it is, and a way there.
// Under them, anything a town has on the side (`side`: the same shape, with
// `done`), which the story never waits on; or a town's own list of them
// (./SideList.jsx), as children.
export function QuestList({ title, quests, next, onClose, onGo, canGo = () => false, side = [], children = null }) {
  return (
    <div className="shire-list" role="dialog" aria-label={title}>
      <div className="shire-list-head">
        <p>Things to do</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <ul>
        {quests.map((q) => (
          <li key={q.id} data-done={q.done || undefined} data-open={q.open || undefined} data-next={q.id === next || undefined}>
            <span className="shire-seal" aria-hidden="true">
              {q.done ? '✓' : ''}
            </span>
            <div>
              <p className="shire-list-name">{q.name}</p>
              <p className="shire-list-sub">{q.open ? `${q.where}. ${q.blurb}` : q.locked}</p>
            </div>
            {canGo(q) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo(q)}>
                Go there
              </button>
            )}
          </li>
        ))}
      </ul>
      {children}
      {side.length > 0 && (
        <>
          <p className="shire-list-side">On the side</p>
          <ul>
            {side.map((q) => (
              <li key={q.id} data-done={q.done || undefined} data-open data-side>
                <span className="shire-seal" aria-hidden="true">
                  {q.done ? '✓' : ''}
                </span>
                <div>
                  <p className="shire-list-name">{q.name}</p>
                  <p className="shire-list-sub">
                    {q.where}. {q.blurb}
                  </p>
                </div>
                {canGo(q) && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo(q)}>
                    Go there
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Who's talking, over their head.
export const Bubble = forwardRef(function Bubble({ name, line }, ref) {
  return (
    <div ref={ref} className="shire-bubble" aria-live="polite">
      <div>
        <b>{name}</b>
        <span>{line}</span>
      </div>
    </div>
  );
});

// A conversation: who says it, what they say, and the replies to pick (with
// their number keys), or a button to go on; and, given onLeave, a way out
// of it (Esc).
export function Convo({ title, name, node, onPick, onNext, onLeave = null, touch, className = '' }) {
  useVoiced(node?.who, node?.say); // in the speaker's own voice, where it's been made (lib/voiced.js)
  if (!node) return null;
  const leave = onLeave && (
    <button type="button" className="btn btn-ghost btn-sm" onClick={onLeave}>
      Leave {!touch && <kbd>Esc</kbd>}
    </button>
  );
  return (
    <div className={`shire-panel town-convo ${className}`} role="dialog" aria-label={title}>
      <p className="shire-panel-title">{name}</p>
      <p className="shire-panel-say" aria-live="polite">
        {node.say}
      </p>
      {node.choices ? (
        <>
          <div className="town-choices">
            {node.choices.map((c, i) => (
              <button key={c.text} type="button" className="btn btn-ghost btn-sm town-choice" onClick={() => onPick(i)}>
                {!touch && <kbd>{i + 1}</kbd>} {c.text}
              </button>
            ))}
          </div>
          {leave && <div className="shire-panel-row">{leave}</div>}
        </>
      ) : (
        <div className="shire-panel-row">
          <button type="button" className="btn btn-primary btn-sm" onClick={onNext}>
            {node.end ? 'Go on' : 'Next'} {!touch && <kbd>Space</kbd>}
          </button>
          {leave}
        </div>
      )}
    </div>
  );
}

// The touch stick: drag from where you put your thumb.
export function Stick({ onStick }) {
  return (
    <div className="shire-hud shire-hud-bottom">
      <div className="shire-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} onLostPointerCapture={onStick} aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

// Other travellers online in this town (./useTravellers.js): how many, or a
// way to see them.
export function Travellers({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="shire-chip town-travellers" onClick={trav.join} title="Go online, and see everyone else walking this town as a ghost from another world">
        See other travellers
      </button>
    );
  return (
    <span className="shire-chip town-travellers" data-on title="Everyone else online in this town shows as a pale ghost: they can’t touch your story, nor you theirs">
      <b>{trav.count}</b> {trav.count === 1 ? 'traveller' : 'travellers'} here
    </span>
  );
}
