// A wingman (Birdperson): wingRules.js's flight, the wing's own: the brain
// hands it over (a `delegate` event: the scene's wing joins with its ship)
// and keeps its lines and relations.
export default function wingman(npc) {
  return { delegate: { via: 'wing', kind: npc.ship } };
}
