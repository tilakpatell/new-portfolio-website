// The three worlds' set (docs/superpowers/specs/2026-10-07-three-worlds-design.md):
// what Sketchfab had of Coruscant's, Yavin's and Bespin's things that were
// still built in code. Brought in by scripts/sketchfab-surface.mjs
// (`node scripts/sketchfab-surface.mjs three`), each written to
// public/models/galaxy/surface/<kind>.glb standing on y = 0, facing +z, in
// metres (the script's header has what each field means). Looked for and
// not found, so still built: a WA-7 waitress droid, Jocasta Nu, the
// carbon-freezing platform, a Coruscant police speeder.
export const MODELS = {
  // a Senate repulsorpod, as in the Grand Convocation Chamber
  senatepod: { uid: '64dabc7d11d24b18a56edc4d1d91ae0f', as: 'the Senate pods', metres: 6.5, along: 'x', yaw: 0, tris: 3000, tex: 512 },
};
