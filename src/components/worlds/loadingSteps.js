// What a world getting ready says it's doing (components/worlds/LoadingVeil),
// by its step's name (lib/three/gpuWork's prepareScene, a world's prepare).
export const STEP_WORDS = {
  load: 'Fetching the world',
  pictures: 'Sending pictures to the graphics chip',
  shaders: 'Compiling shaders',
  'first draw': 'Drawing it once',
  bake: 'Baking the light',
  tune: 'Tuning for this screen',
};

// A prepare's onProgress that sets React state no more than once a step
// change or a percent's worth (a prepare reports on every picture sent).
export function throttled(set) {
  let shown = { value: -1, step: '' };
  return (value, step) => {
    if (step === shown.step && value - shown.value < 0.01 && value < 1) return;
    shown = { value, step };
    set(shown);
  };
}
