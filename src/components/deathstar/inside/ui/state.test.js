import { describe, expect, it } from 'vitest';
import { STATION_CHOICES, bladeName, doubtLine, gunName, heroesFor, fromSearch, layers, promptLine, sectionName, security } from './state';

describe('what a link to the station asks for', () => {
  it('reads the station, the side, story or free roam and where to stand from the address', () => {
    expect(fromSearch('?station=ds1&side=imperial&mode=roam&at=ctl327')).toEqual({ station: 'ds1', side: 'imperial', mode: 'roam', hero: null, at: 'ctl327' });
  });

  it('takes a hero only for a Rebel, and only one of the four', () => {
    expect(fromSearch('?side=rebel&hero=leia').hero).toBe('leia');
    expect(fromSearch('?side=rebel&hero=vader').hero).toBeNull();
    expect(fromSearch('?side=imperial&hero=leia').hero).toBeNull();
  });

  it('drops what it doesn’t know, and keeps the second station now it is built', () => {
    expect(fromSearch('?station=ds3&side=sith&mode=fly&at=')).toEqual({ station: null, side: null, mode: null, hero: null, at: null });
    expect(fromSearch('?station=ds2').station).toBe('ds2');
    expect(fromSearch('')).toEqual({ station: null, side: null, mode: null, hero: null, at: null });
  });
});

describe('the start screen’s choices', () => {
  it('opens both Death Stars', () => {
    expect(STATION_CHOICES.map((s) => [s.id, s.open])).toEqual([
      ['ds1', true],
      ['ds2', true],
    ]);
  });

  it('offers Luke, Han, Leia and Obi-Wan to a Rebel, and a stormtrooper to an Imperial', () => {
    expect(heroesFor('rebel').map((h) => h.id)).toEqual(['luke', 'han', 'leia', 'obiwan']);
    expect(heroesFor('imperial').map((h) => h.id)).toEqual(['stormtrooper']);
  });
});

describe('the HUD’s words', () => {
  it('names the section from the station’s own list, and leaves an unknown one as it came', () => {
    expect(sectionName('ds1', 'bay327')).toBe('Docking Bay 327');
    expect(sectionName('ds1', 'nowhere')).toBe('nowhere');
    expect(sectionName('ds1', null)).toBe('');
  });

  it('shows security in red once someone has been seen, and calm when it hasn’t been told', () => {
    expect(security('calm')).toMatchObject({ label: 'Calm', red: false });
    expect(security('wary')).toMatchObject({ label: 'Wary', red: false });
    for (const a of ['alert', 'lockdown', 'hunt']) expect(security(a).red).toBe(true);
    expect(security('stand-down')).toMatchObject({ label: 'Standing down', red: false });
    expect(security(undefined).label).toBe('Calm');
  });

  it('puts the key in front of what E does: a lift, a console, a person, a coded hatch', () => {
    expect(promptLine({ text: 'call the lift' })).toEqual({ key: 'E', text: 'call the lift' });
    expect(promptLine('talk to the officer')).toEqual({ key: 'E', text: 'talk to the officer' });
    expect(promptLine({ text: 'call the lift' }, { touch: true })).toEqual({ key: 'Use', text: 'call the lift' });
  });

  it('gives a door that won’t open no key, since doors open on their own', () => {
    expect(promptLine({ text: 'Imperial personnel only', use: false })).toEqual({ key: null, text: 'Imperial personnel only' });
    expect(promptLine(null)).toBeNull();
    expect(promptLine({ text: '' })).toBeNull();
  });

  it('names the guns as they are stamped', () => {
    expect(gunName('e11')).toBe('E-11');
    expect(gunName('dl44')).toBe('DL-44');
    expect(gunName('dh17')).toBe('DH-17');
    expect(gunName('a280')).toBe('A280');
    expect(gunName(null)).toBe('');
  });
});

describe('the fight’s and the disguise’s words', () => {
  it('names a blade by its colour, and nothing without one', () => {
    expect(bladeName('green')).toBe('Lightsaber');
    expect(bladeName('red')).toBe('Lightsaber');
    expect(bladeName(null)).toBe('');
  });

  it('shows no disguise meter without a disguise, and reddens it once the garrison would challenge you', () => {
    expect(doubtLine(null)).toBeNull();
    expect(doubtLine(0)).toEqual({ k: 0, label: 'Unnoticed', red: false });
    expect(doubtLine(0.3)).toEqual({ k: 0.3, label: 'Noticed', red: false });
    expect(doubtLine(0.5)).toEqual({ k: 0.5, label: 'Questioned', red: true });
    expect(doubtLine(1)).toEqual({ k: 1, label: 'Blown', red: true });
  });
});

describe('what stands over the station', () => {
  const walking = { mode: 'play', map: { open: false, seen: [] }, talk: null };
  const mapUp = { ...walking, map: { open: true, seen: ['bay327'] } };

  it('holds the pointer while you walk, and frees it for the map, a conversation or a menu', () => {
    expect(layers('on', walking)).toEqual({ playing: true, paused: false, mapOpen: false, free: false });
    expect(layers('on', mapUp)).toEqual({ playing: true, paused: false, mapOpen: true, free: true });
    expect(layers('on', { ...walking, talk: { who: 'officer', line: 'Papers.', choices: [] } }).free).toBe(true);
    expect(layers('on', { mode: 'pause' })).toEqual({ playing: false, paused: true, mapOpen: false, free: true });
    expect(layers('on', { mode: 'start' }).free).toBe(true);
  });

  it('shows nothing of a game once the world has gone, though its last word had the map open', () => {
    for (const status of ['lost', 'failed', 'loading', 'idle']) {
      expect(layers(status, mapUp)).toEqual({ playing: false, paused: false, mapOpen: false, free: true });
      expect(layers(status, { mode: 'pause' }).paused).toBe(false);
    }
  });
});
