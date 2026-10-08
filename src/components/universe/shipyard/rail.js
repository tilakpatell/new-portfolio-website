// The Shipyard's slots in the order its rail shows them: the build's six,
// then the paint and the parts (the weapon lines together), with their names.
import { SLOT_LABEL } from '../outfit';
import { BUILD_SLOTS, BUILD_SLOT_LABEL } from './parts';

export const RAIL = [...BUILD_SLOTS, 'paint', 'booster', 'thrusters', 'guns', 'secondary', 'ordnance', 'shields', 'fins'];
export const RAIL_LABEL = { ...BUILD_SLOT_LABEL, ...SLOT_LABEL };
