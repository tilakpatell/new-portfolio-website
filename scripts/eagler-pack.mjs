// Minecraft (Eaglercraft), the game files sealed for the site:
//
//   EAGLER_PASSWORD=… node scripts/eagler-pack.mjs --client 1.12.2=<offline .html> [--client 1.8.8=<offline .html>]
//                     [--world "1.12.2:The Island=<exported .epk or vanilla .zip>"] [--new-password]
//
// Each offline client (an Eaglercraft offline HTML file, kept outside the
// repository) is patched (src/components/eagler/clients.js), gzipped and
// sealed with the password (src/components/eagler/crypt.js) into
// public/eagler/<id>.bin; a shared world (one exported from the game) is
// sealed the same way into public/eagler/worlds/. public/eagler/manifest.json
// gets the salt, the rounds, a check value (a known line sealed with the same
// key, so a wrong password fails before 20 MB are fetched), the clients and
// the worlds. Clients and worlds not named keep their entries.
//
// The password must open the manifest that's there: a typo would otherwise
// re-key the whole site. Changing it (or the lock's format) takes
// --new-password, a new salt, and every client and world named again. A
// client whose patched file hasn't changed keeps its sealed bytes (its
// SHA-256 is in the manifest), and the gzip header is the same on every
// machine, so a rebuild adds nothing to git. Everything is worked out in
// memory first and written only when it has all succeeded. The password
// comes from the environment and is never written down. (EAGLER_OUT seals
// somewhere else, for a trial run.)
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { CLIENTS, parseWorldArg, patchClient } = await load('src/components/eagler/clients.js');
const { CHECK, ITERATIONS, deriveKeys, fromBase64, open, seal, toBase64 } = await load('src/components/eagler/crypt.js');
const OUT = process.env.EAGLER_OUT ? resolve(process.env.EAGLER_OUT) : join(ROOT, 'public/eagler');
const fail = (msg) => {
  console.error(msg);
  process.exit(2);
};
const exists = (p) => stat(p).then(() => true, () => false);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
// gzip with the header's OS byte fixed (255, "unknown"), so Windows and Linux write the same bytes
const gzip = (bytes) => {
  const gz = gzipSync(bytes, { level: 9 });
  gz[9] = 255;
  return gz;
};

const password = process.env.EAGLER_PASSWORD;
if (!password) fail('set EAGLER_PASSWORD (it is never written anywhere)');
const args = process.argv.slice(2);
const named = {};
const worlds = [];
let fresh = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--client') {
    const [id, ...path] = (args[++i] ?? '').split('=');
    if (!CLIENTS[id] || !path.join('=')) fail(`--client wants <id>=<file>, with id one of ${Object.keys(CLIENTS).join(', ')}`);
    named[id] = path.join('=');
  } else if (args[i] === '--world') worlds.push(parseWorldArg(args[++i] ?? ''));
  else if (args[i] === '--new-password') fresh = true;
  else fail(`what is ${args[i]}?`);
}
// every file there before anything is sealed, and no two worlds with one id
for (const path of [...Object.values(named), ...worlds.map((w) => w.path)]) if (!(await exists(path))) fail(`no such file: ${path}`);
const ids = new Set();
for (const w of worlds) {
  if (ids.has(w.id)) fail(`two worlds come out as "${w.id}": name one differently`);
  ids.add(w.id);
}

const old = JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8').catch(() => 'null'));
let salt = null;
let keys = null;
let same = false;
if (old?.kdf?.salt && old?.check) {
  salt = fromBase64(old.kdf.salt);
  keys = await deriveKeys(password, salt, old.kdf.iterations);
  same = await open(keys, fromBase64(old.check)).then((b) => new TextDecoder().decode(b) === CHECK, () => false);
}
if (old && !same && !fresh) fail("that password doesn't open the manifest that's there; a typo? (to change the password, or after the lock's format changes, add --new-password and name every client and world)");
if (!same) {
  salt = new Uint8Array(randomBytes(16));
  keys = await deriveKeys(password, salt, ITERATIONS);
}

