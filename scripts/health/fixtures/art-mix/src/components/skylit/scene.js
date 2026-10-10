import { loadEnvironment } from '../../lib/hdri';
// a toon world under an HDR sky: the sky is light, not a scan
export const build = (THREE) => [loadEnvironment(), new THREE.MeshToonMaterial()];
