// Where the galaxy's engine meets a surface (the engine design,
// docs/superpowers/specs/2026-10-10-galaxy-engine-design.md, lane T's
// Task 3): the game's light where a site names an entry (`site.gameLight`,
// lane G's field, lit by lane R's applyGameLight), the level's ground where
// a site has one (`site.level`, walked by lane P's createLevelPhysics), and
// the post the surface draws through. Each is behind its field and its
// lane: the lanes' functions are handed in, and until a lane has landed
// (none given) the surface keeps today's light, ground and post, exactly
// as before. Nothing here imports a lane: scene.js hands each in once its
// module is on main.
//
//   lightFor(site, { scene, sun, hemi, second, renderer, applyGameLight }) →
//     { kind: 'site' } (today's lights, left as they are) | { kind: 'game', ...what applyGameLight gave }
//   groundFor(site, { world, pack, physics, loadBin, tier, state, row,
//     createLevelCollision, createPlayerBody }) → null (today's ground: the
//     height grid and walker.js) | Promise<{ collision, body }> (P0's
//     collision for the level, P1's body on it when both are given)
//   postFor({ shading, renderer, scene, camera, small, glsl, nodes }) →
//     the post the backend draws: universe/post.js's (glsl) on the classic
//     renderer, nodes/post.js's on the node renderer

export function lightFor(site, { scene = null, sun = null, hemi = null, second = null, renderer = null, applyGameLight = null } = {}) {
  if (!site?.gameLight || typeof applyGameLight !== 'function') return { kind: 'site' };
  // (lane R takes the scene's own lights over: the sun becomes its
  // cascades' key, the sky light its probes' fallback)
  const got = applyGameLight({ entry: site.gameLight, scene, renderer, lights: { sun, hemi, second } });
  return { kind: 'game', ...(got ?? {}) };
}

export function groundFor(site, { world = null, pack = null, physics = null, loadBin = null, tier = 'high', state = null, row = null, createLevelCollision = null, createPlayerBody = null } = {}) {
  if (!site?.level || typeof createLevelCollision !== 'function') return null;
  return Promise.resolve(createLevelCollision({ pack, physics, loadBin, tier })).then((collision) => ({
    collision,
    // (the soldier's body only where the level is in a physics world: P1 on P0's)
    body: collision?.physics && typeof createPlayerBody === 'function' ? createPlayerBody({ physics: collision.physics, state, row, world }) : null,
  }));
}

export function postFor({ shading = 'glsl', renderer, scene, camera, small = false, glsl, nodes }) {
  const make = shading === 'nodes' ? nodes : glsl;
  return make(renderer, scene, camera, { small });
}
