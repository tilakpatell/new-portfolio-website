import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromEnv, held, labels } from './jobs.mjs';
import { fields, imageUrls, isImage, localDir, normaliseForm, ready, tail, trusted, urlIn } from './lib.mjs';

describe("an issue's fields", () => {
  it('reads one a line, and several to a line when two spaces part them', () => {
    const keys = ['what', 'faces', 'tex', 'prompt'];
    expect(fields('what: Cecil\nfaces: 30000  tex: 2048', keys)).toEqual({ what: 'Cecil', faces: '30000', tex: '2048' });
    expect(fields('faces: 30000\ttex: 2048', keys)).toEqual({ faces: '30000', tex: '2048' });
  });
  it("leaves a prompt's own colons in the prompt", () => {
    expect(fields('prompt: a ship, colours: red and white', ['prompt', 'faces'])).toEqual({ prompt: 'a ship, colours: red and white' });
    expect(fields('prompt: a ship  note: x', ['prompt', 'faces'])).toEqual({ prompt: 'a ship  note: x' });
  });
  it('keeps the first of a key given twice, and reads bold or bulleted keys', () => {
    expect(fields('what: one\nwhat: two')).toEqual({ what: 'one' });
    expect(fields('- **what**: a TIE\n* faces: 4000')).toEqual({ what: 'a TIE', faces: '4000' });
  });
  it("reads an issue form's sections as fields, skipping the unanswered", () => {
    const form = '### what\n\nan old redwood stump\n\n### image\n\n_No response_\n\n### faces\n\n6000\n\n### more\n\nseed: 7\nbake: no';
    expect(normaliseForm(form)).toBe('what: an old redwood stump\nfaces: 6000\nseed: 7\nbake: no');
    expect(fields(form, ['what', 'faces', 'seed', 'bake'])).toEqual({ what: 'an old redwood stump', faces: '6000', seed: '7', bake: 'no' });
  });
  it("keeps a form's who: text lines as lines", () => {
    expect(normaliseForm('### only\n\nrick, morty\n\n### lines\n\nrick: Wubba lubba.\nmorty: Aw geez.')).toBe('only: rick, morty\nrick: Wubba lubba.\nmorty: Aw geez.');
  });
  it('leaves a plain body alone, and keeps what comes before a heading', () => {
    expect(normaliseForm('what: x\nfaces: 3')).toBe('what: x\nfaces: 3');
    expect(fields('what: a TIE\nprompt: a TIE fighter\n\n### Notes\n\nfor the hangar', ['what', 'prompt'])).toEqual({ what: 'a TIE', prompt: 'a TIE fighter', notes: 'for the hangar' });
  });
  it("keys a form's readable headings by their first word", () => {
    expect(normaliseForm('### What it is\n\na TIE\n\n### Image (a picture to follow)\n\nhttps://x.test/t.png')).toBe('what: a TIE\nimage: https://x.test/t.png');
  });
});

