// The worker's one job, pure so it's tested in Node: a cell of a planet's
// land (lib/land's makeCell) and its mesh at the step asked for, or a mesh
// again from heights kept on the page; every buffer handed back as a
// transferable.
//
//   landJob({ type: 'cell', key, seed, kind, cx, cz, step }) → { reply: {
//     key, cx, cz, heights, water, mask, props, mesh: { positions, normals,
//     indices } }, transfer }
//   landJob({ type: 'remesh', key, cx, cz, heights, step }) → { reply: { key,
//     cx, cz, step, mesh }, transfer }
//   landJob({ type: 'cancel' }) → null (the jobs are one at a time: there is
//     nothing to stop)

import { cellMesh, makeCell } from '../../../lib/land/cell.js';
import { landSpec } from '../../../lib/land/spec.js';

let last = null; // the spec of the seed asked last (a page asks one seed at a time)

const meshOf = (heights, step) => {
  const m = cellMesh(heights, { step });
  return { mesh: m, buffers: [m.positions.buffer, m.normals.buffer, m.indices.buffer] };
};

export function landJob(msg) {
  if (msg?.type === 'cell') {
    if (!last || last.key !== `${msg.seed}:${msg.kind}`) last = { key: `${msg.seed}:${msg.kind}`, spec: landSpec(msg.seed, msg.kind) };
    const cell = makeCell(last.spec, msg.cx, msg.cz);
    const { mesh, buffers } = meshOf(cell.heights, msg.step ?? 1);
    return {
      reply: { key: msg.key, cx: msg.cx, cz: msg.cz, step: msg.step ?? 1, heights: cell.heights, water: cell.water, mask: cell.mask, props: cell.props, mesh },
      transfer: [cell.heights.buffer, cell.water.buffer, cell.mask.buffer, ...buffers],
    };
  }
  if (msg?.type === 'remesh') {
    const { mesh, buffers } = meshOf(msg.heights, msg.step ?? 1);
    return { reply: { key: msg.key, cx: msg.cx, cz: msg.cz, step: msg.step ?? 1, mesh }, transfer: buffers };
  }
  return null;
}
