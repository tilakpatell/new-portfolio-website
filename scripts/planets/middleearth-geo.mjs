// Middle-earth at the end of the Third Age, as the planet wears it: the lands
// on the map in The Lord of the Rings (Christopher Tolkien's general map),
// placed on the same 800×560 sheet the site's own drawn map uses
// (src/components/middleearth/mapData.js: the Grey Havens at 92,200, Minas
// Tirith at 520,444, Barad-dûr at 712,392 and the rest where that has them),
// and carried on past its edges: Forodwaith to the pole, the East and the
// Red Mountains beyond Rhûn, Harad down to its southern shore. x runs east,
// y south. Lines are smoothed through their points.

// The coast of the whole continent, clockwise from the far north-west.
export const COAST = [
  [-40, -120], [10, -80], [-10, -52], [24, -40], [70, -36], [118, -24], [146, -4], [118, 10], [72, 8], [42, 20],
  // Forlindon and the Gulf of Lhûn, with the Grey Havens at its head
  [24, 40], [28, 84], [20, 132], [32, 168], [54, 186], [76, 190], [93, 196], [95, 205], [78, 213], [52, 226],
  // Harlindon, Minhiriath, the Baranduin's and the Gwathló's mouths, Andrast
  [40, 258], [52, 298], [78, 328], [108, 346], [140, 362], [170, 376], [190, 386], [214, 396], [238, 410], [252, 421], [262, 434], [278, 448], [292, 462], [282, 478], [298, 490],
  // the Bay of Belfalas: Dol Amroth on its point, the mouths of Anduin
  [326, 496], [348, 504], [372, 508], [396, 506], [410, 512], [418, 522], [426, 512], [452, 520], [482, 527], [506, 533], [526, 539], [540, 550], [554, 553],
  // Harondor and the Haven of Umbar, then Harad's coast south
  [562, 566], [557, 592], [542, 622], [520, 652], [500, 672], [482, 680], [468, 692], [462, 702], [474, 712], [452, 724], [446, 748], [452, 776], [470, 804],
  [530, 822], [610, 834], [690, 826], [770, 836], [850, 818], [920, 790], [980, 744], [1030, 684], [1080, 606], [1118, 520],
  // the far east, past the Red Mountains
  [1140, 430], [1150, 340], [1176, 244], [1150, 150], [1120, 66], [1078, -6], [1020, -58], [950, -88], [860, -106], [760, -114], [640, -122], [500, -118], [380, -128], [260, -132], [140, -136], [40, -138],
];

// Lakes and inland seas, each a closed line.
export const LAKES = [
  // the Sea of Rhûn
  [[690, 238], [702, 214], [732, 204], [768, 212], [794, 236], [800, 262], [786, 284], [758, 296], [726, 292], [704, 280], [692, 260]],
  // the Sea of Núrnen
  [[664, 486], [690, 474], [724, 472], [752, 480], [750, 494], [722, 500], [690, 500]],
  // Lake Evendim (Nenuial)
  [[176, 108], [186, 100], [200, 104], [202, 116], [190, 122], [178, 118]],
  // Nen Hithoel, above Rauros
  [[506, 342], [511, 341], [513, 356], [509, 364], [505, 356]],
  // the Long Lake, under the Lonely Mountain
  [[601, 86], [606, 86], [608, 104], [603, 108], [600, 98]],
];

// Rivers: [width, points from source to mouth].
export const RIVERS = [
  // the Great River, past Lórien, the Argonath and Rauros, Osgiliath and Pelargir, into the Bay of Belfalas
  [2.6, [[480, 14], [478, 60], [472, 120], [468, 190], [470, 246], [478, 284], [492, 314], [504, 336], [509, 360], [516, 380], [530, 400], [542, 420], [548, 436], [555, 462], [560, 490], [553, 515], [546, 534], [541, 549]]],
  // the Baranduin, from Evendim past the Shire to the sea
  [1.7, [[192, 120], [198, 160], [208, 198], [214, 222], [218, 260], [212, 310], [200, 350], [190, 385]]],
  // the Hoarwell and the Greyflood (Gwathló), past Tharbad
  [1.9, [[336, 150], [324, 214], [312, 264], [300, 300], [286, 340], [268, 384], [252, 420]]],
  // the Loudwater, from Rivendell
  [1.1, [[356, 188], [338, 200], [326, 214]]],
  // the Glanduin
  [1.0, [[380, 322], [346, 312], [306, 300]]],
  // the Isen, through the Gap of Rohan to the sea
  [1.4, [[378, 362], [370, 390], [352, 412], [326, 440], [298, 458]]],
  // the Entwash, from Fangorn to the Mouths of Entwash
  [1.3, [[414, 346], [440, 368], [470, 388], [500, 398], [524, 396]]],
  // the Limlight
  [1.0, [[420, 300], [458, 304], [484, 300]]],
  // the Celduin, the River Running, from the Lonely Mountain to the Sea of Rhûn
  [1.4, [[592, 70], [603, 92], [624, 130], [654, 174], [688, 214], [706, 236]]],
  // the Carnen, the Redwater, from the Iron Hills
  [1.1, [[690, 56], [704, 120], [708, 180], [702, 224]]],
  // the Forest River
  [1.0, [[562, 92], [586, 96], [602, 96]]],
  // the Poros and the Harnen, the borders of Harondor
  [1.1, [[594, 520], [572, 536], [556, 548]]],
  [1.2, [[612, 600], [580, 618], [550, 622]]],
  // the Morthond, past Erech to the sea
  [1.0, [[392, 452], [398, 486], [404, 506]]],
];

