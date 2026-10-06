import { expect, it } from 'vitest';
import { appearanceOf, slugOf } from './wiki-refs.mjs';

it('slugs a title', () => {
  expect(slugOf('Mr. Poopybutthole')).toBe('mr-poopybutthole');
  expect(slugOf('Revolio Clockberg, Jr.')).toBe('revolio-clockberg-jr');
});

it('takes the Appearance section', () => {
  expect(appearanceOf('intro {{box|x}}\n== History ==\nh\n== Appearance ==\nA [[tall|very tall]] bird.\n[[File:x.png|right]]\n== Trivia ==\nt')).toBe('A very tall bird.');
});

it('falls back to the intro', () => {
  expect(appearanceOf('{{infobox}}\nJust a guy.\n== History ==\nh')).toBe('Just a guy.');
});
