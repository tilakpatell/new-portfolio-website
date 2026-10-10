import { describe, expect, it } from 'vitest';
import { BUCKET, assetHost, sources } from './assetHost';

describe('the asset host', () => {
  it('is the project’s public bucket when the build has a Supabase URL', () => {
    expect(assetHost({ VITE_SUPABASE_URL: 'https://abc123.supabase.co' })).toBe(`https://abc123.supabase.co/storage/v1/object/public/${BUCKET}`);
    expect(assetHost({ VITE_SUPABASE_URL: 'https://abc123.supabase.co/', VITE_ASSET_BUCKET: 'flight' })).toBe('https://abc123.supabase.co/storage/v1/object/public/flight');
  });

  it('is nothing without one, or with something that isn’t a Supabase project', () => {
    expect(assetHost({})).toBeNull();
    expect(assetHost({ VITE_SUPABASE_URL: 'http://abc.supabase.co' })).toBeNull();
    expect(assetHost({ VITE_SUPABASE_URL: 'https://evil.example.com' })).toBeNull();
  });

  it('tries the host’s high-detail file first, then the site’s own', () => {
    const host = 'https://abc.supabase.co/storage/v1/object/public/assets';
    expect(sources('/models/a.lod1.glb', { host, hq: 'models/a.ultra.glb' })).toEqual([`${host}/models/a.ultra.glb`, '/models/a.lod1.glb']);
    expect(sources('/models/a.lod1.glb', { host: null, hq: 'models/a.ultra.glb' })).toEqual(['/models/a.lod1.glb']);
    expect(sources('/models/a.glb', { host })).toEqual(['/models/a.glb']);
  });
});
