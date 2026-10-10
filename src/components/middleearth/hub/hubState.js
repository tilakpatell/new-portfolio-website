// The first step the hub offers: one way in, worded for where the visitor
// is. Someone new begins at the Shire; someone part-way carries on at the
// first chapter in the road's order they haven't won (not the furthest
// they've reached, so a jump ahead doesn't hide the gaps behind it); someone
// who has won it all is offered the road again. Pure, so the map and its
// ribbon agree and the tests can check it.
import { CHAPTERS, chapter } from '../chapters';
import { chapterRecord } from '../record';

// the first chapter in road order not yet won, or null when all are
export function nextUnfinished(unlocked = []) {
  return CHAPTERS.find((c) => !chapterRecord(c, { unlocked }).won)?.id ?? null;
}

export function firstStep(unlocked = []) {
  const have = new Set(unlocked);
  if (!CHAPTERS.some((c) => c.seals.some((s) => have.has(s)))) return { kind: 'begin', id: 'shire', label: 'Begin at the Shire' };
  const id = nextUnfinished(unlocked);
  if (!id) return { kind: 'again', id: 'shire', label: 'The road again' };
  return { kind: 'carry', id, label: `Carry on · ${chapter(id).name}` };
}
