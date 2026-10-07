// The themes' quotes that no clip of the show says as they land
// (components/ThemeTransition.jsx), and whose voice says them aloud
// (lib/voiced.js; ./voicelines.js lists them for scripts/voices). The arcade
// credits its line to player one, but it's Mario's; the Shire's is Galadriel's
// over Howard Shore's theme, and the Pearl's Jack's over the films'.
// (Bumblebee speaks through his radio, so his has no voice; the Rick and
// Morty themes' are in components/rickmorty/themeQuotes.js.)

export const THEME_QUOTES = {
  arcade: { quote: 'Let’s-a go!', by: 'Player one', voice: 'mario' },
  pearl: { quote: 'Now, bring me that horizon.', by: 'Captain Jack Sparrow', voice: 'jack' },
  shire: { quote: 'Even the smallest person can change the course of the future.', by: 'Galadriel', voice: 'galadriel' },
  megatron: { quote: 'Peace through tyranny.', by: 'Megatron', voice: 'megatron' },
  shockwave: { quote: 'Logic dictates only one outcome.', by: 'Shockwave', voice: 'shockwave' },
};
