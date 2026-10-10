// Where the 2017 drop's files are, in the bucket and on disk. A model's GLB
// names its textures by a path relative to itself (`../../../../../textures/
// …_cs.ktx2`), not embedded, so the fetch reads those URIs to know what else
// to ask for, and keeps the bucket's layout on disk so they still resolve.
import { join, posix } from 'node:path';

// The JSON chunk of a GLB (chunk 0 starts at byte 20; its length is at 12).
export function glbJson(glb) {
  const buf = Buffer.isBuffer(glb) ? glb : Buffer.from(glb.buffer, glb.byteOffset, glb.byteLength);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error('not a GLB');
  return JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
}

// An image URI as a bucket path (under web/), resolved against the GLB's own;
// null for one in the file (a data URI or a buffer view).
export function imagePath(uri, glbBucketPath) {
  if (!uri || uri.startsWith('data:')) return null;
  const path = decodeURIComponent(uri);
  if (path.startsWith('web/')) return path;
  if (path.startsWith('textures/')) return `web/${path}`;
  return posix.normalize(posix.join(posix.dirname(glbBucketPath), path));
}

// Each image's bucket path, in order, those in the file left out.
export const imageUris = (glb, glbBucketPath) => (glbJson(glb).images ?? []).map((img) => imagePath(img.uri, glbBucketPath)).filter(Boolean);

// Where a texture may be, best first: the raw PNG of its source map (the
// uploader's derived `__normal` and `__orm_<hash>` maps are made from it),
// then the KTX2 the GLB names.
export function textureSources(bucketPath) {
  if (!bucketPath.endsWith('.ktx2')) return [bucketPath];
  const stem = bucketPath.slice(0, -'.ktx2'.length).replace(/__(normal|orm_[0-9a-f]+)$/, '');
  return [`${stem}.png`, bucketPath];
}

// A manifest path (`models/…glb`, relative to the bucket's web/) as a bucket
// path, and a `derived` recipe's map (`Gameplay/…/T_…_NAM`, the source
// texture's Frostbite name) as the bucket path of its PNG.
export const inBucket = (file) => (file.startsWith('web/') ? file : `web/${file}`);
export const mapPath = (map) => `web/textures/${map.toLowerCase()}.png`;

export const localPath = (root, bucketPath) => join(root, bucketPath);

export const objectUrl = (base, bucket, path) => `${base.replace(/\/+$/, '')}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

// The gameplay records (`data/<Name>.json.gz`, the dump's EBX as JSON) are
// asked for by a glob over their names: `*` within a folder, `**` across.
export const dataPath = (name) => `data/${name}.json.gz`;

export function globRegExp(glob) {
  const body = glob
    .split('**')
    .map((part) =>
      part
        .replace(/[.+^${}()|[\]\\?]/g, '\\$&')
        .replace(/\*/g, '[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${body}$`);
}

// The deepest folder a glob names before its first star: where a listing starts.
export function globDir(glob) {
  const star = glob.indexOf('*');
  const head = star < 0 ? glob : glob.slice(0, star);
  const cut = head.lastIndexOf('/');
  return cut < 0 ? '' : head.slice(0, cut);
}
