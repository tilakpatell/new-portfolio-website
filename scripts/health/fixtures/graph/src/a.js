// a → b → c → a: a cycle of three, its first import over several lines with a
// comment in its braces, whose apostrophe isn't a quote
import {
  b, // the loop's next file
} from './b.js';

export const a = () => b;
