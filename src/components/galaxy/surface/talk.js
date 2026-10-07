// What the people say, by the state of things: an actor's `says` is a
// list of lines, or a tree { when: { era?, owner?, side?, hero?, done?:
// [ids], rank? }, lines, else } nested as deep as it likes (`lines` or
// `else` can be a tree themselves). Every key in `when` has to match the
// context (`done`: every id named is done; `rank`: at that rank or above;
// the rest by name); the deepest matching branch's lines are what's said,
// `else` the fallback. Pure.
//
//   talkFor(says, ctx) → [line…]   ctx: { era, owner, side, hero, done (a list or a Set), rank }
//   talkTree(says) → [line…] every line in it (throws on a branch without lines or else, or an unknown key)

const KEYS = ['era', 'owner', 'side', 'hero', 'done', 'rank'];

const isTree = (s) => Boolean(s) && !Array.isArray(s) && typeof s === 'object';
const has = (done, id) => (done instanceof Set ? done.has(id) : Array.isArray(done) ? done.includes(id) : false);

export function matches(when, ctx) {
  for (const [k, v] of Object.entries(when ?? {})) {
    if (k === 'done') {
      if (!v.every((id) => has(ctx?.done, id))) return false;
    } else if (k === 'rank') {
      if ((ctx?.rank ?? 0) < v) return false;
    } else if ((ctx?.[k] ?? null) !== v) return false;
  }
  return true;
}

export function talkFor(says, ctx) {
  if (!says) return [];
  if (!isTree(says)) return says;
  return matches(says.when, ctx) ? talkFor(says.lines, ctx) : talkFor(says.else, ctx);
}

export function talkTree(says, path = 'says') {
  if (!says) return [];
  if (!isTree(says)) return [...says];
  for (const k of Object.keys(says.when ?? {})) if (!KEYS.includes(k)) throw new Error(`${path}.when: unknown key ${k}`);
  if (says.lines == null) throw new Error(`${path}: a branch needs lines`);
  if (says.else == null) throw new Error(`${path}: a branch needs an else`);
  return [...talkTree(says.lines, `${path}.lines`), ...talkTree(says.else, `${path}.else`)];
}
