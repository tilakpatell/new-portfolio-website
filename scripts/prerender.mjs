// A page of its own for each of the site's routes, written next to the
// build. The site's routes are hash routes (/#/projects/x), and what's after
// the # never reaches a server: a link shared anywhere, or a search engine,
// saw only the front door's title, description and preview card. So each
// route gets dist/<route>/index.html, a copy of the app's index.html with its
// own title, description, preview card and canonical address, and a first
// line that moves the visitor onto the app's own address (/#/<route>)
// before the app starts. And a sitemap of them all.
//
// A Vite plugin (vite.config.js) runs it after every build; the functions
// it uses are tested (prerender.test.mjs).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SITE = 'https://tilakpatell.com';
const NAME = 'Tilak Patel';
const titled = (t) => `${t} | ${NAME}`;

// Every route worth a page: the portfolio's six, each role and project, the
// worlds and the galaxy's systems, and the few pages besides.
// → [{ path, title, description }]
export function routesFrom({ projects, roles, profile, universes, systems, feed }) {
  const featured = projects.filter((p) => p.featured).map((p) => p.title);
  const pages = {
    home: { title: `${NAME} | TPM & Software Engineer`, description: profile.lead },
    experience: { title: titled('Experience'), description: `Every role, from ${roles[0].company} to ${roles[roles.length - 1].company}: ${roles.map((r) => `${r.shortTitle ?? r.title} at ${r.short ?? r.company}`).join('; ')}.` },
    projects: { title: titled('Projects'), description: `Projects you can play with, each with a live demo: ${featured.join(', ')}.` },
    resume: { title: titled('Résumé'), description: `${NAME}’s résumé on one page, filterable by skill, and the PDF: ${profile.identity}.` },
    travel: { title: titled('Travel'), description: `The places ${NAME} has been, on a globe you can spin, with photos from each.` },
    contact: { title: titled('Contact'), description: `How to reach ${NAME}: email, GitHub and LinkedIn. ${profile.focus}` },
  };
  const out = feed.map((c) => ({ path: c.to, ...pages[c.id] }));
  // (titled as the app titles a role: its company, on the experience page)
  for (const r of roles) out.push({ path: `/experience/${r.id}`, title: titled(`${r.company} · Experience`), description: `${r.title}, ${r.company}: ${r.summary}` });
  for (const p of projects) out.push({ path: `/projects/${p.id}`, title: titled(p.title), description: p.summary });
  out.push({ path: '/universe', title: titled('The universe'), description: `${NAME}’s site as a universe to fly through: the portfolio as stations round a sun, and a fan-made world on each planet.` });
  for (const u of universes.filter((x) => x.world)) {
    out.push({ path: u.to, title: titled(u.world), description: `${u.world}: a fan-made ${u.label} world to explore on ${NAME}’s site, with games to play in it.` });
    for (const p of u.pages ?? []) out.push({ path: p.to, title: titled(p.world), description: `${p.world}: part of ${u.world}, a fan-made ${u.label} world on ${NAME}’s site.` });
  }
  for (const s of systems) out.push({ path: `/galaxy/${s.id}`, title: titled(`${s.name} · A galaxy far, far away`), description: s.about });
  out.push({ path: '/terminal', title: titled('Terminal'), description: `An Imperial terminal that takes commands: ${NAME}’s work, and a few things to find. Try help.` });
  out.push({ path: '/changes', title: titled('What’s changed'), description: `The ship’s log: every change the site’s autopilot has made, with a picture, and how to undo it.` });
  out.push({ path: '/worlds', title: titled('Worlds'), description: `The worlds you’ve made on ${NAME}’s site, kept on your device: continue one, rename it, or take it with you as a file; and the 3D worlds installed to open without the wait.` });
  return out;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The app's index.html, made the page for one route.
export function pageHtml(html, { path, title, description }, site = SITE) {
  const url = `${site}${path}`;
  const t = esc(title);
  const d = esc(description);
  const meta = (attr, key, value) => (h) => h.replace(new RegExp(`<meta ${attr}="${key}" content="[^"]*" />`), `<meta ${attr}="${key}" content="${value}" />`);
  const steps = [
    (h) => h.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`),
    meta('name', 'description', d),
    meta('property', 'og:title', t),
    meta('property', 'og:description', d),
    meta('property', 'og:url', esc(url)),
    meta('name', 'twitter:title', t),
    meta('name', 'twitter:description', d),
    (h) => h.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${esc(url)}" />`),
    // first thing after the charset: onto the app's address (/#/route), so
    // the app (and the first visit's intro, which only plays at the front
    // door) sees the route
    (h) => h.replace(/(<meta charset="[^"]*" \/>)/, `$1\n    <script>history.replaceState(history.state, '', '/#' + ${JSON.stringify(path)} + location.search);</script>`),
  ];
  return steps.reduce((h, f) => f(h), html);
}

// The sitemap: the front door and every route's page.
export function sitemap(routes, site = SITE, lastmod = new Date().toISOString().slice(0, 10)) {
  const url = (p) => `  <url><loc>${esc(`${site}${p}`)}</loc><lastmod>${lastmod}</lastmod></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[url('/'), ...routes.map((r) => url(r.path))].join('\n')}\n</urlset>\n`;
}

// After a build: the pages and the sitemap into the build's folder.
export default function prerender() {
  let outDir = 'dist';
  let root = process.cwd();
  let failed = false;
  return {
    name: 'prerender-routes',
    apply: 'build',
    configResolved(c) {
      root = c.root;
      outDir = resolve(c.root, c.build.outDir);
    },
    // closeBundle runs after a failed build too, and Vite doesn't hand it the
    // error, so the failure is noted where it happens: there's no index.html
    // then, and failing on that would hide the build's own error
    buildStart() {
      failed = false;
    },
    buildEnd(error) {
      if (error) failed = true;
    },
    renderError() {
      failed = true;
    },
    async closeBundle(error) {
      if (error || failed) return;
      const load = (p) => import(pathToFileURL(join(root, p)).href);
      const [{ projects }, { roles }, { profile }, { UNIVERSES }, { SYSTEMS }, { FEED }] = await Promise.all(['src/data/projects.js', 'src/data/roles.js', 'src/data/profile.js', 'src/components/universe/universes.js', 'src/components/galaxy/systems.js', 'src/components/feed/feed.js'].map(load));
      const routes = routesFrom({ projects, roles, profile, universes: UNIVERSES, systems: SYSTEMS, feed: FEED });
      const index = await readFile(join(outDir, 'index.html'), 'utf8');
      await Promise.all(
        routes.map(async (r) => {
          const dir = join(outDir, r.path);
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, 'index.html'), pageHtml(index, r));
        }),
      );
      await writeFile(join(outDir, 'sitemap.xml'), sitemap(routes));
    },
  };
}