// Mountains: [width, height (0…1), snowy, points]. Heights are the land's
// rise in the relief; snow takes the higher ones' tops.
export const RANGES = [
  // the Blue Mountains, cut by the Gulf of Lhûn
  [12, 0.55, true, [[120, 14], [112, 70], [106, 130], [100, 178]]],
  [12, 0.5, true, [[102, 226], [110, 270], [120, 308], [132, 334]]],
  // the Misty Mountains, Gundabad to Methedras, Caradhras by the Dimrill Dale
  [20, 1.0, true, [[402, -6], [397, 40], [389, 92], [382, 142], [378, 190], [386, 238], [393, 266], [388, 300], [380, 338]]],
  // the Grey Mountains, and the Iron Hills east of them
  [14, 0.75, true, [[402, 30], [450, 22], [500, 28], [550, 24], [582, 36]]],
  [12, 0.5, false, [[640, 40], [680, 46], [722, 40]]],
  // the White Mountains, Mindolluin to Andrast
  [18, 0.95, true, [[516, 440], [496, 432], [466, 428], [430, 430], [394, 434], [360, 442], [328, 454], [302, 472]]],
  // Mordor's walls: the Mountains of Shadow, south from the Morannon, out
  // west round the Morgul Vale and bending east along the south (no
  // square corner), and the Ash Mountains along the north
  [13, 0.8, false, [[582, 366], [574, 384], [570, 404], [574, 424], [581, 440], [577, 458], [573, 476], [579, 494], [593, 510], [612, 522], [636, 530], [662, 536], [690, 534], [720, 530], [748, 526], [772, 522]]],
  [13, 0.8, false, [[584, 362], [620, 356], [670, 352], [720, 354], [770, 360], [804, 374]]],
  // the Emyn Muil, the Weather Hills, the Barrow-downs, the Tower Hills, Dunland's hills, the Hills of Evendim
  [18, 0.3, false, [[504, 334], [524, 346], [542, 356]]],
  [8, 0.3, false, [[278, 180], [284, 214]]],
  [8, 0.2, false, [[212, 236], [222, 252]]],
  [6, 0.2, false, [[122, 210], [130, 222]]],
  [18, 0.35, false, [[334, 384], [346, 410]]],
  [8, 0.2, false, [[178, 96], [204, 100]]],
  // the Mountains of Mirkwood
  [10, 0.3, false, [[535, 140], [552, 176]]],
  // the Red Mountains, the Orocarni, far in the East
  [22, 0.95, true, [[1000, 60], [1028, 170], [1048, 290], [1036, 420], [1010, 520]]],
  // and Harad's own ranges, each two or three ridges side by side, offset
  // and broken, as desert ranges are (not one smooth line)
  [12, 0.7, false, [[694, 612], [722, 622], [748, 632], [778, 644]]],
  [12, 0.62, false, [[744, 652], [772, 660], [804, 664], [834, 658], [860, 648]]],
  [9, 0.48, false, [[806, 630], [834, 632], [866, 628]]],
  [11, 0.5, false, [[594, 706], [608, 722], [622, 740], [630, 754]]],
  [9, 0.42, false, [[616, 718], [632, 736], [646, 754], [654, 770]]],
  [12, 0.56, false, [[872, 460], [884, 482], [894, 504], [904, 530]]],
  [10, 0.5, false, [[894, 492], [906, 516], [918, 540], [932, 566]]],
  [8, 0.38, false, [[862, 502], [870, 520], [880, 540]]],
];

// Lone peaks: [x, y, radius, height]. Orodruin, Erebor, Amon Hen and Amon Lhaw.
export const PEAKS = [
  [652, 410, 9, 0.9],
  [590, 62, 9, 0.9],
  [503, 362, 4, 0.3],
  [516, 362, 4, 0.3],
];

