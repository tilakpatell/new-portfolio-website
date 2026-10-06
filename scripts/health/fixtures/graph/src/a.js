// a → b → c → a: a cycle of three, its first import over several lines
import {
  b,
} from './b.js';

export const a = () => b;
