import { describe, expect, it } from 'vitest';
import { classicPathFor, isMapPath, universePathFor, viewOf } from './view';

describe('which view a page is in', () => {
  it('knows the universe map, at the front door and at every place on it', () => {
    for (const p of ['/', '/universe', '/universe/experience', '/universe/marvel']) expect(isMapPath(p), p).toBe(true);
    for (const p of ['/home', '/experience', '/universeful', '/galaxy']) expect(isMapPath(p), p).toBe(false);
  });

  it('puts the map in the universe and the portfolio pages in the classic site', () => {
    expect(viewOf('/universe/projects', 'home')).toBe('universe');
    for (const p of ['/home', '/experience', '/experience/aws', '/projects', '/projects/gb', '/resume', '/contact', '/travel', '/terminal'])
      expect(viewOf(p, 'universe'), p).toBe('classic');
  });

  it('leaves the worlds in whichever view the visitor picked, the universe if they never did', () => {
    expect(viewOf('/avengers', null)).toBe('universe');
    expect(viewOf('/avengers', 'universe')).toBe('universe');
    expect(viewOf('/avengers', 'home')).toBe('classic');
    expect(viewOf('/galaxy/hoth/surface', 'home')).toBe('classic');
  });
});

describe('switching to the universe', () => {
  it('flies to the station for the page you were reading', () => {
    expect(universePathFor('/home')).toBe('/universe/home');
    expect(universePathFor('/experience')).toBe('/universe/experience');
    expect(universePathFor('/experience/aws')).toBe('/universe/experience');
    expect(universePathFor('/projects/gameboy')).toBe('/universe/projects');
    expect(universePathFor('/resume')).toBe('/universe/resume');
  });

  it('flies to the planet for the world you were in, however deep', () => {
    expect(universePathFor('/avengers')).toBe('/universe/marvel');
    expect(universePathFor('/galaxy')).toBe('/universe/starwars');
    expect(universePathFor('/galaxy/hoth/surface')).toBe('/universe/starwars');
    expect(universePathFor('/deathstar')).toBe('/universe/starwars');
    expect(universePathFor('/middle-earth/moria')).toBe('/universe/middleearth');
    expect(universePathFor('/c-137/citadel')).toBe('/universe/rickmorty');
  });

  it('takes the classic travel page to the travel planet', () => {
    expect(universePathFor('/travel')).toBe('/universe/travel');
  });

  it('opens the whole map from anywhere else, and stays put on the map', () => {
    expect(universePathFor('/nowhere')).toBe('/universe');
    expect(universePathFor('/universe/marvel')).toBe('/universe/marvel');
    expect(universePathFor('/')).toBe('/universe');
  });
});

describe('switching to the classic site', () => {
  it('opens the page for the station you had picked', () => {
    expect(classicPathFor('/universe/experience')).toBe('/experience');
    expect(classicPathFor('/universe/projects')).toBe('/projects');
    expect(classicPathFor('/universe/home')).toBe('/home');
    expect(classicPathFor('/universe/travel')).toBe('/travel');
  });

  it('opens the home page from a planet, the whole map or a world', () => {
    expect(classicPathFor('/universe')).toBe('/home');
    expect(classicPathFor('/')).toBe('/home');
    expect(classicPathFor('/universe/marvel')).toBe('/home');
    expect(classicPathFor('/avengers')).toBe('/home');
  });

  it('stays on a classic page already', () => {
    expect(classicPathFor('/experience/aws')).toBe('/experience/aws');
    expect(classicPathFor('/projects')).toBe('/projects');
  });
});
