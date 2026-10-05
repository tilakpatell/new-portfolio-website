// Big grounds without the tiling: a scanned material repeated a hundred
// times across a desert or a lawn shows its repeat from the first look,
// however good the scan. `antiTile` patches a material so every map is
// sampled twice, once as it is and once at another scale and offset, and the
// two are blended by a smooth, low-frequency noise of the world position, so
// no two patches of ground line up. It costs one extra texture fetch per map
// per fragment and no extra passes, and it leaves the material's own
// onBeforeCompile (cloud shadows, stripes) in place.
//
//   antiTile(material, { scale, strength, size }) → the same material
//     scale     the second sample's scale against the first (0.23: about four
//               times coarser, so its repeat never lines up with the first)
//     strength  how much of the ground the second sample takes (0..1)
//     size      the noise's grain in metres (the patches are about this big)
//
// The pure helpers (`antiTileOptions`, `patchChunk`, `patchVertex`,
// `patchFragment`) are tested; `antiTile` only wires them to three.

import * as THREE from 'three';

export const DEFAULTS = { scale: 0.23, strength: 0.6, size: 9 };

// Numbers a shader can take: a scale that isn't 1 (then there's nothing to
// blend against) or 0, a strength in 0..1, a grain over a metre.
export function antiTileOptions({ scale = DEFAULTS.scale, strength = DEFAULTS.strength, size = DEFAULTS.size } = {}) {
  const s = Number.isFinite(scale) && scale > 0 && Math.abs(scale - 1) > 0.01 ? scale : DEFAULTS.scale;
  return {
    scale: s,
    strength: Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : DEFAULTS.strength,
    size: Number.isFinite(size) && size >= 1 ? size : DEFAULTS.size,
  };
}

// The maps whose sampling is doubled. Emissive, alpha and displacement maps
// are left alone: an emissive map is usually a picture, not a surface.
export const MAPS = ['map', 'normalMap', 'roughnessMap', 'aoMap', 'metalnessMap'];
const SAMPLE = new RegExp(`texture2D\\(\\s*(${MAPS.join('|')})\\s*,\\s*(v\\w+Uv)\\s*\\)`, 'g');

// A shader chunk with those maps' samples routed through atSample.
export const patchChunk = (src) => src.replace(SAMPLE, 'atSample( $1, $2 )');

const CHUNKS = ['map_fragment', 'normal_fragment_maps', 'roughnessmap_fragment', 'aomap_fragment', 'metalnessmap_fragment'];

const VERTEX_HEAD = 'varying vec3 vAtWorld;\n';
// the world position of the vertex, batched and instanced as three would
const VERTEX_MAIN = `
	vec4 atPos = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		atPos = batchingMatrix * atPos;
	#endif
	#ifdef USE_INSTANCING
		atPos = instanceMatrix * atPos;
	#endif
	vAtWorld = ( modelMatrix * atPos ).xyz;
`;

// Value noise on the ground plane, two octaves, smooth: 0..1, about one
// feature per `atSize` metres. The blend is a soft threshold of it, so the
// ground is patches of either sample with soft edges, not a grey average.
const FRAGMENT_HEAD = `
varying vec3 vAtWorld;
uniform float atScale;
uniform float atStrength;
uniform float atSize;
float atK = 0.0;
float atHash( vec2 p ) {
	return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}
float atNoise( vec2 p ) {
	vec2 i = floor( p );
	vec2 f = fract( p );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( atHash( i ), atHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( atHash( i + vec2( 0.0, 1.0 ) ), atHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
float atBlend( vec2 p ) {
	vec2 q = p / atSize;
	float n = atNoise( q ) * 0.65 + atNoise( q * 2.3 + vec2( 17.0, 41.0 ) ) * 0.35;
	return atStrength * smoothstep( 0.38, 0.62, n );
}
vec4 atSample( sampler2D t, vec2 uv ) {
	return mix( texture2D( t, uv ), texture2D( t, uv * atScale + vec2( 0.37, 0.61 ) ), atK );
}
`;

export function patchVertex(src) {
  if (src.includes('vAtWorld')) return src;
  return VERTEX_HEAD + src.replace('#include <project_vertex>', `${VERTEX_MAIN}\n\t#include <project_vertex>`);
}

// `chunks` is three's ShaderChunk (passed in, so this stays testable without
// a renderer): each include is expanded and patched in place.
export function patchFragment(src, chunks) {
  if (src.includes('vAtWorld')) return src;
  let out = src;
  for (const name of CHUNKS) {
    const body = chunks[name];
    if (typeof body === 'string') out = out.replace(`#include <${name}>`, patchChunk(body));
  }
  // the blend once per fragment, first thing in main
  out = out.replace('void main() {', 'void main() {\n\tatK = atBlend( vAtWorld.xz );');
  return FRAGMENT_HEAD + out;
}

// Patches a material in place. Its own onBeforeCompile still runs first, and
// the program cache key says so, so two materials with different patches
// never share a program.
export function antiTile(material, options = {}) {
  if (!material?.isMaterial || material.userData.antiTile) return material;
  const o = antiTileOptions(options);
  const uniforms = { atScale: { value: o.scale }, atStrength: { value: o.strength }, atSize: { value: o.size } };
  const inner = material.onBeforeCompile;
  const innerKey = material.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ? () => inner.toString() : material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    inner.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = patchVertex(shader.vertexShader);
    shader.fragmentShader = patchFragment(shader.fragmentShader, THREE.ShaderChunk);
  };
  material.customProgramCacheKey = () => `${innerKey()}|antiTile`;
  material.userData.antiTile = uniforms;
  material.needsUpdate = true;
  return material;
}
