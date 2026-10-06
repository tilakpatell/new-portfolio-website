import { describe, expect, it } from 'vitest';
import { creditOf, hasSkin, largest, licenseOk, options, rank, slugOf } from './model-scout.mjs';

const model = (uid, likeCount, faceCount, extra = {}) => ({ uid, likeCount, faceCount, ...extra });
const uids = (list) => list.map((m) => m.uid);

// a GLB of nothing but its JSON chunk, as a downloaded one starts
function glb(json) {
  const text = Buffer.from(JSON.stringify(json));
  const body = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + body.length, 8);
  head.writeUInt32LE(body.length, 12);
  head.write('JSON', 16, 'ascii');
  return Buffer.concat([head, body]);
}

describe('the scout’s licences', () => {
  it('takes CC0 and the Attribution licences that allow changes', () => {
    for (const slug of ['cc0', 'by', 'by-sa', 'by-nc', 'by-nc-sa']) expect(licenseOk(slug)).toBe(true);
  });

  it('never takes a no-derivatives licence, a store licence or none', () => {
    for (const slug of ['by-nd', 'by-nc-nd', 'st', 'free-st', 'ed', '', undefined, null]) expect(licenseOk(slug)).toBe(false);
  });
});

describe('the scout’s ranking', () => {
  it('puts the most liked first', () => {
    expect(uids(rank([model('a', 2, 30000), model('b', 9, 30000), model('c', 5, 30000)]))).toEqual(['b', 'c', 'a']);
  });

  it('breaks a tie in likes by the face count nearest 30,000', () => {
    expect(uids(rank([model('far', 4, 900000), model('near', 4, 28000), model('low', 4, 2000)]))).toEqual(['near', 'low', 'far']);
  });

  it('takes the face count wanted', () => {
    expect(uids(rank([model('big', 1, 40000), model('small', 1, 9000)], { wantFaces: 9000 }))).toEqual(['small', 'big']);
  });

  it('puts a model with no face count last among its ties, and one with no likes as none', () => {
    expect(uids(rank([model('none', 3, undefined), model('some', 3, 50000), model('zero', undefined, 30000)]))).toEqual(['some', 'none', 'zero']);
  });

  it('puts rigged models first when a rigged one is wanted, and only then', () => {
    const list = [model('static', 50, 30000), model('rig', 1, 30000, { isRigged: true })];
    expect(uids(rank(list, { rigged: true }))).toEqual(['rig', 'static']);
    expect(uids(rank(list))).toEqual(['static', 'rig']);
  });

  it('puts models named for what’s sought first when it’s named, however they space it', () => {
    const list = [model('spider', 50, 30000, { name: 'Theraphosa Blondi', isRigged: true }), model('bp', 1, 30000, { name: 'Bird Person' }), model('hw', 0, 30000, { name: 'Homework 2' })];
    expect(uids(rank(list, { named: 'birdperson', rigged: true }))).toEqual(['bp', 'spider', 'hw']);
    expect(uids(rank(list, { rigged: true }))).toEqual(['spider', 'bp', 'hw']);
  });

  it('leaves the list it was given alone', () => {
    const list = [model('a', 1, 1), model('b', 2, 1)];
    rank(list);
    expect(uids(list)).toEqual(['a', 'b']);
  });
});

describe('the scout’s folder names', () => {
  it('slugs a name as the wiki’s reference sheets are slugged', () => {
    expect(slugOf('birdperson')).toBe('birdperson');
    expect(slugOf('Mr. Poopybutthole')).toBe('mr-poopybutthole');
    expect(slugOf('Revolio Clockberg, Jr.')).toBe('revolio-clockberg-jr');
    expect(slugOf('Rick’s cruiser')).toBe('ricks-cruiser');
    expect(slugOf("  Squanchy's  house ")).toBe('squanchys-house');
  });
});

describe('the scout’s arguments', () => {
  it('reads a name, its queries and the flags in any order', () => {
    expect(options(['birdperson', 'birdperson rick and morty', '--rigged'])).toEqual({ name: 'birdperson', queries: ['birdperson rick and morty'], rigged: true, max: 12 });
    expect(options(['squanchy', '--max', '5', 'squanchy rick and morty', 'squanchy'])).toEqual({ name: 'squanchy', queries: ['squanchy rick and morty', 'squanchy'], rigged: false, max: 5 });
  });

  it('searches for the name when no query is given', () => {
    expect(options(['Mr. Poopybutthole']).queries).toEqual(['Mr. Poopybutthole']);
  });
});

describe('what the scout reads off a model', () => {
  it('picks the widest thumbnail', () => {
    const images = [{ width: 256, url: 's' }, { width: 1920, url: 'l' }, { width: 720, url: 'm' }];
    expect(largest({ thumbnails: { images } })).toBe('l');
    expect(largest({ thumbnails: { images: [] } })).toBeNull();
    expect(largest({})).toBeNull();
  });

  it('tells a skinned GLB from a static one by its JSON alone', () => {
    expect(hasSkin(glb({ asset: { version: '2.0' }, skins: [{ joints: [0] }] }))).toBe(true);
    expect(hasSkin(glb({ asset: { version: '2.0' }, skins: [] }))).toBe(false);
    expect(hasSkin(glb({ asset: { version: '2.0' } }))).toBe(false);
    expect(hasSkin(Buffer.from('not a glb at all, just some bytes'))).toBe(false);
  });

  it('credits a model the way modelCredits.json keeps them', () => {
    const m = {
      name: 'Squanchy',
      user: { displayName: 'David Glynch', username: 'dg', profileUrl: 'https://sketchfab.com/dg' },
      license: { slug: 'by', label: 'CC Attribution', url: 'http://creativecommons.org/licenses/by/4.0/' },
      viewerUrl: 'https://sketchfab.com/3d-models/squanchy-32e6',
    };
    expect(creditOf(m, { where: 'c-137', as: 'Squanchy', file: '/models/c137/rm/squanchy.glb' })).toEqual({
      title: 'Squanchy',
      author: 'David Glynch',
      authorUrl: 'https://sketchfab.com/dg',
      license: 'CC-BY-4.0',
      licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
      source: 'https://sketchfab.com/3d-models/squanchy-32e6',
      where: 'c-137',
      as: 'Squanchy',
      file: '/models/c137/rm/squanchy.glb',
    });
    expect(creditOf({ ...m, user: { username: 'dg' }, license: { slug: 'cc0', url: 'u' } }, { where: 'c-137', as: 'x', file: 'f' })).toMatchObject({ author: 'dg', license: 'CC0-1.0' });
  });
});
