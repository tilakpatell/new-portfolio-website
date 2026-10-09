// What Rick and Morty say on each of the sector's big planets, in each
// planet's own words, keyed as the galaxy's surface lines are (surface/
// lines.js: by crew, and only the cruiser's crew comes here): climbing out
// of the cruiser (`landing`, the site's lines.out: ./index.js lays it in),
// and the end of the planet's mission (`won`, `lost`: the mission's own
// lines, missions/index.js, when each planet's phase writes it). A quest's
// own lines are in its site file. Each line has a key for the desktop's
// voices job (./voicelines.js).

export const LINES = {
  gazorpazorp: {
    landing: {
      cruiser: [
        ['morty', 'Gazorpazorp. I-I’ve got a son here, Rick. Somewhere.'],
        ['rick', 'Red sand, angry men and a city full of women who hate both, Morty. Keep your head down.'],
      ],
    },
    won: { cruiser: [['rick', 'Outran a whole wasteland of them, Morty. Mar-Sha owes us a drink.']] },
    lost: { cruiser: [['morty', 'They caught us, Rick!'], ['rick', 'They caught a sled, Morty. We go again.']] },
  },
  squanch: {
    landing: {
      cruiser: [
        ['rick', 'Planet Squanch, Morty. Don’t ask what squanch means. It means everything.'],
        ['morty', 'Is— is that a party? It’s the middle of the day.'],
      ],
    },
    won: { cruiser: [['rick', 'Squanched it, Morty.']] },
    lost: { cruiser: [['morty', 'That got really out of squanch, Rick.']] },
  },
  birdworld: {
    landing: {
      cruiser: [
        ['morty', 'Wow. It’s all nests and cliffs, Rick.'],
        ['rick', 'Bird World, Morty. Birdperson’s people. Mind the ledges: nobody here bothered with railings.'],
      ],
    },
    won: { cruiser: [['rick', 'Birdperson would say something about wings and honour, Morty. I’ll just say: nice.']] },
    lost: { cruiser: [['morty', 'I don’t think I’m built for the sky, Rick.']] },
  },
  gearworld: {
    landing: {
      cruiser: [
        ['rick', 'Gear World, Morty. Everything’s a gear. Don’t mention it. They get weird about it.'],
        ['morty', 'Rick, the ground’s ticking.'],
      ],
    },
    won: { cruiser: [['rick', 'Like clockwork, Morty. Literally.']] },
    lost: { cruiser: [['morty', 'We threw a spanner in it, Rick.'], ['rick', 'Don’t say spanner here, Morty.']] },
  },
  pluto: {
    landing: {
      cruiser: [
        ['morty', 'It’s freezing, Rick. Is this even a planet?'],
        ['rick', 'Say that louder, Morty. I dare you. They’ve got a king about it.'],
      ],
    },
    won: { cruiser: [['rick', 'Pluto’s a planet, Morty. For today.']] },
    lost: { cruiser: [['morty', 'They think we’re anti-planet, Rick!']] },
  },
  snakeplanet: {
    landing: {
      cruiser: [
        ['morty', 'Snakes, Rick. Snakes in spacesuits.'],
        ['rick', 'They’ve got a space programme, Morty. Ssss. Hiss. Don’t step on anything that hisses back.'],
      ],
    },
    won: { cruiser: [['rick', 'Snake jazz, Morty. We earned it.']] },
    lost: { cruiser: [['morty', 'They’re really good at this, Rick.'], ['rick', 'They’ve got no arms, Morty. Don’t tell them that.']] },
  },
  purge: {
    landing: {
      cruiser: [
        ['morty', 'It’s so peaceful, Rick. Look at the farms.'],
        ['rick', 'Give it till sundown, Morty. Once a year, these cat people let it all out.'],
      ],
    },
    won: { cruiser: [['rick', 'Sun’s up, Morty. We made it through the night.']] },
    lost: { cruiser: [['morty', 'I- I didn’t want to purge, Rick!'], ['rick', 'Nobody wants to, Morty. That’s the purge.']] },
  },
  cronenberg: {
    landing: {
      cruiser: [
        ['morty', 'Rick. This is our street. This is our street.'],
        ['rick', 'We broke it, Morty, and we left. Don’t touch the neighbours.'],
      ],
    },
    won: { cruiser: [['rick', 'Our old Earth, Morty. Still standing. Sort of.']] },
    lost: { cruiser: [['morty', 'They don’t even look like people any more, Rick.']] },
  },
};
