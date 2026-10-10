import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { assetRefs, covered, globRe, missing, undeclared } from './pack-check.mjs';

const FIX = join(import.meta.dirname, 'fixtures/packs');

describe('the pack check', () => {
  it('finds asset URLs in source, a template part as a wildcard', () => {
    expect(assetRefs("a('/models/x.glb'); b(`/textures/s-${n}.jpg?v=2`); c('/about')").sort()).toEqual(['/models/x.glb', '/textures/s-*.jpg']);
  });

  it('takes a kit file for an asset (public/kit/<pack>/)', () => {
    expect(assetRefs("k('/kit/naturemega/index.json'); f(`/kit/naturemega/${file}`)").sort()).toEqual(['/kit/naturemega/*', '/kit/naturemega/index.json']);
    expect(covered('/kit/naturemega/fern.glb', { globs: ['/kit/naturemega/*.glb'] })).toBe(true);
  });

  it('matches globs by folder', () => {
    expect(globRe('/models/w/*').test('/models/w/a.glb')).toBe(true);
    expect(globRe('/models/w/*').test('/models/w/deep/a.glb')).toBe(false);
    expect(globRe('/models/**').test('/models/w/deep/a.glb')).toBe(true);
  });

  it('names a URL the pack does not cover, and not one a glob covers', () => {
    const pack = { id: '/w', urls: ['/audio/loose.mp3'], globs: ['/textures/w/*'] };
    expect(undeclared(join(FIX, 'src/world'), pack)).toEqual(['/models/w/plane.glb']);
    expect(undeclared(join(FIX, 'src/world'), { ...pack, globs: [...pack.globs, '/models/w/*.glb'] })).toEqual([]);
  });

  it('covers a folder named by its prefix', () => {
    expect(covered('/textures/w/', { globs: ['/textures/w/*'] })).toBe(true);
    expect(covered('/textures/w', { globs: ['/textures/w/*'] })).toBe(true);
  });

  it('takes a computed folder as declared, the files it uses listed', () => {
    const pack = { id: '/w', urls: ['/models/w/plane.glb'], computed: ['/models/w'] };
    expect(covered('/models/w/*.glb', pack)).toBe(true);
    expect(covered('/models/w', pack)).toBe(true);
    expect(covered('/models/wx/a.glb', pack)).toBe(false);
    expect(missing(pack, join(FIX, 'site'))).toEqual([]);
    expect(missing({ computed: ['/models/w'] }, join(FIX, 'site'))).toEqual(['/models/w']);
  });

  it('takes a file the public bucket alone holds as there', () => {
    expect(missing({ urls: ['/models/w/gone.glb'], globs: ['/hq/none/*'] }, join(FIX, 'site'), ['/models/w/gone.glb', '/hq/none/luke.glb'])).toEqual([]);
  });

  it('names what a pack lists that is not there', () => {
    expect(missing({ urls: ['/models/w/plane.glb', '/models/w/gone.glb'], globs: ['/models/w/*', '/hq/none/*'] }, join(FIX, 'site'))).toEqual(['/models/w/gone.glb', '/hq/none/*']);
  });
});
