// Which of a level's VisualEnvironment records light it, from the names in
// its map's sky[]. The main sky is the VE_Sky_ one; the VE_PV_ ones are
// weather or zone overrides the game blends on top; the high-end switch,
// spot meters and screen effects are not the level's light and are skipped.

const base = (name) => String(name).split('/').pop();

export function pickEntries(skyNames) {
  const names = Array.isArray(skyNames) ? skyNames : [];
  const main = names.find((n) => base(n).startsWith('VE_Sky_')) ?? null;
  const overrides = names.filter((n) => base(n).startsWith('VE_PV_'));
  return { main, overrides };
}

// The weather a record is for, from its folder under Levels/Lighting/<World>/.
export function weatherKey(name) {
  const parts = String(name).split('/');
  const i = parts.findIndex((p) => p.toLowerCase() === 'lighting');
  if (i < 0 || parts.length < i + 4) return null;
  return parts[i + 2].toLowerCase();
}
