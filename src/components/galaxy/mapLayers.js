import { WARS, WAR_IDS } from './sides';

// What the galaxy map draws (HoloMap.jsx), each a switch kept in this
// browser: the war's territory, its fronts (the borders, the offensives and
// their fleets, the systems' rings), the hyperspace lanes, the regions'
// rings and names, and the atlas's grid (off till asked for: the panel
// still says the square).
export const LAYERS = ['territory', 'fronts', 'lanes', 'regions', 'grid'];
export const LAYER_LABEL = { territory: 'Territory', fronts: 'Fronts', lanes: 'Lanes', regions: 'Regions', grid: 'Grid' };
export const LAYERS_KEY = 'tp-galaxy-layers';
export const DEFAULT_LAYERS = Object.freeze({ territory: true, fronts: true, lanes: true, regions: true, grid: false });

export function readLayers(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(LAYERS.map((id) => [id, typeof v[id] === 'boolean' ? v[id] : DEFAULT_LAYERS[id]]));
}

// the war an era's chip shows: its own war, or with every era lit, the one you fight in
export const warForEra = (era, oathWar) => WAR_IDS.find((id) => WARS[id].era === era) ?? oathWar;
