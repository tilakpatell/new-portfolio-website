import { othersText } from './hud';

// The other players online in this world: "N others here", or a way to see
// them. Plain values, from the world's own link (its useTravellers): `count`,
// whether you're `on`, `onJoin` to go online, `available` (false: no going
// online here). `noun` is the world's word for them on the way in ("See
// other drivers"); once you're in they're "others" everywhere. `lore`: { off,
// on }, the world's own words for how the others show (a ghost Aztek, a pale
// Mark), as the tooltips. `item`: drawn as a Menu entry rather than a chip.
export default function PlayersChip({ count = 0, on = true, onJoin = null, available = true, noun = 'players', lore = null, item = false, className = '' }) {
  if (!available) return null;
  const cls = item ? className : `hud-chip hud-players ${className}`.trim();
  if (!on)
    return onJoin ? (
      <button type="button" className={cls || undefined} onClick={onJoin} title={lore?.off ?? 'Go online, and see everyone else here, with their name over them'}>
        See other {noun}
      </button>
    ) : null;
  return (
    <span className={cls || undefined} role={item ? undefined : 'status'} data-on aria-label={othersText(count) ?? 'No one else here'} title={lore?.on ?? 'Everyone else online here: nothing passes between you but where each of you is'}>
      {count > 0 ? (
        <>
          <b>{count}</b> {count === 1 ? 'other' : 'others'} here
        </>
      ) : (
        'No one else here'
      )}
    </span>
  );
}
