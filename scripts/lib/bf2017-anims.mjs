// The 2017 drop's clips (`web/anims.jsonl` in the bf2017-assets bucket):
// one JSON line per clip, each a glTF of one animation on its skeleton's
// bones by name (`file`, under `web/`), with its frames, fps and the
// skeleton it was made on. Read with bf2017-manifest.mjs's readManifest
// (one line, one entry, by name); these are the lookups the fetch and the
// clip packer share, kept apart from the fetch so its network code can
// change without them.

// a clip by name: exactly, else the one whose name differs only in case
// (the game's own spellings wander: `Stand_Sprint_Fwd`, `StandIdle`)
export function animEntry(anims, name) {
  const hit = anims.get(name);
  if (hit) return hit;
  const low = name.toLowerCase();
  for (const [n, e] of anims) if (n.toLowerCase() === low) return e;
  return null;
}

// its file in the bucket
export const animPath = (entry) => (entry.file.startsWith('web/') ? entry.file : `web/${entry.file}`);

// a glob over a whole name (`*` any run, `?` one character), for --list
export const globRe = (glob) => new RegExp(`^${String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
