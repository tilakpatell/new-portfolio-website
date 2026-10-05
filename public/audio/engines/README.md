# Engines

What the ships sound like on the universe map and in the cockpits
(`src/components/universe/sounds.js`). Each engine file holds three identical
periods of a seamless loop and the site loops the middle one, so the mp3
encoder's padding at either end never lands in it; its pitch, tone and
volume follow the ship's speed.

| File | What | From |
| --- | --- | --- |
| xwing.mp3 | an X-wing's roar, its loudness evened out and looped | Star Wars (Lucasfilm), from [Myinstants](https://www.myinstants.com) (`x-wing.mp3`) |
| xwing-pass.mp3 | an X-wing going past: the boost | the same recording, whole |
| falcon.mp3 | the Millennium Falcon's engines, looped, the top end rolled off | Star Wars (Lucasfilm), from [Myinstants](https://www.myinstants.com) (`millenium-falcon.mp3`) |
| falcon-pass.mp3 | the Falcon's roar: its boost after the first jump | the same recording, its first burst |
| rv.mp3 | an engine idling, looped, for the RV | from [Myinstants](https://www.myinstants.com) (`car-engine.mp3`) |
| cruiser.mp3 | a warbling space engine for Rick's cruiser, until the show's own turns up | Kenney's [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (`spaceEngine_000`), CC0 |
| thruster.mp3 | a thruster firing: the cruiser's and the RV's boost | Kenney's [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds) (`thrusterFire_000`), CC0 |

To swap one, keep the three-period layout and put its period, in seconds, in
`ENGINES` in `sounds.js`.
