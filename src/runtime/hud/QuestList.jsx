// A world's list of things to do: each with its seal, where it is, and a way
// there. Under them, anything the world has on the side (`side`: the same
// shape, with `done`), which the story never waits on; or a world's own
// list of them, as children. Closes with its Close button, or Esc (the
// world's own keys say so). `sub`: a line of the world's own flavour under
// the title ("This week at Dunder Mifflin").
// (Moved here from the towns' HUD, where sixteen files shared it.)
export default function QuestList({ title = 'Things to do', label = title, sub = null, quests, next, onClose, onGo, canGo = () => false, side = [], className = '', children = null }) {
  return (
    <div className={`hud-list ${className}`.trim()} role="dialog" aria-label={label}>
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
        <p className="hud-list-sub">{side ? `${q.where}. ${q.blurb}` : q.open ? `${q.where}. ${q.blurb}` : q.locked}</p>
      </div>
      {canGo(q) && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo(q)}>
          Go there
        </button>
      )}
    </li>
  );
}
