// How a kind of person, creature or machine on a world is drawn, in one
// place: a walker cut from its model, a crew model, a catalogue model, a
// figure built in code, or a prop that walks. A world whose site says
// `cast: 'models'` (Hoth) never gets a built one: its files are tried twice
// (placer.js's loadGlb drops a failed url from its cache, so the second is
// a fresh fetch), then a stand-in of the same silhouette, then nothing. The
// design: docs/superpowers/specs/2026-10-09-hoth-design.md, section 1.
//
// resolveFigure(kind, makers, { only, standIns, warn }) → fig | null
//   makers: { walker?, crew, model, built, prop }, each (kind) → fig | null
// STAND_INS[kind] → a kind with a model; markBuilt(fig) → fig, marked

// a kind's stand-in where its own file won't come: one of the same shape
export const STAND_INS = {
  rebel: 'hothtrooper',
  rebelpilot: 'hothtrooper',
  hothtrooper: 'rebel',
  snowtrooper: 'stormtrooper',
  rieekan: 'hothtrooper',
  torynfarr: 'rebel',
  veers: 'officer',
  lukehoth: 'luke',
  hanhoth: 'han',
  leiahoth: 'leia',
  droid: 'r2d2',
  twoonebee: 'r2d2',
  astromech2: 'r2d2',
  astromech3: 'r2d2',
  mercenary: 'rodian',
};

export const markBuilt = (fig) => {
  if (fig?.model) fig.model.userData.built = true;
  return fig ?? null;
};

const quiet = (fn, kind) => Promise.resolve()
  .then(() => (fn ? fn(kind) : null))
  .catch(() => null);
const files = async (kind, makers) => (await quiet(makers.crew, kind)) ?? (await quiet(makers.model, kind));

export async function resolveFigure(kind, makers, { only = false, standIns = STAND_INS, warn = null } = {}) {
  const walker = await quiet(makers.walker, kind);
  if (walker) return walker;
  const own = await files(kind, makers);
  if (own) return own;
  if (!only) return (await quiet(makers.built, kind)) ?? (await quiet(makers.prop, kind));
  const again = await files(kind, makers);
  if (again) return again;
  const stand = standIns[kind];
  const sub = stand ? await files(stand, makers) : null;
  if (sub) return sub;
  warn?.(kind);
  return null;
}
