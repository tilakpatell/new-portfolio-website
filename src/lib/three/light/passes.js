// The post chain as data (post.js) built into the node renderer's
// RenderPipeline: the one place the display addons are imported, each only
// when a chain names it. src/runtime/webgpu.js's buildPostProcessing hands
// a chain here when it holds a kind post.js's NODE_PASSES lists.
//
// The scene pass writes what the screen-space passes read, as three's own
// examples do: its colour, depth, view normals packed into eight bits, the
// diffuse colour (SSGI's bounce), velocity (TRAA) and metalness and
// roughness (SSR). Only what the chain reads is written.
//
// Each pass, in the chain's order, takes the colour so far:
// - ssgi: colour × its AO (unless an `ao` pass follows) + diffuse × its GI;
//   `denoise` after it filters the GI and composites again;
// - ao: GTAO at half resolution, denoised unless TRAA follows, multiplied in;
// - ssr: blended over (non-metals left out, SSRNode's default);
// - bloom: added, the house's numbers unless the pass says;
// - godrays: the lit haze added faintly in the sun's colour;
// - lensflare: the bloom's ghosts, blurred, added;
// - lut: the grading LUT (a Data3DTexture) applied to the tone-mapped,
//   encoded picture;
// - traa or smaa: the anti-aliasing; SMAA on the picture as shown, TRAA
//   before the output transform unless a LUT came first.
//
// buildChain(renderer, passes) → Promise<{ pipeline, nodes, dispose }>

import { BLOOM } from '../bloom.js';
import { loadThree } from './three.js';

const ADDONS = {
  ssgi: () => import('three/addons/tsl/display/SSGINode.js'),
  denoise: () => import('three/addons/tsl/display/DenoiseNode.js'),
  ao: () => import('three/addons/tsl/display/GTAONode.js'),
  ssr: () => import('three/addons/tsl/display/SSRNode.js'),
  bloom: () => import('three/addons/tsl/display/BloomNode.js'),
  godrays: () => import('three/addons/tsl/display/GodraysNode.js'),
  lensflare: () => Promise.all([import('three/addons/tsl/display/LensflareNode.js'), import('three/addons/tsl/display/GaussianBlurNode.js')]).then(([a, b]) => ({ ...a, ...b })),
  lut: () => import('three/addons/tsl/display/Lut3DNode.js'),
  traa: () => import('three/addons/tsl/display/TRAANode.js'),
  smaa: () => import('three/addons/tsl/display/SMAANode.js'),
};