// Forests: [kind, points]. dark: Mirkwood; gold: Lothlórien; old: Fangorn
// and the Old Forest; green: the rest.
export const FORESTS = [
  ['dark', [[490, 70], [560, 60], [586, 78], [596, 140], [588, 168], [594, 204], [580, 250], [546, 266], [506, 262], [492, 218], [486, 150]]],
  ['gold', [[440, 270], [462, 268], [470, 286], [456, 298], [438, 292]]],
  ['old', [[384, 332], [410, 326], [428, 338], [422, 358], [396, 362], [382, 350]]],
  ['old', [[222, 230], [242, 228], [246, 240], [230, 246]]],
  ['green', [[250, 194], [262, 192], [264, 204], [252, 206]]],
  ['green', [[312, 182], [332, 180], [336, 194], [316, 198]]],
  ['green', [[124, 348], [148, 346], [150, 362], [126, 364]]],
  ['green', [[522, 426], [536, 424], [538, 434], [522, 436]]],
  ['green', [[474, 426], [484, 426], [484, 434], [474, 434]]],
  // Ithilien, the garden of Gondor under the Mountains of Shadow
  ['green', [[562, 398], [572, 398], [572, 470], [566, 512], [558, 510], [560, 460]]],
  // the forests of Far Harad, under the equator
  ['jungle', [[620, 690], [760, 680], [880, 700], [960, 690], [1000, 640], [980, 740], [900, 790], [760, 820], [620, 812], [560, 780], [580, 720]]],
];

// Lands that colour the ground: [name, blur, points].
export const LANDS = {
  // Mordor, inside its walls; Gorgoroth its north-west, Nurn its south
  mordor: [[584, 364], [804, 372], [790, 450], [776, 524], [748, 524], [720, 528], [690, 532], [662, 532], [636, 526], [612, 518], [596, 506], [584, 490], [578, 470], [580, 440], [576, 418], [574, 398], [578, 380]],
  gorgoroth: [[584, 366], [720, 360], [710, 440], [640, 456], [584, 440]],
  rohan: [[392, 362], [430, 352], [482, 340], [506, 356], [524, 392], [512, 424], [470, 424], [420, 424], [390, 410], [374, 386]],
  shire: [[134, 196], [176, 186], [210, 196], [214, 230], [196, 254], [158, 252], [136, 236]],
  gondor: [[330, 456], [420, 438], [512, 444], [558, 470], [562, 520], [520, 534], [450, 518], [400, 500], [340, 496]],
  brown: [[498, 268], [560, 268], [590, 296], [590, 336], [548, 336], [512, 326], [496, 300]],
  marsh: [[550, 332], [576, 330], [584, 352], [560, 356]],
  dunland: [[300, 340], [360, 350], [372, 400], [330, 420], [296, 400]],
  harad: [[560, 540], [700, 530], [800, 530], [900, 540], [1000, 560], [1060, 600], [1000, 680], [900, 700], [760, 690], [620, 700], [540, 680], [530, 600]],
  rhun: [[640, 120], [800, 110], [960, 130], [990, 260], [960, 380], [810, 380], [800, 300], [690, 300], [650, 220]],
  angmar: [[260, 40], [380, 30], [380, 110], [300, 120], [250, 90]],
};

// Lights at night: [x, y, brightness, colour]. Cities first, then the
// farms and villages scattered round them.
export const CITIES = [
  [520, 444, 1.0, '#ffe6b0'], // Minas Tirith
  [560, 500, 0.55, '#ffd9a0'], // Pelargir
  [414, 512, 0.6, '#ffe2b8'], // Dol Amroth
  [418, 410, 0.45, '#ffd28a'], // Edoras
  [380, 398, 0.25, '#ffd28a'], // Helm's Deep
  [378, 362, 0.8, '#ff9a3a'], // Isengard, its pits and forges
  [246, 212, 0.35, '#ffd9a0'], // Bree
  [160, 215, 0.3, '#ffe2a8'], // Hobbiton
  [352, 190, 0.3, '#e6eeff'], // Rivendell
  [92, 200, 0.35, '#e0ecff'], // the Grey Havens
  [604, 96, 0.45, '#ffd9a0'], // Esgaroth
  [590, 66, 0.35, '#ffcf70'], // Erebor and Dale
  [470, 702, 0.6, '#ffb870'], // Umbar
  [548, 436, 0.12, '#ffc890'], // Osgiliath, in ruins
];
// regions with scattered villages: [x, y, rx, ry, count, brightness]
export const FARMS = [
  [170, 222, 34, 22, 90, 0.18], // the Shire
  [470, 480, 70, 30, 120, 0.2], // Lebennin and Lossarnach
  [440, 392, 50, 22, 50, 0.14], // the Westfold and the Eastfold
  [246, 214, 14, 10, 14, 0.15], // Bree-land
  [610, 120, 30, 24, 20, 0.14], // Dale
  [700, 600, 90, 40, 70, 0.16], // Near Harad
  [860, 250, 90, 70, 60, 0.12], // the Easterlings
  [700, 492, 50, 14, 40, 0.14], // Nurn's slave-farms
];
