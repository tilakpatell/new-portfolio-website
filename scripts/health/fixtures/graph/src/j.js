// j ↔ k: a cycle of two, closed by a dynamic import. j's two imports share a
// line, and the second is the one in the loop
import './i.js'; import { k } from './k.js';

export const j = () => k;
