// Places I've been, for the globe on the home page.
//
// `iso` is the ISO 3166-1 numeric code Natural Earth uses for the country (null
// for a region such as the Caribbean, which gets a marker and a route but lights
// no country). `at` is [longitude, latitude] of the capital, or the middle of a
// region: where the globe turns to and where the route from home ends.
//
// After adding or removing a place, run `node scripts/build-globe.mjs` so the
// globe lights the right countries.
export const PLACES = [
  { id: 'us', iso: '840', name: 'United States', region: 'North America', at: [-71.06, 42.36], home: true },
  { id: 'ca', iso: '124', name: 'Canada', region: 'North America', at: [-75.7, 45.42] },
  { id: 'mx', iso: '484', name: 'Mexico', region: 'North America', at: [-99.13, 19.43] },
  { id: 'cr', iso: '188', name: 'Costa Rica', region: 'Central America and the Caribbean', at: [-84.08, 9.93] },
  { id: 'caribbean', iso: null, name: 'The Caribbean', region: 'Central America and the Caribbean', at: [-66.5, 17.6] },
  { id: 'cl', iso: '152', name: 'Chile', region: 'South America', at: [-70.67, -33.45] },
  { id: 'is', iso: '352', name: 'Iceland', region: 'Europe', at: [-21.94, 64.15] },
  { id: 'no', iso: '578', name: 'Norway', region: 'Europe', at: [10.75, 59.91] },
  { id: 'gb', iso: '826', name: 'United Kingdom', region: 'Europe', at: [-0.13, 51.51] },
  { id: 'pt', iso: '620', name: 'Portugal', region: 'Europe', at: [-9.14, 38.72] },
  { id: 'es', iso: '724', name: 'Spain', region: 'Europe', at: [-3.7, 40.42] },
  { id: 'fr', iso: '250', name: 'France', region: 'Europe', at: [2.35, 48.86] },
  { id: 'it', iso: '380', name: 'Italy', region: 'Europe', at: [12.5, 41.9] },
  { id: 'mt', iso: '470', name: 'Malta', region: 'Europe', at: [14.51, 35.9] },
  { id: 'gr', iso: '300', name: 'Greece', region: 'Europe', at: [23.73, 37.98] },
  { id: 'in', iso: '356', name: 'India', region: 'Asia', at: [77.21, 28.61] },
];

export const HOME = PLACES.find((p) => p.home);
export const HOME_CITY = 'Boston';
export const COUNTRY_COUNT = PLACES.filter((p) => p.iso).length;

// Great-circle distance in kilometres between two [lon, lat] points.
export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
