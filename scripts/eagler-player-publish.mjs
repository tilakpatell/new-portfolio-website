// Minecraft (Eaglercraft), the player published to its own origin:
//
//   node scripts/eagler-player-publish.mjs [--create]
//
// The player (public/eagler-player/index.html) is the page the game runs in,
// on an origin of its own, so the game's code and saves are walled off from
// tilakpatell.com. This copies it, with the two modules it uses
// (src/components/eagler/crypt.js and load.js, its imports pointed at the
// copies), into the tilakpatell/minecraft-player repository, which GitHub
// Pages serves at https://tilakpatell.github.io/minecraft-player/. It holds
// no game file and no secret: the sealed files stay on tilakpatell.com, and
// the player only opens what the site sends it the key for. --create makes
// the repository and turns Pages on, the first time.
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = 'tilakpatell/minecraft-player';
const create = process.argv.includes('--create');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts });

if (create) {
  run('gh', ['repo', 'create', REPO, '--public', '--description', 'The player for tilakpatell.com’s Minecraft: the page the game runs in, on an origin of its own']);
}
const dir = await mkdtemp(join(tmpdir(), 'mc-player-'));
try {
  run('git', ['clone', '--quiet', `https://github.com/${REPO}.git`, dir]);
  const html = (await readFile(join(ROOT, 'public/eagler-player/index.html'), 'utf8'))
    .replace("from '/src/components/eagler/crypt.js'", "from './crypt.js'")
    .replace("from '/src/components/eagler/load.js'", "from './load.js'");
  if (html.includes('/src/')) throw new Error('the player still imports from /src/');
  await writeFile(join(dir, 'index.html'), html);
  await copyFile(join(ROOT, 'src/components/eagler/crypt.js'), join(dir, 'crypt.js'));
  await copyFile(join(ROOT, 'src/components/eagler/load.js'), join(dir, 'load.js'));
  await writeFile(join(dir, '.nojekyll'), '');
  await writeFile(
    join(dir, 'README.md'),
    `# The Minecraft player\n\nThe page [tilakpatell.com](https://tilakpatell.com/dot-matrix/minecraft)’s Minecraft runs in, on an origin of its own so the game is walled off from the site. It holds no game files and no secrets: the site sends it the key for one sealed file, and it opens that file and becomes the game.\n\nPublished from the site’s repository by \`scripts/eagler-player-publish.mjs\`; change it there, not here.\n`,
  );
  const changed = run('git', ['status', '--porcelain'], { cwd: dir }).trim();
  if (!changed) console.log('the player is already up to date');
  else {
    run('git', ['add', '-A'], { cwd: dir });
    run('git', ['commit', '--quiet', '-m', 'The player, from the site’s public/eagler-player.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'], { cwd: dir });
    run('git', ['push', '--quiet', 'origin', 'HEAD:main'], { cwd: dir });
    console.log(`pushed to ${REPO}`);
  }
  if (create) {
    run('gh', ['api', `repos/${REPO}/pages`, '-X', 'POST', '-f', 'source[branch]=main', '-f', 'source[path]=/']);
    console.log('GitHub Pages is on: https://tilakpatell.github.io/minecraft-player/ (its first build takes a minute)');
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
