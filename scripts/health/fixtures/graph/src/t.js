// a loop only through a test file: a test is in the graph, so its imports
// count, but cycles leaves tests out
import { sample } from './t.test.js';

export const t = sample;
