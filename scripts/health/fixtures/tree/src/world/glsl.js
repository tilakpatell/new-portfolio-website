// an EffectComposer here would count, were it code
export function make(THREE, f) {
  const m = new THREE.ShaderMaterial();
  m.onBeforeCompile = f;
  return m;
}
