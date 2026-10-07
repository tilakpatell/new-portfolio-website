// What's over a world's battle (a site's skirmish: skirmish.js) while
// you're near it: whose side you're on, how many each side has standing,
// your kills, the next wave, and a button to fight for the other side (an
// oath to it: galaxy/allegiance.js; turning your coat, if you swore to this
// one in its war this campaign: `sworn`, the side you swore to there).
// `view` is the scene's skirmish view; onSide(id) switches you to that side.

export default function SkirmishHud({ view, sworn = null, onSide }) {
  if (!view?.near) return null;
  const ids = Object.keys(view.sides);
  const other = ids.find((id) => id !== view.side);
  const mine = view.sides[view.side];
  const turning = Boolean(other && sworn && sworn !== view.sides[other].side);
  return (
    <section className="skirmish-hud" aria-label={`${view.name}: you fight for ${mine.short}`} style={{ '--side': mine.colour }}>
      <p className="skirmish-name">{view.name}</p>
      {ids.map((id) => (
        <p key={id} className="skirmish-side" style={{ '--side': view.sides[id].colour }} data-mine={id === view.side || undefined}>
          <b>{view.up[id] ?? 0}</b>
          <span>{view.sides[id].short}</span>
        </p>
      ))}
      <p className="skirmish-score">
        <span>Your kills</span> <b>{view.kills}</b>
        {view.wave != null && view.comes && (
          <>
            <span> · next wave</span> <b>{Math.ceil(view.wave)} s</b>
          </>
        )}
      </p>
      {other && (
        <button type="button" className="skirmish-switch" style={{ '--side': view.sides[other].colour }} onClick={() => onSide(other)}>
          {turning ? 'Turn your coat: fight for the' : 'Fight for the'} {view.sides[other].short}
        </button>
      )}
    </section>
  );
}
