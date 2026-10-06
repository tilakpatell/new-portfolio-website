// The racks (rack.js), kept between visits and shared live: whatever
// changes them (B, the hangar's Armoury, the galaxy's hero panel) saves
// them here, and the foot scenes hear ARMS_EVENT and pick them up.

import { local } from '../hooks';
import { ARMS_KEY, readRacks } from './rack';

export const ARMS_EVENT = 'tp-arms';
export const loadRacks = () => readRacks(local.get(ARMS_KEY));
export function saveRacks(racks) {
  local.set(ARMS_KEY, racks);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ARMS_EVENT));
}
