// GIFs from the studios' own channels on GIPHY, embedded (not copied) with
// credit. `small` is GIPHY's 200px-wide MP4 where it exists; clips without one
// use the full MP4. Size 'medium' is the 200px-tall one (about 356 wide), for
// panels too wide for the small one. `w`/`h` reserve the space so nothing
// jumps as they load.
export const GIFS = {
  twss: { id: 'Q8wCK0j1Fsdjtnkvt0', title: 'Michael explains “That’s what she said”', by: 'The Office', w: 480, h: 270, sound: true },
  parkour: { id: 'KhM9lNVwD5LYRsG24V', title: 'Hardcore Parkour!', by: 'The Office', w: 480, h: 270, sound: true },
  parkourDwight: { id: 'ibLFMF9LGxgi7Rw2ee', title: 'Dwight does parkour', by: 'The Office', w: 480, h: 270, sound: true },
  saulExcited: { id: 'Uojd2d8kGffrVlDz38', title: 'Saul Goodman, excited', by: 'Better Call Saul', w: 500, h: 280, small: true },
  saulGood: { id: 'W0EH9ohnxpvV5oSftf', title: 'Saul Goodman: “I’m good”', by: 'Better Call Saul', w: 500, h: 280, small: true },
  helloThere: { id: '3ornk57KwDXf81rjWM', title: 'Obi-Wan Kenobi: “Hello there”', by: 'Star Wars', w: 453, h: 244, small: true },
  helloThereSith: { id: 'xTiIzJSKB4l7xTouE8', title: 'Obi-Wan Kenobi: “Hello there”', by: 'Star Wars', w: 480, h: 208, small: true },
  deathStar: { id: 'l2JJOhaiTmwJSYaVG', title: 'The Death Star', by: 'Star Wars', w: 500, h: 213, small: true },
  alderaan: { id: '3K0D1Dkqh9MOmLSjzW', title: 'The Death Star fires on Alderaan', by: 'Star Wars', w: 480, h: 270, small: true },
  trenchRun: { id: 'l0IpWBta9aL7GOoE0', title: 'Vader’s TIE fighters chase an X-wing down the trench', by: 'Star Wars', w: 400, h: 170, small: true },
  yavin: { id: '1xo9COytfPE9chS05b', title: 'Luke’s torpedoes find the exhaust port, and the Death Star explodes', by: 'Star Wars', w: 480, h: 270, small: true },
  snap: { id: 'iIFS20pNoCg1EEVodC', title: 'Thanos snaps', by: 'Marvel Studios', w: 360, h: 360, small: true },
};

export const gifPage = (id) => `https://giphy.com/gifs/${id}`;
const RENDITION = { small: '200w', medium: '200' };
export const gifVideo = (g, size = 'small') => `https://media.giphy.com/media/${g.id}/${(g.small && RENDITION[size]) || 'giphy'}.mp4`;
