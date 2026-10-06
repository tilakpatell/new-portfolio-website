import { describe, expect, it } from 'vitest';
import { parseIssue, summarise } from './runner.mjs';

describe('the voices runner, jobs from GitHub issues', () => {
  it('reads who to make and the lines asked for ahead', () => {
    const job = parseIssue({ number: 9, title: 'voices: Citadel cops', body: 'only: rick, morty\nrick: Wubba lubba dub dub.\nmorty: Aw geez, Rick.\nnote: for the chase' });
    expect(job).toEqual({ number: 9, name: 'citadel-cops', only: ['rick', 'morty'], lines: [{ who: 'rick', text: 'Wubba lubba dub dub.' }, { who: 'morty', text: 'Aw geez, Rick.' }] });
    expect(parseIssue({ number: 10, title: 'Everything unmade', body: '' })).toEqual({ number: 10, name: 'everything-unmade', only: null, lines: [] });
  });
  it("reads generate.py's count and who had no voice", () => {
    const log = 'erin: no reference yet: python scripts/voices/grab.py --only erin\nrick: qwen, reference rick.wav\nDone: 12 lines, 1 doubtful (cache/takes/report.md).';
    expect(summarise(log, [{ who: 'erin', text: 'x' }])).toEqual({ made: 12, doubtful: 1, noVoice: ['erin'] });
    expect(summarise('Done: 3 lines, 0 doubtful (x)')).toEqual({ made: 3, doubtful: 0, noVoice: [] });
  });
});