// what's kept from before: the clients still in the table (and their worlds), and only under the same key
const keptClients = new Map();
for (const c of same ? old.clients : []) {
  if (CLIENTS[c.id]) keptClients.set(c.id, c);
  else console.log(`dropping ${c.id}: no longer a client`);
}
if (!same) {
  const missing = [...(old?.clients ?? []).map((c) => c.id).filter((id) => CLIENTS[id] && !named[id]), ...(old?.worlds ?? []).map((w) => w.id).filter((id) => !ids.has(id))];
  if (missing.length) fail(`a new password (or lock): seal every client and world again; missing ${missing.join(', ')}`);
}

// the work, in memory: sealed bytes to write, and the entries for the manifest
const writes = [];
const clients = new Map(keptClients);
for (const [id, path] of Object.entries(named)) {
  const plain = new TextEncoder().encode(patchClient(id, await readFile(path, 'utf8')));
  const hash = sha(plain);
  const was = keptClients.get(id);
  const entry = { id, label: CLIENTS[id].label, note: CLIENTS[id].note, ...(CLIENTS[id].needs ? { needs: CLIENTS[id].needs } : {}), file: `${id}.bin`, plainBytes: plain.length, sha256: hash };
  if (same && was?.sha256 === hash && (await exists(join(OUT, was.file)))) {
    clients.set(id, { ...entry, bytes: was.bytes });
    console.log(`${id}: unchanged, kept`);
    continue;
  }
  const sealed = await seal(keys, gzip(plain));
  writes.push([entry.file, sealed]);
  clients.set(id, { ...entry, bytes: sealed.length });
  console.log(`${id}: ${(plain.length / 1e6).toFixed(1)} MB → ${(sealed.length / 1e6).toFixed(1)} MB sealed`);
}
const worldEntries = new Map((same ? (old.worlds ?? []) : []).filter((w) => clients.has(w.client)).map((w) => [w.id, w]));
for (const w of worlds) {
  if (!clients.has(w.client)) fail(`the world "${w.name}" is for ${w.client}, which isn't sealed: the page would never show it`);
  const was = worldEntries.get(w.id);
  if (was && was.name !== w.name) fail(`"${w.name}" comes out as "${w.id}", already "${was.name}": name it differently`);
  const bytes = new Uint8Array(await readFile(w.path));
  const sealed = await seal(keys, gzip(bytes));
  writes.push([`worlds/${w.id}.bin`, sealed]);
  worldEntries.set(w.id, { id: w.id, name: w.name, client: w.client, kind: w.kind, file: `worlds/${w.id}.bin`, bytes: sealed.length, sha256: sha(bytes) });
  console.log(`world "${w.name}" for ${w.client}: ${(sealed.length / 1e6).toFixed(1)} MB sealed`);
}

const order = Object.keys(CLIENTS);
const manifest = {
  v: 2,
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: same ? old.kdf.iterations : ITERATIONS, salt: toBase64(salt), expand: 'HKDF-SHA-256' },
  check: toBase64(await seal(keys, new TextEncoder().encode(CHECK))),
  clients: [...clients.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
  worlds: [...worldEntries.values()].sort((a, b) => a.name.localeCompare(b.name)),
};
// every file the manifest names will be there
const writing = new Set(writes.map(([f]) => f));
for (const e of [...manifest.clients, ...manifest.worlds]) if (!writing.has(e.file) && !(await exists(join(OUT, e.file)))) fail(`the manifest would name ${e.file}, which isn't there`);

// all worked out: written now, each file in place whole (a temporary name, then renamed)
const put = async (rel, bytes) => {
  const to = join(OUT, rel);
  await mkdir(dirname(to), { recursive: true });
  await writeFile(`${to}.part`, bytes);
  await rename(`${to}.part`, to);
};
for (const [rel, bytes] of writes) await put(rel, bytes);
await put('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`manifest: ${manifest.clients.map((c) => c.id).join(', ')}${manifest.worlds.length ? `; worlds: ${manifest.worlds.map((w) => w.name).join(', ')}` : ''}${same ? '' : ' (new salt)'}`);
