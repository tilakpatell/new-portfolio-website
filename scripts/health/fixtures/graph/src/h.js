// a query (?raw, ?url, ?worker) isn't part of the path; a glob, one pattern or
// a list of them, is an edge to every file it matches: * within one folder,
// ** across them
import raw from './i.js?raw';

export const data = import.meta.glob('./data/*.json', { eager: true });
export const deep = import.meta.glob(['./data/**/*.json']);
export const h = raw;
