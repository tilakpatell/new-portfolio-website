// The page's side of Aboard the Death Star (pages/DeathStarInside.jsx shows
// it). Until the station can be walked it is a holding screen, but it
// already carries the HUD's two marks the tour points at (data-tour
// "ds-objective" and "ds-map"), so the tour's basics land on something
// real from the first day; the start screen, the HUD, the map, pause and
// the touch controls take its place, keeping those marks.
//
//   <Inside mode="page" onExit={fn} />   onExit: leave for the Death Star page

export default function Inside({ mode = 'page', onExit }) {
  return (
    <div className="relative grid place-items-center" data-mode={mode} style={{ minHeight: 'calc(100svh - var(--nav-h, 64px))', background: '#07080a', color: '#d6dbe2' }}>
      <div className="shell py-16">
        <h1 className="title">Aboard the Death Star</h1>
        <p className="lead mt-4 max-w-[60ch]" data-tour="ds-objective">
          Objective: come aboard. The station’s decks open here soon.
        </p>
        <div className="mt-6 max-w-[40ch] rounded border border-white/15 px-4 py-3 font-mono text-sm" data-tour="ds-map">
          Station map: the rooms you’ve seen are drawn in as you go.
        </div>
        {onExit && (
          <button type="button" className="btn btn-ghost mt-6" onClick={onExit}>
            Back to the Death Star
          </button>
        )}
      </div>
    </div>
  );
}
