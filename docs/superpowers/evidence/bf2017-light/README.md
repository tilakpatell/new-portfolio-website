# Lane G: the worlds under the game's light, before and after

Each pair is the same view under the site's own light (`?gamelight=off`, before) and under the game's (after), at `?quality=high`, 1280 × 720, through `scripts/surface-shot.mjs` on the software renderer (SwiftShader), shrunk to 960 wide. The mean luminance is the linear luminance of the frame below the nav bar (rows 80 to 620).

The calibration is Hoth's ice field: `GAME_TO_SITE` 0.0713 and `SKY_TO_SITE` 0.2006 put its after within 0.1 % of its before, and are then held for every world. Hoth's speeder and room shots were taken before the meter learned the sky (a 0.04 stop change on Hoth).

| view | before | after | change |
|---|---|---|---|
| hoth-field | 0.3529 | 0.3531 | +0.0 % |
| hoth-speeder | 0.1576 | 0.1008 | -36.0 % |
| hoth-room | 0.1272 | 0.1054 | -17.1 % |
| tatooine | 0.3316 | 0.4135 | +24.7 % |
| yavin | 0.1467 | 0.1525 | +4.0 % |
| kashyyyk | 0.1893 | 0.2632 | +39.0 % |
| naboo | 0.2295 | 0.0877 | -61.8 % |
| kamino | 0.1343 | 0.1527 | +13.8 % |
| geonosis | 0.1704 | 0.1680 | -1.4 % |
| scarif | 0.4122 | 0.4167 | +1.1 % |
| bespin | 0.3100 | 0.3342 | +7.8 % |
- **Hoth**: the game's sun stands at 33° (the site's at 11.5°); the snow bluer, the sky deeper. Under the hangar's roof only the fill lights, and the game's (0.61) is under the site's (0.9): darker (`hoth-speeder`). The room takes the interior's grade (`hoth-room`). `hoth-dusk-after` is the sunset weather (`__surfaceDo('weather', 'dusk')`, dev only): the game's sunset probe is a day's, so it reads pale rather than orange, and its fill is twice noon's.
- **Naboo** is not wired: its level is Theed at dusk (350 lux, 5° up), and under the one calibration the field is 62 % darker, its people in silhouette; the game's dusk is carried by Enlighten's bounce and its lamps, which the site does not draw. Its JSON is kept.
- **Kamino** is a storm: teal and dark, as the game's. **Tatooine** and **Kashyyyk** are brighter under their records' higher suns and skies. **Geonosis**, **Scarif**, **Bespin** and **Yavin** are within 8 %, graded by their LUTs.
- **Endor** is wired and not shot: its surface does not finish loading under the software renderer, before or after.
