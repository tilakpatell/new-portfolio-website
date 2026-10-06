// ../i is i.js. A dynamic import whose argument isn't a string literal names
// no one file, so it adds no edge; read as '../d' it would close a loop d → e → d.
// Nor does a comment; import { d } from '../d.js' here would close it too.
import { i } from '../i';

export const e = i;
export const later = (name) => import('../d' + name);
export const sooner = (name) => import(`../d${name}`);
