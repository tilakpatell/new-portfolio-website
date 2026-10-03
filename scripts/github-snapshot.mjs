// Saves a snapshot of my public GitHub (profile, repositories and the
// contribution calendar) to public/github.json. It runs before every build, so
// the site always has numbers to show even when the GitHub API is rate-limiting
// a visitor; the browser refreshes them when it can.
//
// If anything fails (offline, rate limit), the existing snapshot is kept and the
// build carries on. Set GITHUB_TOKEN to raise the API limit (CI does).
import { readFile, writeFile } from 'node:fs/promises';

const USER = 'tilakpatell';
const OUT = new URL('../public/github.json', import.meta.url);
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'tilakpatell.com build' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const get = async (url, h = headers) => {
  const res = await fetch(url, { headers: h, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

try {
  const [user, repos, contrib] = await Promise.all([
    get(`https://api.github.com/users/${USER}`),
    get(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`),
    get(`https://github-contributions-api.jogruber.de/v4/${USER}?y=last`, { 'User-Agent': 'tilakpatell.com build' }),
  ]);
  const own = repos.filter((r) => !r.fork && !r.archived);
  const langs = {};
  for (const r of own) if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  const days = contrib.contributions ?? [];
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    user: { login: user.login, name: user.name, avatar: user.avatar_url, url: user.html_url, publicRepos: user.public_repos },
    languages: Object.entries(langs).sort((a, b) => b[1] - a[1]),
    repos: own.slice(0, 6).map((r) => ({ name: r.name, url: r.html_url, desc: r.description, lang: r.language, pushed: r.pushed_at, stars: r.stargazers_count })),
    contributions: {
      total: contrib.total?.lastYear ?? days.reduce((n, d) => n + d.count, 0),
      start: days[0]?.date ?? null,
      counts: days.map((d) => d.count),
      levels: days.map((d) => d.level).join(''),
    },
  };
  await writeFile(OUT, JSON.stringify(snapshot));
  console.log(`github.json: ${snapshot.contributions.total} contributions, ${own.length} repos, ${snapshot.languages.length} languages`);
} catch (e) {
  const kept = await readFile(OUT, 'utf8').then(() => 'kept the existing snapshot', () => 'no snapshot yet; the site will fetch live');
  console.warn(`github snapshot skipped (${e.message}); ${kept}`);
}