describe('pictures in an issue', () => {
  it('finds markdown images and img tags in order, once each', () => {
    const body = '![a](https://x.test/1.png)\n<img width="300" src="https://x.test/2.webp" />\n![a again](https://x.test/1.png)';
    expect(imageUrls(body)).toEqual(['https://x.test/1.png', 'https://x.test/2.webp']);
  });
  it("takes a field's URL whether bare, a markdown image or a link", () => {
    expect(urlIn('https://static.wikia.nocookie.net/a/b.png/revision/latest')).toBe('https://static.wikia.nocookie.net/a/b.png/revision/latest');
    expect(urlIn('![Cecil](https://x.test/c.png)')).toBe('https://x.test/c.png');
    expect(urlIn('see (https://x.test/c.png).')).toBe('https://x.test/c.png');
    expect(urlIn('attached below')).toBeUndefined();
  });
  it('knows a picture by its first bytes', () => {
    expect(isImage(Buffer.from('89504e470d0a1a0a0000000d', 'hex'))).toBe(true);
    expect(isImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe(true);
    expect(isImage(Buffer.from('ffd8ffe000104a4649460001', 'hex'))).toBe(true);
    expect(isImage(Buffer.from('<!DOCTYPE html><html>'))).toBe(false);
  });
});

describe('who may queue work on the desktop', () => {
  const l = labels({ label: 'gen3d' });
  const issue = (over) => ({ number: 1, state: 'open', labels: ['gen3d'], author_association: 'OWNER', user: { login: 'tilakpatell' }, ...over });
  it('the owner, collaborators and the workflows, not a stranger', () => {
    expect(trusted(issue())).toBe(true);
    expect(trusted(issue({ author_association: 'COLLABORATOR' }))).toBe(true);
    expect(trusted(issue({ author_association: 'NONE', user: { login: 'github-actions[bot]' } }))).toBe(true);
    expect(trusted(issue({ author_association: 'NONE', user: { login: 'someone' } }))).toBe(false);
    expect(trusted(issue({ author_association: 'CONTRIBUTOR', user: { login: 'someone' } }))).toBe(false);
  });
  it('takes an open, labelled job that is not running or failed', () => {
    expect(ready(issue(), l).ok).toBe(true);
    expect(ready(issue({ labels: ['gen3d', 'gen3d:waiting'] }), l).ok).toBe(true);
    expect(ready(issue({ labels: ['gen3d', 'gen3d:running'] }), l).why).toMatch(/running/);
    expect(ready(issue({ labels: ['gen3d', 'gen3d:failed'] }), l).why).toMatch(/remove the label/);
    expect(ready(issue({ state: 'closed' }), l).ok).toBe(false);
    expect(ready(issue({ author_association: 'NONE', user: { login: 'x' } }), l).why).toMatch(/not the owner/);
  });
});

describe('the plumbing', () => {
  it("reads a dispatch's inputs from the environment", () => {
    expect(fromEnv({ INPUT_NAME: 'cecil', INPUT_WHAT: 'Cecil', INPUT_PROMPT: '', PATH: 'x' })).toEqual({ name: 'cecil', what: 'Cecil' });
  });
  it("keeps a log's last lines", () => {
    expect(tail('a\n\nb\nc\n', 2)).toBe('b\nc');
  });
  it("defers to a hold someone else put on the pipeline's files", () => {
    const home = mkdtempSync(join(tmpdir(), 'hold-'));
    expect(held('voices', home)).toBeNull();
    writeFileSync(join(home, 'voices.lock'), '');
    expect(held('voices', home)).toMatch(/voices\.lock is there/);
    writeFileSync(join(home, 'voices.lock'), String(process.pid));
    expect(held('voices', home)).toMatch(new RegExp(`held by process ${process.pid}`));
    writeFileSync(join(home, 'voices.lock'), '999999999');
    expect(held('voices', home)).toBeNull(); // a pid that's gone holds nothing
  });
  it("finds a tool in the Claude app's boxed AppData when the real one has none", () => {
    const base = mkdtempSync(join(tmpdir(), 'local-'));
    const boxed = join(base, 'Packages', 'Claude_abc123', 'LocalCache', 'Local', 'sdcpp');
    mkdirSync(boxed, { recursive: true });
    expect(localDir('sdcpp', base)).toBe(boxed);
    mkdirSync(join(base, 'sdcpp'));
    writeFileSync(join(base, 'sdcpp', 'x'), '');
    expect(localDir('sdcpp', base)).toBe(join(base, 'sdcpp'));
    expect(localDir('nothing', base)).toBe(join(base, 'nothing'));
  });
});

describe('a job’s name', () => {
  it('drops a pipeline’s prefix written as one (gen3d: …, 3D - …)', async () => {
    const { slug } = await import('./lib.mjs');
    expect(slug('gen3d: TIE Fighter')).toBe('tie-fighter');
    expect(slug('3D - a cactus')).toBe('a-cactus');
    expect(slug('voices: Citadel cops')).toBe('citadel-cops');
    expect(slug('motion: Overhead strike')).toBe('overhead-strike');
  });
  it('keeps a name that only starts with such a word, and reads its own output back the same', async () => {
    const { slug } = await import('./lib.mjs');
    expect(slug('model-627')).toBe('model-627');
    expect(slug('3d-printer')).toBe('3d-printer');
    expect(slug('Voice Box')).toBe('voice-box');
    for (const name of ['Model 627', '3d printer', 'Audio Desk', 'gen3d: X-wing']) expect(slug(slug(name)), name).toBe(slug(name));
  });
});
