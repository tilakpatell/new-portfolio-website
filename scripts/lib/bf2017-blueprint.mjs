// What an object's blueprint says of it (the fifth design, lane O: the
// index's "blueprint tags"): the drop's data/ record of a placeable object
// (`ObjectBlueprint`, data/<name>.json.gz) names its mesh and its physics,
// so a library object is solid where the game's own collides, and still
// where the game holds it fixed.
//
//   blueprintFor(meshName, dataIndex) → the record's name, or null: the
//     blueprint whose name is the mesh's without `_mesh` (data.tsv's rows)
//   readBlueprint(record) → { solid, fixed, mesh, _source } | null
//     solid   a collision body (`RBTypeCollision`): you walk round it
//     fixed   its motion is the game's fixed one (it never falls or rolls)
//     _source where it came from, for the rulebooks' ledger (lane Z):
//             '<record>#RigidBodyData'

export function blueprintFor(meshName, dataIndex) {
  const want = meshName.replace(/_mesh$/, '').toLowerCase();
  for (const line of String(dataIndex).split('\n')) {
    const [name, type] = line.split('\t');
    if (type === 'ObjectBlueprint' && name?.toLowerCase() === want) return name;
  }
  return null;
}

export function readBlueprint(record) {
  const objects = record?.objects ?? [];
  if (record?.type !== 'ObjectBlueprint' || !objects.length) return null;
  const bodies = objects.filter((o) => o.$type === 'RigidBodyData');
  const model = objects.find((o) => o.$type === 'StaticModelEntityData');
  return {
    solid: bodies.some((b) => b.RigidBodyType === 'RBTypeCollision'),
    fixed: bodies.length > 0 && bodies.every((b) => /Fixed$/.test(b.MotionType ?? '')),
    mesh: model?.Mesh?.$asset ?? null,
    _source: `${record.name}#RigidBodyData`,
  };
}
