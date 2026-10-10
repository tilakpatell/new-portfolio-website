import { describe, expect, it } from 'vitest';
import { CALLERS, callerOf, eachLine, retold, speakerOf } from './callers';
import { CREWS, crewById, linesFor } from './crews';
import { GALAXY_LINES, galaxyCrew } from '../galaxy/lines';
import { VOICELINES } from './voicelines';
import { VOICELINES as FIGURES, figureVoice } from './landings/voicelines';
import { voiceOf } from '../../lib/voiced';

describe('who’s on the radio', () => {
  it('a radio line’s caller is by where the line is in the crew’s lines', () => {
    expect(speakerOf(['cruiser', 'npc', 'tammy', 'hello', 0])).toBe(CALLERS.tammy);
    expect(speakerOf(['xwing', 'events', 'stage', 'tieadvanced', 0])).toBe(CALLERS.vader);
    expect(speakerOf(['rv', 'events', 'wingmen', 'beater', 0])).toBe(CALLERS.badger);
    // the same place, another crew's caller
    expect(speakerOf(['xwing', 'events', 'wingmen', 'xwing', 0])).toBe(CALLERS.redtwo);
    expect(speakerOf(['falcon', 'events', 'wingmen', 'xwing', 0])).toBe(CALLERS.rogue);
    // anybody on the radio, and a crew nobody's named callers for
    expect(speakerOf(['cruiser', 'events', 'distress', 0])).toBeNull();
    expect(speakerOf(['nobody', 'npc', 'tammy', 'hello', 0])).toBeNull();
  });

  it('every caller named has a name, and a voice lib/voiced.js makes or none', () => {
    const lines = [...CREWS.map((c) => [c.id, c]), ...Object.entries(GALAXY_LINES)];
    for (const [id, crew] of lines) {
      eachLine(crew, [id], ([who], path) => {
        if (who !== 'comms') return;
        const caller = speakerOf(path);
        expect(caller, path.join('.')).not.toBeUndefined();
        if (caller) expect(typeof caller.name, path.join('.')).toBe('string');
        if (caller?.voice) expect(voiceOf(caller.voice), path.join('.')).toBeTruthy();
      });
    }
  });

  it('knows a crew’s radio lines by the lines themselves, in the galaxy too, and an offer with its part filled in', () => {
    const cruiser = crewById('cruiser');
    const [hello] = linesFor(cruiser, 'npc', 'tammy', 'hello');
    expect(callerOf(cruiser, hello)).toBe(CALLERS.tammy);
    expect(callerOf(cruiser, linesFor(cruiser, 'launch')[0])).toBeNull(); // (Rick's own)
    const [shield] = linesFor(galaxyCrew(crewById('xwing')), 'event', 'shield-down');
    expect(callerOf(galaxyCrew(crewById('xwing')), shield)).toBe(CALLERS.ackbar);
    const xwing = crewById('xwing');
    const [offer] = linesFor(xwing, 'npc', 'lando', 'offer');
    const told = retold(xwing, offer, offer[1].replace('{part}', 'hyperdrive'));
    expect(told[1]).not.toContain('{part}');
    expect(callerOf(xwing, told)).toBe(CALLERS.lando);
  });

  it('lists the callers’ and the guests’ lines in their voices, not the recorded, the filled-in or anybody’s', () => {
    const has = (who, text) => VOICELINES.some((l) => l.who === who && l.text === text);
    expect(has('tammy', 'There you are, Rick.')).toBe(true);
    expect(has('evilmorty', 'Let’s call it a draw. For now.')).toBe(true);
    expect(has('birdperson', 'Thank you, Rick. The family is safe.')).toBe(true);
    expect(has('ackbar', 'The shield is down! Commence attack on the Death Star’s main reactor.')).toBe(true);
    expect(VOICELINES.some((l) => l.text === 'Mayday, mayday! Gromflomites! Anybody!')).toBe(false);
    expect(VOICELINES.some((l) => l.text === 'In bird culture, this is considered a dick move.')).toBe(false); // (his recording)
    expect(VOICELINES.some((l) => l.text.includes('{part}'))).toBe(false);
    expect(VOICELINES.some((l) => l.text === 'It’s got a shield, Rick! The shots just bounce off!')).toBe(false); // (the crews' own: export-lines.mjs's)
    for (const { who } of VOICELINES) expect(voiceOf(who), who).toBeTruthy();
  });
});

describe('the people down on the planets', () => {
  it('say their lines in their own voices, and nothing that’s only done', () => {
    expect(figureVoice({ name: 'Jerry', line: 'Hungry for apples?' })).toBe('jerry');
    expect(figureVoice({ name: 'The President', line: 'Get in the limo, Rick.' })).toBe('uspresident');
    expect(figureVoice({ name: 'Jim', line: '[looks at the camera]' })).toBeNull();
    expect(figureVoice({ name: 'Phoenixperson', line: '(A hum of servos.)' })).toBeNull();
    expect(figureVoice({ name: 'Bumblebee', line: '[a burst of radio] …roll out!' })).toBeNull();
    expect(FIGURES).toContainEqual({ who: 'mark', text: 'Think, Mark!' });
    expect(FIGURES.some((l) => l.who === 'jim')).toBe(false);
    // (and the ones down in a planet's biomes)
    expect(FIGURES).toContainEqual({ who: 'gus', text: 'I hide in plain sight, same as you.' });
    expect(FIGURES).toContainEqual({ who: 'jack', text: 'Not all treasure is silver and gold, mate.' });
    expect(FIGURES.some((l) => l.who === 'risotto')).toBe(true);
    for (const { who } of FIGURES) expect(voiceOf(who), who).toBe(who);
  });
});
