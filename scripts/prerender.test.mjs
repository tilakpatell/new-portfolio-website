import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { projects } from '../src/data/projects.js';
import { roles } from '../src/data/roles.js';
import { profile } from '../src/data/profile.js';
import { UNIVERSES } from '../src/components/universe/universes.js';
import { SYSTEMS } from '../src/components/galaxy/systems.js';
import { FEED } from '../src/components/feed/feed.js';
import { pageHtml, routesFrom, sitemap } from './prerender.mjs';

const data = { projects, roles, profile, universes: UNIVERSES, systems: SYSTEMS, feed: FEED };
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('a page of its own for each route, for links and search', () => {
  const routes = routesFrom(data);
  const at = (p) => routes.find((r) => r.path === p);

  it('has every portfolio page, project, role, world and star system, once each', () => {
    for (const c of FEED) expect(at(c.to), c.to).toBeTruthy();
    for (const p of projects) expect(at(`/projects/${p.id}`)?.description).toBe(p.summary);
    for (const r of roles) expect(at(`/experience/${r.id}`)?.description).toContain(r.summary);
    for (const u of UNIVERSES.filter((x) => x.world)) expect(at(u.to), u.to).toBeTruthy();
    expect(at('/deathstar')).toBeTruthy();
    for (const s of SYSTEMS) expect(at(`/galaxy/${s.id}`), s.id).toBeTruthy();
    const paths = routes.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p).toMatch(/^\/[a-z0-9/-]+$/);
    expect(paths).not.toContain('/');
  });

  it('titles a page as the site does, and describes it', () => {
    const p = projects[0];
    expect(at(`/projects/${p.id}`).title).toBe(`${p.title} | Tilak Patel`);
    for (const r of routes) {
      expect(r.title.length, r.path).toBeGreaterThan(0);
      expect(r.description.length, r.path).toBeGreaterThan(20);
    }
  });

  it('writes the page: its title, description, preview card and address', () => {
    const html = pageHtml(index, { path: '/projects/x', title: 'A & B “quoted” | Tilak Patel', description: 'Says <this> & that.' });
    expect(html).toContain('<title>A &amp; B “quoted” | Tilak Patel</title>');
    expect(html).toContain('<meta name="description" content="Says &lt;this&gt; &amp; that." />');
    expect(html).toContain('<meta property="og:title" content="A &amp; B “quoted” | Tilak Patel" />');
    expect(html).toContain('<meta property="og:description" content="Says &lt;this&gt; &amp; that." />');
    expect(html).toContain('<meta property="og:url" content="https://tilakpatell.com/projects/x" />');
    expect(html).toContain('<meta name="twitter:title" content="A &amp; B “quoted” | Tilak Patel" />');
    expect(html).toContain('<link rel="canonical" href="https://tilakpatell.com/projects/x" />');
    // the page's own JSON-LD and the rest are left as they were
    expect(html).toContain('"@type": "Person"');
  });

  it('moves the visitor onto the app’s own address before anything else runs', () => {
    const html = pageHtml(index, { path: '/galaxy/hoth', title: 'T', description: 'D, long enough to describe it.' });
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    const first = head.indexOf('<script');
    expect(head.slice(first)).toMatch(/^<script>history\.replaceState\(history\.state, '', '\/#' \+ "\/galaxy\/hoth" \+ location\.search\);<\/script>/);
    // after the charset, which has to come first
    expect(head.indexOf('charset')).toBeLessThan(first);
  });

  it('lists every page in the sitemap, with the front door', () => {
    const xml = sitemap([{ path: '/a' }, { path: '/b&c' }], 'https://tilakpatell.com', '2026-10-06');
    expect(xml).toContain('<loc>https://tilakpatell.com/</loc>');
    expect(xml).toContain('<loc>https://tilakpatell.com/a</loc>');
    expect(xml).toContain('<loc>https://tilakpatell.com/b&amp;c</loc>');
    expect(xml.match(/<lastmod>2026-10-06<\/lastmod>/g)).toHaveLength(3);
  });
});
