import './side.css';

// A town's games on the side: things to do that the story doesn't need,
// listed under the story's own in the list of things to do (TownHud's
// QuestList takes them as its children). Each has a star once it's won,
// where it is, the best so far, and a way there.
//
// `tasks`: [{ id, name, where, blurb, open, done, locked?, best? }]
export function SideList({ tasks, onGo, canGo = () => false }) {
  if (!tasks?.length) return null;
  return (
    <div className="town-side">
      <p className="town-side-head">On the side</p>
      <ul>
        {tasks.map((t) => (
          <li key={t.id} data-done={t.done || undefined} data-open={t.open || undefined}>
            <span className="shire-seal town-side-star" aria-hidden="true">
              {t.done ? '★' : ''}
            </span>
            <div>
              <p className="shire-list-name">{t.name}</p>
              <p className="shire-list-sub">{t.open ? `${t.where}. ${t.blurb}` : t.locked}</p>
              {t.open && t.best && <p className="shire-list-sub town-side-best">{t.best}</p>}
            </div>
            {canGo(t) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo(t)}>
                Go there
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
