// Saves a snapshot of my public GitHub (profile, repositories and the
// contribution calendar) to public/github.json. It runs before every build, so
// the site always has numbers to show even when the GitHub API is rate-limiting
// a visitor; the browser refreshes them when it can.
//
// Each of the three answers stands alone: if one fails (offline, a rate
// limit, the contributions API down), that part of the last snapshot is kept
// and the rest is fresh. The file is only written when something in it
// changed, so a build doesn't leave the tree dirty for the clock alone. Set
// GITHUB_TOKEN to raise the API limit (CI does).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const USER = 'tilakpatell';
const OUT = new URL('../public/github.json', import.meta.url);

// The snapshot from the three answers (Promise.allSettled's: the profile,
// the repositories, the contribution calendar), what failed taken from
// `previous`; null if there's nothing new, or not enough for a whole one.
export function snapshotOf([u, r, c], previous, now) {
  const next = { ...(previous ?? {}), fetchedAt: now };
  if (u.status === 'fulfilled') {
    const user = u.value;
    next.user = { login: user.login, name: user.name, avatar: user.avatar_url, url: user.html_url, publicRepos: user.public_repos };
  }
  if (r.status === 'fulfilled') {
    const own = r.value.filter((x) => !x.fork && !x.archived);
    const langs = {};
    for (const x of own) if (x.language) langs[x.language] = (langs[x.language] || 0) + 1;
    next.languages = Object.entries(langs).sort((a, b) => b[1] - a[1]);
    next.repos = own.slice(0, 6).map((x) => ({ name: x.name, url: x.html_url, desc: x.description, lang: x.language, pushed: x.pushed_at, stars: x.stargazers_count }));
  }
  const fresh = c.status === 'fulfilled' && Array.isArray(c.value.contributions);
  if (fresh) {
    const days = c.value.contributions;
    next.contributions = {
      total: c.value.total?.lastYear ?? days.reduce((n, d) => n + d.count, 0),
      start: days[0]?.date ?? null,
      counts: days.map((d) => d.count),
      levels: days.map((d) => d.level).join(''),
    };
  }
  const answered = u.status === 'fulfilled' || r.status === 'fulfilled' || fresh;
  return answered && next.user && next.repos && next.contributions ? next : null;
}

// the same but for when it was fetched
export const sameSnapshot = (a, b) => Boolean(a && b) && JSON.stringify({ ...a, fetchedAt: null }) === JSON.stringify({ ...b, fetchedAt: null });

async function main() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'tilakpatell.com build' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const get = async (url, h = headers) => {
    const res = await fetch(url, { headers: h, signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  };
  const previous = await readFile(OUT, 'utf8').then(JSON.parse, () => null);
  const answers = await Promise.allSettled([
    get(`https://api.github.com/users/${USER}`),
    get(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`),
    get(`https://github-contributions-api.jogruber.de/v4/${USER}?y=last`, { 'User-Agent': 'tilakpatell.com build' }),
  ]);
  const failed = answers.filter((a) => a.status === 'rejected').map((a) => a.reason?.message ?? String(a.reason));
  if (failed.length) console.warn(`github snapshot: ${failed.join('; ')}`);
  const snapshot = snapshotOf(answers, previous, new Date().toISOString());
  if (!snapshot) {
    console.warn(`github snapshot skipped; ${previous ? 'kept the existing one' : 'no snapshot yet; the site will fetch live'}`);
    return;
  }
  if (sameSnapshot(previous, snapshot)) {
    console.log('github.json: unchanged');
    return;
  }
  await writeFile(OUT, JSON.stringify(snapshot));
  console.log(`github.json: ${snapshot.contributions.total} contributions, ${snapshot.repos.length} repos shown, ${snapshot.languages.length} languages`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
