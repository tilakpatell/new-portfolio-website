// Where you get up after going down (outside a battle, a chase or a run):
// where the quest's step began if it names a place, else, inside a zone,
// its door in (its `respawn`, else its `spawn`, facing its way: the same
// spot a fall puts you back on), else by the ship. Inside a zone you used to
// be left where you fell, beside whatever downed you. Pure.
//
//   downAt({ step, zone, spawn }) → [x, z, yaw] (yaw null: keep yours)

export function downAt({ step, zone, spawn }) {
  if (step?.respawn) return [step.respawn[0], step.respawn[1], null];
  if (zone) {
    const [x, z] = zone.inside.respawn ?? zone.inside.spawn ?? [0, 0];
    return [zone.origin[0] + x, zone.origin[2] + z, zone.inside.yaw ?? 0];
  }
  return [spawn[0], spawn[1], null];
}
