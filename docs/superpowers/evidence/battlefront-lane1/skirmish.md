# Battlefront lane 1: the skirmish table

`node scripts/battlefront-balance.mjs --skirmish --runs 10 --profile` on 2026-10-10: twenty bots a side (the Rebels team 1, the Empire team 2, classes round-robin), Hoth's arena navgrid (`src/lib/battlefront/fixtures/hothFlat.js`: the map's bounds, a plane fitted through its 474 spawns, 1,835 solids made up round the Galactic Assault volumes, 27,540 cover slots), three minutes of sim, no player, no mode and so no respawns. "Stuck" is a bot alive, not in cover or hiding, on one spot for 20 s; "offNav" a bot off walkable ground at a 100th step. The arena test (`npm run test:ai -- src/lib/battlefront`) asserts seed 1's row.

```
seed  kills1  kills2  alive1  alive2  stuck  offNav  ms
1       19      9       11      1       0       0       1777  
2       17      11      9       3       0       0       2051  
3       19      7       13      1       0       0       2093  
4       19      14      6       1       0       0       2146  
5       18      12      8       2       0       0       1734  
6       20      9       11      0       0       0       1906  
7       11      18      2       9       0       0       2071  
8       19      6       14      1       0       0       2089  
9       14      19      1       6       0       0       3124  
10      20      10      10      0       0       0       1587  

10 runs, 20 a side, 180 s: kills 17.6 (Rebels) to 11.5 (Empire); more alive at the end: Rebels 8, Empire 2, even 0; stuck 0, off the navgrid 0; 2057.8 ms a run
profile: think 30.3 %, bolts.step 2.0 %, findPath 25.2 %
```

What it says:

- Both sides kill in every run (6 to 20 a side), nobody is stuck and nobody leaves the navgrid; a run is about 2 s of Node.
- The Rebels win 8 of 10. Nothing in the rules favours them (the two sides' classes carry the same health and the same guns' numbers: A280/E-11, RT-97C/DLT-19, DH-17/RK-3, DLT-20A/DLT-19X); they open on Hoth's defenders' side of the front, where the made-up walls round the volumes are, and the Empire walks into them. Lane 2's stages, spawn waves and objectives are what should even this out (the spec's 40 to 60 percent is for Galactic Assault, not this).
- Time goes to thinking (cover queries, perception's line tests) and finding paths, a quarter each; bolts are cheap.

## The bots lane (the sixth design): the game's targeting and cover queries

The same command, 2026-10-10 (late night), three times: `main` as the lane found it, after the targeting (`ai/targeting.js`: the AI system's scores and the squad coordinator), and after the cover queries (`ai/coverQuery.js`: the tactics' own queries in the selection form, `cover.js` the fallback). Main had already drifted from the table above (the Empire's 11.5 to 7.7, from lane 2's and later changes).

| | kills (Rebels) | kills (Empire) | more alive: Rebels / Empire | stuck | off |
|---|---|---|---|---|---|
| `main` (`3883c758`) | 18.3 | 7.7 | 9 / 1 | 0 | 0 |
| + targeting | 17.3 | 7.8 | 9 / 1 | 0 | 0 |
| + cover queries | 16.9 | 8.3 | 8 / 2 | 0 | 0 |

The last run's seeds:

```
seed  kills1  kills2  alive1  alive2  stuck  offNav  ms
1       20      2       18      0       0       0       1913  
2       20      2       18      0       0       0       1996  
3       20      5       15      0       0       0       3273  
4       20      2       18      0       0       0       1679  
5       4       20      0       16      0       0       1894  
6       20      11      9       0       0       0       3304  
7       19      14      6       1       0       0       2865  
8       10      20      0       10      0       0       2440  
9       19      2       18      1       0       0       3667  
10      17      5       15      3       0       0       2976  

10 runs, 20 a side, 180 s: kills 16.9 (Rebels) to 8.3 (Empire); more alive at the end: Rebels 8, Empire 2, even 0; stuck 0, off the navgrid 0; 2600.7 ms a run
```

What it says: the means barely move (the Empire a little better off), stuck and off stay 0, but the runs go to routs more often (20 to 2 on four seeds, 4 to 20 and 10 to 20 the other way): a side that takes the queries' cover first now holds it. Seed 1 is one of the routs, so the arena test counts kills over seeds 1 to 3 (each side at least two a run on average) rather than seed 1 alone; the balance is not tuned.
