import { othersText } from './hud';

// The other players online in this world (a world's useTravellers: `trav`
// is { available, on, count, join }): "N others here", or a way to see them.
// `noun` is the world's word for them on the way in ("See other drivers");
// once you're in they're "others" everywhere. `lore`: { off, on }, the
// world's own words for how the others show (a ghost Aztek, a pale Mark),
// as the tooltips. `item`: drawn as a Menu entry
// rather than a chip.
export default function PlayersChip({ trav, noun = 'players', lore = null, item = false, className = '' }) {
  if (!trav?.available) return null;
  const cls = item ? className : `hud-chip hud-players ${className}`.trim();
  if (!trav.on)
    return (
      <button type="button" role={item ? 'menuitem' : undefined} className={cls || undefined} onClick={trav.join} title={lore?.off ?? 'Go online, and see everyone else here, with their name over them'}>
        See other {noun}
      </button>
    );
  return (
    <span className={cls || undefined} role={item ? 'menuitem' : 'status'} data-on aria-label={othersText(trav.count) ?? 'No one else here'} title={lore?.on ?? 'Everyone else online here: nothing passes between you but where each of you is'}>
      {trav.count > 0 ? (
        <>
          <b>{trav.count}</b> {trav.count === 1 ? 'other' : 'others'} here
        </>
      ) : (
        'No one else here'
      )}
    </span>
  );
}
