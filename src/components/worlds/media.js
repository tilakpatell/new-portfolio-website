import { PHOTOS } from '../../data/photos';
import { GIFS } from '../../data/gifs';

// Whether any of these photos or GIFs exist, so a world only shows a section
// it can fill.
export const hasPhotos = (items) => items.some((it) => PHOTOS[it.id]);
export const hasScenes = (names) => names.some((n) => GIFS[n]);