export async function buildChain(renderer, passes) {
  const kinds = new Set(passes.map((p) => p.kind));
  // (GTAO without TRAA is filtered by DenoiseNode, as three's AO example does)
  if (kinds.has('ao') && !kinds.has('traa')) kinds.add('denoise');
  const { THREE, tsl } = await loadThree();
  const mods = {};
  await Promise.all([...kinds].filter((k) => ADDONS[k]).map(async (k) => (mods[k] = await ADDONS[k]())));
  const { pass, mrt, output, normalView, directionToColor, colorToDirection, diffuseColor, velocity, metalness, roughness, vec2, vec3, vec4, sample, texture3D } = tsl;
  const Pipeline = THREE.RenderPipeline ?? THREE.PostProcessing;
  const pipeline = new Pipeline(renderer);
  const nodes = []; // (made here, disposed here)
  const keep = (n) => (nodes.push(n), n);
  const needs = {
    normal: ['ssgi', 'denoise', 'ao', 'ssr'].some((k) => kinds.has(k)),
    diffuse: kinds.has('ssgi'),
    velocity: kinds.has('traa'),
    metalRough: kinds.has('ssr'),
  };
  const aoFollows = kinds.has('ao');
  const g = {};
  let node = null;

  // The grade and SMAA work on the picture as shown: the first of them
  // takes the tone mapping and the sRGB encoding into the chain
  // (renderOutput) and the pipeline's own transform is switched off, as
  // three's LUT and SMAA examples do. A LUT on linear HDR clamps every
  // bright pixel to its last cell.
  let shown = false;
  const display = (n) => {
    if (shown) return n;
    shown = true;
    pipeline.outputColorTransform = false;
    return tsl.renderOutput(n);
  };
  const composeGI = (base, gi) => vec4(aoFollows ? base.rgb : base.rgb.mul(gi.a), base.a).add(vec4(g.diffuse.rgb.mul(gi.rgb), 0));

  for (const p of passes) {
    if (p.enabled === false) continue;
    if (p.kind !== 'render' && !node) throw new Error(`a ${p.kind} pass needs a render pass first`);
    switch (p.kind) {
      case 'render': {
        const scenePass = keep(pass(p.scene, p.camera));
        const outs = { output };
        if (needs.normal) outs.normal = directionToColor(normalView);
        if (needs.diffuse) outs.diffuse = diffuseColor;
        if (needs.velocity) outs.velocity = velocity;
        if (needs.metalRough) outs.metalRough = vec2(metalness, roughness);
        if (Object.keys(outs).length > 1) scenePass.setMRT(mrt(outs));
        // (eight bits are enough for what is not colour)
        for (const k of ['normal', 'diffuse', 'metalRough']) if (outs[k]) scenePass.getTexture(k).type = THREE.UnsignedByteType;
        g.camera = p.camera;
        g.color = scenePass.getTextureNode('output');
        g.depth = scenePass.getTextureNode('depth');
        if (outs.normal) {
          const packed = scenePass.getTextureNode('normal');
          g.normal = sample((uv) => colorToDirection(packed.sample(uv)));
        }
        if (outs.diffuse) g.diffuse = scenePass.getTextureNode('diffuse');
        if (outs.velocity) g.velocity = scenePass.getTextureNode('velocity');
        if (outs.metalRough) g.metalRough = scenePass.getTextureNode('metalRough');
        g.scenePass = scenePass;
        node = g.color;
        break;
      }
      case 'ssgi': {
        const gi = keep(mods.ssgi.ssgi(node, g.depth, g.normal, p.camera ?? g.camera));
        gi.sliceCount.value = p.slices ?? 2;
        gi.stepCount.value = p.steps ?? 8;
        if (p.radius != null) gi.radius.value = p.radius;
        if (p.gi != null) gi.giIntensity.value = p.gi;
        gi.useTemporalFiltering = Boolean(p.temporal);
        g.gi = gi;
        g.giBase = node;
        node = composeGI(node, gi);
        break;
      }
      case 'denoise': {
        if (!g.gi) break;
        const dn = keep(mods.denoise.denoise(g.gi, g.depth, g.normal, p.camera ?? g.camera));
        node = composeGI(g.giBase, dn);
        break;
      }
      case 'ao': {
        const ao = keep(mods.ao.ao(g.depth, g.normal, p.camera ?? g.camera));
        ao.resolutionScale = p.resolutionScale ?? 0.5;
        if (p.radius != null) ao.radius.value = p.radius;
        if (p.power != null) ao.distanceExponent.value = p.power;
        const occlusion = kinds.has('traa') ? ao.getTextureNode() : keep(mods.denoise.denoise(ao.getTextureNode(), g.depth, g.normal, p.camera ?? g.camera));
        node = vec4(node.rgb.mul(occlusion.r), node.a);
        break;
      }
      case 'ssr': {
        // (SSRNode samples its colour as a texture; what comes before it is a composite)
        const s = keep(mods.ssr.ssr(tsl.convertToTexture(node), g.depth, g.normal, { metalnessNode: g.metalRough.r, roughnessNode: g.metalRough.g, camera: p.camera ?? g.camera }));
        s.resolutionScale = p.resolutionScale ?? 0.5;
        if (p.maxDistance != null) s.maxDistance.value = p.maxDistance;
        if (p.thickness != null) s.thickness.value = p.thickness;
        node = tsl.blendColor(node, s);
        break;
      }
      case 'bloom': {
        const b = keep(mods.bloom.bloom(node, p.strength ?? BLOOM.strength, p.radius ?? BLOOM.radius, p.threshold ?? BLOOM.threshold));
        g.bloom = b;
        node = node.add(b);
        break;
      }
      case 'godrays': {
        const gr = keep(mods.godrays.godrays(g.depth, p.camera ?? g.camera, p.light));
        if (p.density != null) gr.density.value = p.density;
        if (p.maxDensity != null) gr.maxDensity.value = p.maxDensity;
        // (the haze is the lit share of the air along the view, 0…maxDensity,
        // wherever one looks: added faintly in the sun's colour, not mixed)
        const haze = gr.getTextureNode().r;
        node = node.add(vec4(vec3(...(p.color ?? [1, 1, 1])).mul(haze).mul(p.strength ?? 0.2), 0));
        break;
      }
      case 'lensflare': {
        if (!g.bloom) break;
        const flare = keep(mods.lensflare.lensflare(g.bloom, { threshold: p.threshold, ghostSamples: p.ghostSamples, ghostSpacing: p.ghostSpacing }));
        node = node.add(keep(mods.lensflare.gaussianBlur(flare, null, 8)));
        break;
      }
      case 'lut': {
        if (!p.texture) break;
        node = keep(mods.lut.lut3D(display(node), texture3D(p.texture), p.texture.image.width, tsl.float(p.intensity ?? 1)));
        break;
      }
      case 'traa':
        node = keep(mods.traa.traa(node, g.depth, g.velocity, p.camera ?? g.camera));
        break;
      case 'smaa':
        node = keep(mods.smaa.smaa(display(node)));
        break;
      case 'output':
        // (the output transform is the pipeline's own)
        break;
      case 'shader':
        throw new Error('a shader pass needs the webgl backend');
      default:
        throw new Error(`unknown pass ${p.kind}`);
    }
  }
  pipeline.outputNode = node;
  return {
    pipeline,
    nodes,
    dispose() {
      for (const n of nodes) n.dispose?.();
      pipeline.dispose?.();
    },
  };
}
