// Reference sheets from the Rick and Morty wiki, for judging the Meshy
// figures against the show.
//
//   node scripts/wiki-refs.mjs <wiki title …>
//
// For each title it writes two files under lab/meshy/refs/<slug>/ (lab/ is
// gitignored, like the concept images): ref.png, the page's infobox image at
// its original size, and ref.md, the page's Appearance section (else its
// intro) as plain text, with the page's address. A Meshy prompt is written
// against the sheet, and its concept, model and rig are judged against it
// (the accuracy gate in docs/superpowers/specs/2026-10-06-rick-and-morty-multiverse-design.md).
//
// The pages come from the wiki's MediaWiki API, 25 titles a call; redirects
// are followed, and the folder is named after the title as asked. Behind a
// proxy, Node's fetch may need NODE_USE_ENV_PROXY=1.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'lab', 'meshy', 'refs');
const WIKI = 'https://rickandmorty.fandom.com';
const API = `${WIKI}/api.php`;
const HEADERS = { 'User-Agent': 'tilakverse/1.0' };
const PER_CALL = 25;

// A title as a folder name: lower case, apostrophes dropped, every other run
// of anything but letters and digits a single hyphen.
export function slugOf(title) {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Every open…close span, nested pairs counted, that drop() says to remove is
// removed; the rest is kept as it is. An unclosed span is left alone.
function strip(text, open, close, drop) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf(open, i);
    if (start < 0) break;
    let depth = 0;
    let j = start;
    while (j < text.length) {
      if (text.startsWith(open, j)) {
        depth++;
        j += open.length;
      } else if (text.startsWith(close, j)) {
        depth--;
        j += close.length;
        if (depth === 0) break;
      } else j++;
    }
    if (depth !== 0) break;
    const span = text.slice(start, j);
    out += text.slice(i, start) + (drop(span) ? '' : span);
    i = j;
  }
  return out + text.slice(i);
}

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': '’' };

// Wikitext as plain text: templates, tables, galleries, references, comments
// and images gone, links reduced to the words they show, bold and italics
// unmarked, headings as plain lines, list items as “- ” lines.
function plain(wikitext) {
  let t = wikitext
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<gallery[^>]*>[\s\S]*?<\/gallery>/gi, '')
    .replace(/__[A-Z]+__/g, '');
  t = strip(t, '{{', '}}', () => true);
  t = strip(t, '{|', '|}', () => true);
  t = strip(t, '[[', ']]', (span) => /^\[\[\s*(file|image|category)\s*:/i.test(span));
  return t
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\]/g, '')
    .replace(/'{2,}/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, e) => ENTITIES[e])
    .split('\n')
    .map((line) =>
      line
        .replace(/^(=+)\s*(.*?)\s*\1\s*$/, '$2')
        .replace(/^[*#]+\s*/, '- ')
        .replace(/^[:;]+\s*/, '')
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .join('\n')
    .replace(/^- $/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// The page's Appearance section (its subsections too) as plain text; if it
// has none, or nothing but images in it, the intro before the first heading.
export function appearanceOf(wikitext) {
  const headings = [...wikitext.matchAll(/^(={1,6})\s*([^=\n].*?)\s*\1\s*$/gm)];
  const at = headings.findIndex((h) => /^(physical )?appearance$/i.test(h[2]));
  if (at >= 0) {
    const level = headings[at][1].length;
    const next = headings.slice(at + 1).find((h) => h[1].length <= level);
    const from = headings[at].index + headings[at][0].length;
    const text = plain(wikitext.slice(from, next ? next.index : wikitext.length));
    if (text) return text;
  }
  return plain(wikitext.slice(0, headings.length ? headings[0].index : wikitext.length));
}

function pageUrl(title) {
  const path = encodeURIComponent(title.replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%2F/g, '/');
  return `${WIKI}/wiki/${path}`;
}

// One batch of titles: each page's latest wikitext and its infobox image, by
// the title asked for (redirects and normalised spellings followed).
async function query(titles) {
  const pages = new Map();
  const moved = new Map();
  let more = {};
  do {
    const url = new URL(API);
    const params = {
      action: 'query',
      prop: 'revisions|pageimages',
      rvprop: 'content',
      rvslots: 'main',
      piprop: 'original',
      redirects: '1',
      titles: titles.join('|'),
      format: 'json',
      formatversion: '2',
      ...more,
    };
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`the wiki answered ${res.status} ${res.statusText}`);
    const json = await res.json();
    if (json.error) throw new Error(`the wiki said: ${json.error.info}`);
    for (const p of json.query?.pages ?? []) pages.set(p.title, { ...pages.get(p.title), ...p });
    for (const r of [...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])]) moved.set(r.from, r.to);
    more = json.continue;
  } while (more);
  return titles.map((asked) => {
    let title = asked;
    for (let hops = 0; hops < 5 && moved.has(title); hops++) title = moved.get(title);
    return { asked, page: pages.get(title) };
  });
}

// The infobox image as a PNG: the uploaded file itself (format=original, not
// the WebP the image server sends by default), converted only if it isn't one.
async function fetchImage(source) {
  const url = new URL(source);
  url.searchParams.set('format', 'original');
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`the image answered ${res.status} ${res.statusText}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const isPng = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return isPng ? bytes : sharp(bytes).png().toBuffer();
}

async function main() {
  const titles = process.argv.slice(2);
  if (!titles.length) {
    console.error('usage: node scripts/wiki-refs.mjs <wiki title …>');
    process.exit(1);
  }
  for (let i = 0; i < titles.length; i += PER_CALL) {
    for (const { asked, page } of await query(titles.slice(i, i + PER_CALL))) {
      if (!page || page.missing || page.invalid || !page.revisions) {
        console.warn(`${asked}: not on the wiki`);
        process.exitCode = 1;
        continue;
      }
      const dir = join(OUT, slugOf(asked));
      await mkdir(dir, { recursive: true });
      const text = appearanceOf(page.revisions[0].slots.main.content);
      await writeFile(join(dir, 'ref.md'), `# ${page.title}\n\n${pageUrl(page.title)}\n\n${text}\n`);
      let image = 'no infobox image';
      if (page.original?.source) {
        await writeFile(join(dir, 'ref.png'), await fetchImage(page.original.source));
        image = `ref.png ${page.original.width}×${page.original.height}`;
      } else process.exitCode = 1;
      console.log(`${asked} → lab/meshy/refs/${slugOf(asked)}/  ${image}, ref.md ${text.length} characters`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
