// Game feel (moved down from the HQ games, which still import it through
// avengers/hq/feel.js): trauma-based camera shake (shake goes with the
// square of trauma, so small knocks barely move the camera and big ones snap
// it), hitstop (the game slows for a moment on a heavy hit, the camera and
// effects don't), and a field-of-view punch. With `calm` (reduced motion) the
// camera never moves; hitstop still happens, because it changes no pixels by
// itself.

const DECAY = 1.5; // trauma per second
const MAX_OFFSET = 0.12; // world units at full trauma
const MAX_ROLL = 0.05; // radians

const noise = (t, seed) => {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export function createFeel({ seed = 1, calm = false, baseFov = 60, offset = MAX_OFFSET } = {}) {
  let trauma = 0;
  let time = 0;
  let stop = 0;
  let fov = 0;
  let base = baseFov;
  // smoothed noise: sample at a steady rate and blend, so it reads as a shake
  // rather than a jitter
  const shake = (t, s) => {
    const a = Math.floor(t);
    const k = t - a;
    const f = k * k * (3 - 2 * k);
    return noise(a, s) * (1 - f) + noise(a + 1, s) * f;
  };
  return {
    trauma(k) {
      trauma = Math.min(1, trauma + k);
    },
    hitstop(ms) {
      stop = Math.max(stop, ms / 1000);
    },
    punch(deg) {
      fov = Math.min(12, fov + deg);
    },
    setBaseFov(v) {
      base = v;
    },
    // How much of this real frame the game should advance (hitstop).
    scale(dt) {
      if (stop <= 0) return 1;
      stop -= dt;
      return stop > 0 ? 0.06 : 1;
    },
    // After the camera has been placed for the frame: add shake and punch.
    update(dt, camera) {
      time += dt;
      trauma = Math.max(0, trauma - DECAY * dt);
      fov *= Math.exp(-dt / 0.18);
      if (fov < 0.01) fov = 0;
      if (calm) return;
      if (trauma > 0) {
        const s = trauma * trauma;
        const t = time * 26;
        camera.position.x += offset * s * shake(t, seed);
        camera.position.y += offset * s * shake(t, seed + 1);
        camera.rotation.z += MAX_ROLL * s * shake(t, seed + 2);
      }
      const want = base + fov;
      if (Math.abs(camera.fov - want) > 1e-3) {
        camera.fov = want;
        camera.updateProjectionMatrix();
      }
    },
    state: () => ({ trauma, stop, fov }),
  };
}
