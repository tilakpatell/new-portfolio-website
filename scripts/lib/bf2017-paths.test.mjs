import { describe, expect, it } from 'vitest';
import { imageUris, inBucket, localPath, mapPath, objectUrl, textureSources } from './bf2017-paths.mjs';

// a GLB of just a JSON chunk, the way gltfpack's start
function glbOf(json) {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const body = Buffer.from(text, 'utf8');
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + body.length, 8);
  head.writeUInt32LE(body.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, body]);
}

describe('the 2017 drop’s paths', () => {
  it('reads a GLB’s image URIs as bucket paths, whatever shape they come in', () => {
    const glb = glbOf({ asset: { version: '2.0' }, images: [{ uri: '../../../../../textures/x/y_cs.ktx2' }, { uri: 'textures/x/z.ktx2' }, { uri: 'data:image/png;base64,AA==' }, { bufferView: 0 }] });
    expect(imageUris(glb, 'web/models/a/b/c/d/e_mesh.glb')).toEqual(['web/textures/x/y_cs.ktx2', 'web/textures/x/z.ktx2']);
    expect(imageUris(glbOf({ images: [{ uri: 'web/textures/q.ktx2' }] }), 'web/models/a.glb')).toEqual(['web/textures/q.ktx2']);
    expect(imageUris(glbOf({ asset: {} }), 'web/models/a.glb')).toEqual([]);
  });

  it('asks for the PNG first, then the KTX2', () => {
    expect(textureSources('web/textures/x/y_cs.ktx2')).toEqual(['web/textures/x/y_cs.png', 'web/textures/x/y_cs.ktx2']);
    expect(textureSources('web/textures/x/y_nm__orm_eb4aa84f.ktx2')).toEqual(['web/textures/x/y_nm.png', 'web/textures/x/y_nm__orm_eb4aa84f.ktx2']);
    expect(textureSources('web/textures/x/y_nm__normal.ktx2')).toEqual(['web/textures/x/y_nm.png', 'web/textures/x/y_nm__normal.ktx2']);
    expect(textureSources('web/textures/x/y_cs.png')).toEqual(['web/textures/x/y_cs.png']);
  });

  it('builds the object URL with each segment encoded', () => {
    expect(objectUrl('https://p.supabase.co', 'bf2017-assets', 'web/models/at-at/a b.glb')).toBe('https://p.supabase.co/storage/v1/object/bf2017-assets/web/models/at-at/a%20b.glb');
    expect(objectUrl('https://p.supabase.co/', 'b', 'x')).toBe('https://p.supabase.co/storage/v1/object/b/x');
  });

  it('reads the manifest’s paths as bucket paths', () => {
    expect(inBucket('models/a/b.glb')).toBe('web/models/a/b.glb');
    expect(inBucket('web/models/a/b.glb')).toBe('web/models/a/b.glb');
    expect(mapPath('Gameplay/Heroes/X/T_X_3p_NAM')).toBe('web/textures/gameplay/heroes/x/t_x_3p_nam.png');
  });

  it('keeps the bucket’s layout on disk', () => {
    expect(localPath('/r', 'web/models/x.glb')).toBe('/r/web/models/x.glb');
  });
});
