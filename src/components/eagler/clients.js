// Minecraft (Eaglercraft), the clients the page offers, newest first, and how
// each offline file is changed before it's sealed (scripts/eagler-pack.mjs):
// 1.12.2's five-second "this file is from…" countdown goes (the page has its
// own loading screen; lax1dude's signed 1.8 file has none), and each version
// keeps its worlds, packs and settings apart under the site's own names, so
// no two read each other's saves. A patch that doesn't find its text fails
// the build rather than shipping a client that's quietly different.
//
// Only the clients sealed into public/eagler/ appear on the page: the
// 1.21.11 beta is listed here, ready, until its file is sealed (see
// docs/superpowers/HANDOFF-eaglercraft.md).

export const CLIENTS = {
  // Syntaxsavy's port of 1.21.11 (u1-beta), WebAssembly GC with JSPI: its patch is untried until the file is in hand
  '1.21.11': {
    label: 'Minecraft 1.21.11 (beta)',
    note: 'The real 1.21.11, still a beta: Chrome or Edge only, heavy on memory, no world import or LAN yet.',
    needs: 'jspi',
    patches: [['worldsDB: "worlds",', 'worldsDB: "tp_worlds_1_21", localStorageNamespace: "tp_1_21",']],
  },
  '1.12.2': {
    label: 'Minecraft 1.12.2',
    note: 'The World of Color, concrete, parrots, the 1.9 combat; worlds import, export and open to LAN.',
    patches: [
      ['worldsDB: "worlds",', 'worldsDB: "tp_worlds_1_12", resourcePacksDB: "tp_packs_1_12", localStorageNamespace: "tp_1_12",'],
      ['if(++launchCounter > 100 || launchSkipCountdown) {', 'if(true) {'],
    ],
  },
  // lax1dude's signed offline build (EaglercraftX_1.8_u53_Offline_Signed): its options are "hints"
  '1.8.8': {
    label: 'Minecraft 1.8.8',
    note: 'The steadiest: lax1dude’s EaglercraftX, the one most servers run.',
    patches: [['worldsDB: "worlds",', 'worldsDB: "tp_worlds_1_8", resourcePacksDB: "tp_packs_1_8", localStorageNamespace: "tp_1_8",']],
  },
};

// the client's file with its patches made; throws if any patch finds nothing
export function patchClient(id, html) {
  const c = CLIENTS[id];
  if (!c) throw new Error(`no client called ${id}`);
  let out = html;
  for (const [from, to] of c.patches) {
    if (!out.includes(from)) throw new Error(`${id}: the patch for "${from.slice(0, 40)}" found nothing`);
    out = out.replace(from, to);
  }
  return out;
}

// whether this browser can run a client (the beta needs WebAssembly's JSPI: Chromium 137 and up)
export function canRun(client, g = globalThis) {
  if (client?.needs === 'jspi') return typeof g.WebAssembly?.Suspending === 'function';
  return true;
}

// a shared world to seal, from "--world <client>:<name>=<file>": an exported .epk or a vanilla world's .zip
export function parseWorldArg(arg) {
  const colon = arg.indexOf(':');
  const eq = arg.indexOf('=');
  if (colon <= 0 || eq <= colon + 1 || eq === arg.length - 1) throw new Error(`"${arg}": a world is <client>:<name>=<file>`);
  const client = arg.slice(0, colon);
  const name = arg.slice(colon + 1, eq).trim();
  const path = arg.slice(eq + 1);
  if (!name) throw new Error(`"${arg}": a world is <client>:<name>=<file>`);
  if (!CLIENTS[client]) throw new Error(`no client called ${client}`);
  const kind = /\.epk$/i.test(path) ? 'epk' : /\.zip$/i.test(path) ? 'zip' : null;
  if (!kind) throw new Error(`${path}: a world is an .epk or .zip the game can import`);
  // its id from its name; a name of no Latin letters or digits takes a short hash of itself
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) {
    let h = 0x811c9dc5;
    for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
    slug = `w${h.toString(16)}`;
  }
  const id = `${slug}-${client.replace(/\./g, '-')}`;
  return { client, name, path, id, kind };
}
