# The Rick and Morty wiki, harvested: what the universe holds, and what the site already has

Date: 2026-10-06. Source: the Rick and Morty Fandom wiki (rickandmorty.fandom.com) through its MediaWiki API, and rickandmortyapi.com for a structured list of 826 characters, 126 locations and 51 episodes with appearance counts. Harvested by a script in the session scratchpad (`api.php?action=query&list=categorymembers`, `prop=revisions|pageimages`); the plan's Task 0 puts a reusable version at `scripts/wiki-refs.mjs`.

This is the raw catalogue the design spec (`docs/superpowers/specs/2026-10-06-rick-and-morty-multiverse-design.md`) picks from. Names are the wiki's own page titles, so a reference sheet can be fetched by name. Where the site already has something (a Meshy model, a drawn place, a code-built figure) it says so.

## Size of the universe (wiki category counts)

| Category | Pages |
| --- | ---: |
| Characters | 1062 |
| Recurring Characters | 97 |
| One-Time Characters | 482 |
| Antagonists | 290 |
| Deceased Characters | 428 |
| Locations | 343 |
| Recurring Locations | 56 |
| Commercial Locations | 63 |
| Planets | 78 |
| Dimensions | 91 |
| Vehicles | 12 |
| Weapons | 17 |
| Gadgets | 55 |
| Objects | 167 |
| Races | 131 |
| Aliens | 371 |
| Robots | 43 |
| Animals | 79 |
| Monsters | 41 |
| Groups | 39 |
| Gods | 15 |
| Superheroes | 29 |
| Interdimensional Cable Characters | 48 |
| The Citadel | 14 |
| Smith Residence | 13 |
| Rooms | 20 |
| Episodes | 92 |
| Games | 45 |

rickandmortyapi.com: 826 characters, 126 locations, 51 episodes. Species there: Human 366, Alien 205, Humanoid 68, Animal 55, Robot 51, Mythological Creature 46, unknown 13, Poopybutthole 8.

## Who matters most: characters by episodes appeared in (rickandmortyapi.com)

The count is how many of the 51 catalogued episodes the character is in; duplicates are the same person from another dimension (C-137 vs the replacement dimension). `Site` says what the repo already has.

| Character | Species | Origin | Eps | Site |
| --- | --- | --- | ---: | --- |
| Rick Sanchez | Human | Earth (C-137) | 51 | Meshy, HD, rigged |
| Morty Smith | Human | unknown | 51 | Meshy, HD, rigged |
| Summer Smith | Human | Earth (Replacement Dimension) | 42 | Meshy, rigged |
| Beth Smith | Human | Earth (Replacement Dimension) | 42 | Meshy, rigged |
| Jerry Smith | Human | Earth (Replacement Dimension) | 39 | Meshy, rigged |
| Jessica | Human · Time God | Earth (Replacement Dimension) | 12 | Meshy, rigged (school) |
| Mr. Goldenfold | Human | Earth (Replacement Dimension) | 10 | Meshy, rigged |
| Beth Smith | Human | Earth (C-137) | 8 | Meshy, rigged |
| Jessica's Friend | Human | Earth (C-137) | 8 |  |
| Snuffles (Snowball) | Animal · Dog | Earth (C-137) | 8 | Meshy, prop (exo-suit only) |
| Birdperson | Alien · Bird-Person | Bird World | 7 | code-built wingman on the map only |
| Jerry Smith | Human | Earth (C-137) | 7 | Meshy, rigged |
| Mr. Poopybutthole | Poopybutthole | unknown | 7 |  |
| Summer Smith | Human | Earth (C-137) | 7 | Meshy, rigged |
| Nancy | Human | Earth (Replacement Dimension) | 6 |  |
| Principal Vagina | Human | Earth (Replacement Dimension) | 6 | Meshy, rigged |
| Arcade Alien | Alien | unknown | 5 |  |
| Mr. Meeseeks | Humanoid · Meeseeks | Mr. Meeseeks Box | 5 | Meshy, rigged (Portal panic) |
| Tammy Guetermann | Human | Earth (Replacement Dimension) | 5 | Meshy, rigged |
| President Curtis | Human | Earth (Replacement Dimension) | 5 | Meshy, rigged |
| Traflorkian | Alien · Traflorkian | unknown | 5 |  |
| Tricia Lange | Human | Earth (Replacement Dimension) | 5 |  |
| Bepisian | Alien · Bepisian | Bepis 9 | 4 |  |
| Brad | Human | Earth (Replacement Dimension) | 4 | Meshy, rigged |
| Cynthia | Human | Earth (Replacement Dimension) | 4 |  |
| Mr. Goldenfold | Cronenberg | Earth (C-137) | 4 | Meshy, rigged |
| Mrs. Sanchez | Human | unknown | 4 |  |
| Scrotian | Animal · Scrotian | unknown | 4 |  |
| Zeta Alpha Rick | Human | unknown | 4 | a Council voice |
| Greebybobe | Alien · Greebybobe | Girvonesk | 4 |  |
| Trunkphobic suspenders guy | Human | unknown | 4 |  |
| Pripudlian | Alien · Pripudlian | unknown | 4 |  |
| Aqua Rick | Humanoid · Fish-Person | unknown | 3 |  |
| Attila Starwar | Human | unknown | 3 |  |
| Benjamin | Poopybutthole | unknown | 3 |  |
| Cyclops Rick | Humanoid | unknown | 3 |  |
| Evil Morty | Human | unknown | 3 | Meshy, rigged |
| Flansian | Alien · Flansian | unknown | 3 |  |
| Fulgora | Human | unknown | 3 |  |
| Gar Gloonch | Alien · Zombodian | unknown | 3 |  |
| Garblovian | Alien · Garblovian | Glaagablaaga | 3 |  |
| Jessica | Cronenberg | Earth (C-137) | 3 | Meshy, rigged (school) |
| Larva Alien | Alien · Larva alien | Larva Alien's Planet | 3 |  |
| Loggins | Alien · Alligator-Person | unknown | 3 |  |
| Maximums Rickimus | Human | unknown | 3 |  |
| MC Haps | Human | Earth (C-137) | 3 |  |
| Principal Vagina | Cronenberg | Earth (C-137) | 3 | Meshy, rigged |
| Quantum Rick | Human | unknown | 3 |  |
| Revolio Clockberg Jr. | Alien · Gear-Person | Gear World | 3 |  |
| Ricktiminus Sancheziminius | Human | unknown | 3 | a Council voice |
| Riq IV | Human | unknown | 3 |  |
| Shimshamian | Alien · Shimshamian | unknown | 3 |  |
| Squanchy | Alien · Cat-Person | Planet Squanch | 3 |  |
| Stair Goblin | Mythological Creature · Stair goblin | unknown | 3 |  |
| Tophat Jones | Mythological Creature · Leprechaun | unknown | 3 |  |
| Arbolian Mentirososian | Alien | Árboles Mentirosos | 3 |  |
| Phoenixperson | Alien · Cyborg | Bird World | 3 | code-built bounty hunter on the map only |
| Abradolf Lincler | Human · Genetic experiment | Earth (Replacement Dimension) | 2 |  |
| Antenna Morty | Human · Human with antennae | unknown | 2 |  |
| Aqua Morty | Humanoid · Fish-Person | unknown | 2 |  |
| Artist Morty | Human | unknown | 2 |  |
| Black Rick | Human | unknown | 2 |  |
| Boobloosian | Alien · Boobloosian | unknown | 2 |  |
| Cowboy Rick | Human | unknown | 2 | Meshy, rigged |
| Cronenberg Rick | Cronenberg | Cronenberg Earth | 2 |  |
| Cronenberg Morty | Cronenberg | Cronenberg Earth | 2 |  |
| Cyclops Morty | Humanoid | unknown | 2 |  |
| Davin | Human | Earth (C-137) | 2 |  |
| Diane Sanchez | Human | Earth (C-137) | 2 |  |
| Doofus Rick | Human | Earth (J19ζ7) | 2 | crowd copy only (unrigged) |

## Places by how many characters live there (rickandmortyapi.com)

| Location | Type | Dimension | Residents | Site |
| --- | --- | --- | ---: | --- |
| Earth (Replacement Dimension) | Planet | Replacement Dimension | 230 |  |
| Citadel of Ricks | Space station | unknown | 101 |  |
| Interdimensional Cable | TV | unknown | 62 | the TV toy |
| Earth (C-137) | Planet | Dimension C-137 | 27 |  |
| Story Train | Diegesis | Replacement Dimension | 27 |  |
| Snake Planet | Planet | Replacement Dimension | 15 |  |
| Anatomy Park | Microverse | Dimension C-137 | 11 |  |
| Nuptia 4 | Planet | unknown | 11 |  |
| Planet Squanch | Planet | Replacement Dimension | 11 |  |
| Narnia Dimension | Dimension | Fantasy Dimension | 11 |  |
| Rick's Memories | Memory |  | 11 |  |
| Post-Apocalyptic Earth | Planet | Post-Apocalyptic Dimension | 10 |  |
| Heist-Con | Convention | Replacement Dimension | 10 |  |
| Worldender's lair | Planet | unknown | 9 |  |
| St. Gloopy Noops Hospital | Space station | unknown | 9 |  |
| Mr. Goldenfold's dream | Dream | Dimension C-137 | 8 |  |
| Jerryboree | Daycare | unknown | 8 |  |
| Glorzo Asteroid | Asteroid | Replacement Dimension | 8 |  |
| Tickets Please Guy Nightmare | Nightmare | Replacement Dimension | 7 |  |
| Hell | Hell | Replacement Dimension | 7 |  |
| Unity's Planet | Planet | Replacement Dimension | 6 |  |
| Pluto | Dwarf planet (Celestial Dwarf) | Replacement Dimension | 6 |  |
| Earth (Fascist Dimension) | Planet | Fascist Dimension | 6 |  |
| Earth (Wasp Dimension) | Planet | Wasp Dimension | 6 |  |
| Draygon | Planet | Magic Dimension | 6 |  |
| Morty’s Story | Diegesis | Replacement Dimension | 6 |  |
| Ricks’s Story | Diegesis | Replacement Dimension | 6 |  |
| Merged Universe | Dimension | Merged Dimension | 6 |  |
| Earth (C-500A) | Planet | Dimension C-500A | 5 |  |
| Roy: A Life Well Lived | Game | Replacement Dimension | 5 | playable |
| Earth (Evil Rick's Target Dimension) | Planet | Evil Rick's Target Dimension | 5 |  |
| Resort Planet | Planet | unknown | 5 |  |
| Alphabetrium | Planet | Replacement Dimension | 5 |  |
| Heistotron Base | Space station | Replacement Dimension | 5 |  |
| Gaia | Planet | Replacement Dimension | 5 |  |
| Birdperson's Consciousness | Consciousness | Replacement Dimension | 5 |  |
| Purge Planet | Planet | Replacement Dimension | 4 |  |
| Earth (Unknown dimension) | Planet | unknown | 4 |  |
| Zigerion's Base | Space station | Dimension C-137 | 4 |  |
| Fantasy World | Planet | Fantasy Dimension | 4 |  |
| Earth (Chair Dimension) | Planet | Chair Dimension | 4 |  |
| Earth (Fascist Shrimp Dimension) | Planet | Fascist Shrimp Dimension | 4 |  |
| Monogatron Mothership | Space station | Replacement Dimension | 4 |  |
| Alien Acid Plant | Acid Plant | Replacement Dimension | 4 |  |
| Near-Duplicate Reality | Reality | Unknown dimension | 4 |  |

## Recurring characters (the wiki's list) (97)

Bold: already on the site, with what it has.

Abrodolph Lincoler, Alan Chomps, Alien Elle, Amelia Earhart, Beth Sanchez (C-137), Beth Smith (5126), Beth Smith Prime, Beverly Mills, Birddaughter, **Birdperson** [code-built wingman on the map only], **Brad** [Meshy, rigged], BugAnne, Calypso, Carl, **Council of Ricks** [Meshy, 3 councillors rigged], **Cronenbergs** [Meshy, prop], Davin, Diablo Verde, Diane Sanchez, Diane Sanchez (C-131), Dwayne, **Ethan** [Meshy, rigged], **Evil Morty** [Meshy, rigged], Evil Rick, Father Bob, **Garage** [Meshy + lab inside], Garblovians, **Gazorpians** [Meshy, rigged (male)], Gene, Grace Smith, **Gromflomites** [Meshy, rigged (soldier + agent)], Helen Wong, Jerry Smith (C-131), Jerry Smith Prime, Jerry's school friend, Jerryboree receptionist, Jessica (C-131), Jessica (Parmesan Dimension), Jessica Prime, Jesus Christ, Jimmy Haddicker, Jiro, Joyce Smith (Parmesan Dimension), Kenny Finch, Lady Katana, Lithium-P, Magma-Q, Magma-T, Magnesium-J, Maximums Rickimus, Memory Rick, Morty Jr., **Mr. Goldenfold** [Meshy, rigged], **Mr. Meeseeks** [Meshy, rigged (Portal panic)], Mr. Nimbus, Mr. Poopybutthole, Mr. Stabby (character), Mrs. Poopybutthole, **Mullet Rick** [crowd copy only (unrigged)], Nancy, Naruto Smith, Paul Fleishman, Poopy Jr., **Principal Vagina** [Meshy, rigged], **Purpose Robot** [code-built butter robot], Quantum Rick, Revolio Clockberg, Jr., Rick Prime, Rick Prime (Council of Ricks), Rick Sanchez (5126), Rick Sanchez (C-131), Rick Sanchez (D716), Rick Sanchez (D716-B), RickBot, **Ricktiminus Sancheziminius** [a Council voice], Riq IV, Roy Parsons, Sharon Lewis, Shleemypants, Shonda, Slow Mobius, **Snuffles** [Meshy, prop (Snowball in the exo-suit only)], **Space Cruiser** [Meshy, two versions], Space Morty, Squanchy, Story Lord, Summer Smith (5126), Summer Smith Prime, **Tammy Guterman** [Meshy, rigged], The Defiance, Timmy Timtim, Toby Matthews, Tom Randolph, Tricia Lange, Two Crows, Unity, **Zeta Alpha Rick** [a Council voice]


## Protagonists (16)

Alan Rails, **Andre Curtis** [Meshy, rigged], **Beth Smith** [Meshy, rigged], Crocubot, Elle, Francis O'Doyle, Frank, **Jerry Smith** [Meshy, rigged], Million Ants, **Morty Smith** [Meshy, HD, rigged], Noob-Noob, Rho Banks, **Rick Sanchez** [Meshy, HD, rigged], **Summer Smith** [Meshy, rigged], Supernova, Vance Maximus


## Rick's friends (20)

**Andre Curtis** [Meshy, rigged], Antonio, Big Mike, **Birdperson** [code-built wingman on the map only], Bowser, Bunker Gene, Cisco, Geardude, Gene, King Stephen, Little Mike, Liu Sin, Mr. Nimbus, Mr. Poopybutthole, Mr. Poopybutthole Prime, Prime Dimension (character), Revolio Clockberg, Jr., Scary Terry, Scropon (Ricksy Business), Squanchy


## Antagonists (290)

Adam, Alan Rails, Alien Gangsters, Alien Googah, **Andre Curtis** [Meshy, rigged], Arabic Ambassador, Arthricia, Audit Observer, Barnabas Marsh, Baron Thistle, Battlebeth, Bertie, Beth Smith Prime, Big Morty, Big Morty's Bodyguard Mortys, Big Rick, Bill (Dog), **Birdperson** [code-built wingman on the map only], Blim Blam, Blue Greek Hitler, Boon, Bootleg Portal Chemist Rick, Boss Jerry, **Brad** [Meshy, rigged], Bulbhead, Bullies, Cathy, Cecelia, Changeformers, Christ Troopers, Churry, Chuxly, Class-2 Clonerbeast, Coach Feratu, Colossus, Concerto, Connie TinuityError, Conroy, Cookie Magneto, **Cop Morty** [Meshy, rigged], Cornvelious Daniel, **Council of Ricks** [Meshy, 3 councillors rigged], Crazy Cat Rick, **Cromulons** [Meshy, prop + code head on the map], **Cronenbergs** [Meshy, prop], Crowscare, Crustolomons, Crystal Poachers, Cthulhu Monster, Dagon, Dale, Dale's Wife, Death Stalkers, Decimal Point, Diesel Weasel, Dimension C-131 (character), Dimension C-137 (character), Doctor Buckles, Donna Guterman, Doofus Jerry, Doom-Nomitron, Dr. Dogballs, Druggie Rick, Duck with Muscles, Easter Aliens, Easter Bunnies, Eddie, Elliot Poop, Emperor Dread Nought, Evil Beth Clone, Evil Jerry Clone, **Evil Morty** [Meshy, rigged], Evil Rick, Evil Summer Clone, Fantabulous, Fascist Morty, Fascist Rick, Fauntleroy, Fear Hole salesman, Fido, Flash Back, Frank Palicky, Franklin D. Roosevelt, Gaia, **Galactic Federation** [patrol ship, agents, hunters, squads], Galactic Federation President, Garment District Rick, **Gazorpians** [Meshy, rigged (male)], General Nathan, General Store Owner, Giant butt-eating Morty, Giant butt-eating Rick, Gibble Snake, Glenn, Glockenspiel Jerry, Good Beth, Good Jerry, Good Summer, Gorilla Hitler, **Gromflomites** [Meshy, rigged (soldier + agent)], Guffy Chachaco, Heistotron, Hell Demons, Hemorrhage, Henchweeds, Hog Resistance, Hologram Rick, Hothead Rick, Human Fangirl, Infinity, Invisi-troopers, James Gunn (character), Jan, Japheth, Jeffrey Dahmer, Jennith Padrow-Chunt, Jerry Smith (304-X), Jerry Smith (C-132), Jerry Smith (X-198), Jerry Smith Prime, Jerry's Mytholog, Jerryboree Employee Rick, Jimmy Jamerson, Jons, Judge Observer, Julian Hapsburg, Kendra, Kenneth, Kevin (M. Night Shaym-Aliens!), King Flippy Nips, King Jellybean, King of the Sun, Kitlers, **Krombopulos Michael** [—], Kwyatt, Legion of Hitlers, Liu Sin, Lizard People, Lord Henderfinger, Lucius Needful, Lucy, Maa'lgamia Screnshun, Madison, Mar-Sha, Marquis of Mars, Marta, Maximums Rickimus, McGlaargle, Melody, Memory Parasites, Meteors, Miles Knightly, Miss Lead, Monogatron Queen, **Morty Smith** [Meshy, HD, rigged], Morty Smith (304-X), Mortytown Locos, Mr. Brothers, Mr. Calypso, Mr. Frundles, **Mr. Goldenfold** [Meshy, rigged], Mr. Goldenfold (M-616), **Mr. Meeseeks** [Meshy, rigged (Portal panic)], Mr. Nimbus, Mr. Platinumfold, Mr. Poopybutthole, Mr. Poopybutthole Prime, Mr. Sick, Mr. Stringbean, Mr. Twist, Mrs. Poopybutthole, Mutant Sperm, Nargles, Neeeews Reporter, Nick, Night Beth, Night Morty, Night Rick, Night Summer, Nippalians, Numbericons, Nunzumel, Nyarlathotep, Observers, Oddjob Rick, Old Hitler, Parmesan Dimension (character), Partially sighted aliens, Party Dog, Pat Guterman, Pavel Bartek, Peacock Jones, Pissmaster, Planetina, Poncho, Praying Mantis Hitler, Previous Leon, Prince Nebulon, **Principal Vagina** [Meshy, rigged], Prosecutor Observer, Protago Nick, Psychopath Morty, Punchy, Purge Planet Ruler, Quantum Rick, Recapricorn, Red Alien Hitler, Reese, Reggie, Regional Manager Rick, Revolio Clockberg, Jr., Rhett Caan, Rick D. Sanchez III, Rick Prime, Rick Prime's clones, Rick Sanchez (D-99), Rick's Enemies, Riddler Hitler, Riq IV, Risotto Groupon, Risotto's Tentacled Henchman, Robot Alien Hitler, Salvatron, Samantha (Ricker than Fiction), Scarecrow Rick, Scary Olderson, Scary Terry, SEAL Team Ricks, Self-Referential Six, Shadow Council of Ricks, Sheikh Rick, Shleemypants, Shrimp Rick, Snake Adolf Hitler, **Snuffles** [Meshy, prop (Snowball in the exo-suit only)], Space Jerry, Spectre of Undeath, Sperm Queen, Steve Graynor, Stickler Meeseeks, Story Lord, Submarine Nazi, Summer Smith Prime, Super Weird Rick, Supernova, Supreme Guard Ricks, Sympathid, Talking Cat, **Tammy Guterman** [Meshy, rigged], Task Force Alpha, Teddy Rick, The Collective, The High Intern, The New Galactic Federation, The Pope, The Queen, The Vindicators, The Wizard, Thomas Lipnip, Tickets Please Guy, Timmy Timtim, Tina-Teers, Tinkles, **Tiny Rick** [Meshy, rigged], Tough Rat, Toxic Rick, Trafficker Rick, Trash of the Trash, Tree Warden, Turkey President, Tusked Assassin, Twothreefold, Ultromflomites, Unnamed water man, Vampire Master, Vance Maximus, Varrix, Vermigurber, Viscount of Venus, Voltamatron, Vultureperson, Warlord of Titan, Winslow, Wintergreen, Worldender, XenoBeth, Xing Ho, Yamada Q-saku, Zeep Xanflorp, Zigerions


## Superheroes (the Vindicators and the rest) (29)

Alan Rails, Blagnar the Eternal, Calypso, Connie TinuityError, Council of Orbship, Crocubot, Diablo Verde, Eddie, Flash Back, **Jerry Smith** [Meshy, rigged], Kendra, Lady Katana, Million Ants, Miss Lead, **Morty Smith** [Meshy, HD, rigged], Mr. Twist, Noob-Noob, Planetina, Protago Nick, **Rick Sanchez** [Meshy, HD, rigged], Self-Referential Six, Supernova, Tag-Man, The Vindicators, Tina-Teers, Unnamed water man, Vance Maximus, Vindicator Morty, Xing Ho


## Gods and higher beings (15)

Armagheadon, **Cromulons** [Meshy, prop + code head on the map], Cthulhu Monster, Dagon, Goddess Beth, Hephaestus, Jesus Christ, Nunzumel, Nyarlathotep, Punchy, Reggie, Spectre of Undeath, The One True Morty, Truth Tortoise, Vultureperson


## Interdimensional Cable characters (48)

Ants in my Eyes Johnson, Attila Starwar, Baby Legs, Benjamin, Blamphs, Comedian, Corn Universe, Eyehole Man, Fleeb, Fulgora, Garblovians, Garmanarnar, Gazorpazorpfield (Character), Glenn (Rixty Minutes), Hamster in Butt World, Hamsters In Butts, Hole in the Wall Where the Men Can See it All, Jan-Michael Vincent, Jon, Little Dipper, Loggins, Man Painted Silver Who Makes Robot Noises, Michael Denny and the Denny Singers, Michael Jenkins, Michael McLick, Michael Thompson, Mr. Sneezy, Mrs. Sullivan, Octopus Man, Phillip Jacobs, Pichael Thompson, Piece of Toast, Randy Dicknose, Real Fake Doors Salesman, Regular Legs, Schlami, Shmlamantha Shmlicelli, Shmlangela Shmlobinson-Shmlower, Shmlona Shmlobinson, Shmlonathan Shmlower, Shmlony Shmlicelli, Stealy, Three Unknown Things, Tophat Jones, Trunk People, Two Guys with Handlebar Mustaches, Unmuscular Michaels, When Wolf (character)


## The Citadel's places (14)

Citadel's militia, Morty Academy, Morty Agency, **Morty Mart** [—], Mortyburg, Mortytown, Re-Build-A-Morty, Rick, Laser, Scissors, **Simple Rick’s Wafer Cookie factory** [the line, in the Citadel], **The Citadel** [concourse world + map wonder], The Creepy Morty, The Salty Rick, The Wishing Portal, Waste Disposal Plant


## The Smith house's rooms (20)

Bathroom, Dining Room, Entryway Room, **Garage** [Meshy + lab inside], Holodeck, Jerry and Beth's Room, Jerry's Man Cave, **Kitchen** [drawn], **Living Room** [drawn], **Mindblower Room** [drawn], **Morty's Room** [drawn (upstairs)], Rick's Room, Sublevel B1, Sublevel B10, Sublevel B15, Sublevel B2, Sublevel B3, Sublevel B7, Summer's Room, Yard


## Recurring locations (56)

Alphabetrium, Bathroom, Bird World, **Blips and Chitz** [Meshy building + Roy inside], Buttworld, Crustula, Dimension 5126, Dimension B-617, Dimension C-131, Dimension C-137, Dimension C-773, Dining Room, Dr. Wong's Office, Earth, Entryway Room, Evil Rick's Target Dimension, Fancy Eats, Furp Rock, Galactic Federation Prison, **Garage** [Meshy + lab inside], Gear World, Giant Court, Gromflom Prime, **Harry Herpson High School** [Meshy building + classroom], Interdimensional Rift, Jerry and Beth's Room, Jerry's Apartment, Jerry's Man Cave, Jerryboree, **Kitchen** [drawn], **Living Room** [drawn], Merpal's Mall, **Mindblower Room** [drawn], Mort's Dimension, **Morty Mart** [—], **Morty's Room** [drawn (upstairs)], Mortyburg, Parmesan Dimension, Phone Universe, Planet Squanch, Prime Dimension, Rick's Room, **Shoney's** [Meshy building + booth inside], **Smith Residence** [Meshy building + rooms inside], St. Equis Hospital, Sublevel B1, Sublevel B10, Sublevel B15, Sublevel B2, Sublevel B3, Summer's Room, **The Citadel** [concourse world + map wonder], The Pentagon, Vomits Grocery, **White House** [the Oval Office, drawn], Yard


## Commercial locations (shops, bars, parks) (63)

Al's Park, Anatomy Park (location), Arnaldo's Pizza Spot, Bar Beau Q, Bar None, Birding Manapalooza Flargabarg, **Blips and Chitz** [Meshy building + Roy inside], Butthole Ice Cream, Choi's Grocery, Citadel Toyz, Cogspot, Curse Purge Plus!, Denny's, Devil's Teat, Don Cuco, Dr. Wong's Office, Earth World, Egan Cinema, Ely's Electronics, EZ Axis Eggs, Fancy Eats, Fantasma Billards Bar, Fly Over, Foamies, Fortune 500, Fredblox, Frog Restaurant, Fuck You's, Furp Rock Plaza, Henderson's Turkey Farm, Hot Cog, Immortality Field Resort, Joe's, Johnny D's Custom Tees, Lil' Bits, McDonald's, Merpal's Mall, Mind Openerz, **Morty Mart** [—], Needful Things, Netflix Headquarters, Panda Express, Pawn Shop Planet, Plim Plom Tavern, Prix Cogs, Restaurant Depot, Saladworks, Sbarros, **Shoney's** [Meshy building + booth inside], Space Mitsubishi, Taco La Taco, Taco Tambourine, The Creepy Morty, The Salty Rick, Thirsty Step, Titanic 2, Tony's Laundromat, Vomits Grocery, Warner Bros. Studios Burbank, Wes Anderson's Grand Royal Hot Tub Emporium, Whirly Dirly, Wholesome Delight, Zenta-Fe


## Planets (78)

41-Kepler B, Alpha Centaurus, Alphabetrium, Arboles Mentirosos, Beloi 6E, Big Pluto, Biggum, Bird World, Blackjack 9, Boob World, Crustula, Delphi 6, Dorian 5, Dwarf Terrace-9, E-10, Earth, Fantasy Planet, Ferkus 9, Flarbellon-7, Flump Bussy, Forbidden Zone, Forbodulon Prime, Fran Dreshlicar, Gaia, Gazorpazorp, Gear World, Glaagablaaga, Glapflap, Glorfingr 7, Gramuflack, Granitor 7, Gromflom Prime, Jupiter, Krootabulon, Krumpf, M-9999, Mars, Mercury, Morglutz, Mr. Poopybutthole's Planet, Nebraska, Neptune, Numbericonia, On a Cob Planet, Parblesnops, Pawn Shop Planet, Planet Dogg-One, Planet MWA739, Planet Squanch, Pluto, Purge Planet, Ramamama, Resort World, Ronkonkoma, Saturn, Screaming Sun Earth, Scrotia, Shongi the Living Planet, Slartivart, Snake Planet, Snorlab, Spikky Remis, Tamorus Lite, Terraneous system, Timbus, Trumpdorian planet, Tryonicon-5, Unity's Planet, Uranus, Venus, Venzenulon 7, Venzenulon 9, Windshield Washing Planet, Yalahreyta, Yarple-7, Zeplar Prime, Zipple, Zorpantheon 9


## Dimensions (91)

50's Dimension, Blah Dimension, Blender Dimension, Blumbus Dimension, Bunker Dimension, Buttworld, Central Finite Curve, Corn Universe, Cronenberg World, Dimension 304-X, Dimension 35-C, Dimension 437, Dimension 46'\, Dimension 5126, Dimension 79⊢⊇V, Dimension 9-2184C, Dimension A-810, Dimension B-617, Dimension Beta B-45, Dimension C-1239, Dimension C-130, Dimension C-131, Dimension C-132, Dimension C-137, Dimension C-290, Dimension C-4499, Dimension C-500A, Dimension C-7218, Dimension C-773, Dimension D716, Dimension D716-B, Dimension D716-C, Dimension H-457, Dimension J19α7, Dimension J19ζ7, Dimension K-962, Dimension M-616, Dimension M592, Dimension Zeta-6 Epsilon, Disco Ball Dimension, Doopidoo Dimension, Draygon, Evil Rick's Target Dimension, Fascist dimension, Fascist Dimensions, Fascist Dystopian Universe, Fish and Balloon Afterlife, Five o'clock Shadow Dimension, Fourth Dimension, Froopyland, Frozen Dimension, Furniture Universe, Furp Rock, Goat Dimension, Grand Central Dimension, Greasy Grandma World, Hamster in Butt World, Heaven, Hell, Hippie Dimension, Ice Cream Universe, Island Dimension, List of Realities, Merged Dimension, Meta Reality, Microverse, Miniverse, Mort's Dimension, Mr. Poopybutthole's Replacement Dimension, Multiverse, Narnia Dimension, Pantless Universe, Parmesan Dimension, Phone Universe, Picasso Dimension, Pizza Universe, Post-Apocalyptic Dimension, Prime Dimension, Reverse Height Universe, Shrimp Universe, Teddy Universe, Teenyverse, **The Citadel** [concourse world + map wonder], Toilet Dimension, Trash Moon Dimension, Tusk Dimension, Vacuum Cleaner Dimension, Valhalla, Valhalla Prime, Wasp Universe, Yarn Dimension


## Vehicles (12)

Beth's car, Glyph Jumper Extreme, Gotron, Invisible Garbage Truck, Jerry's car, List of minor vehicles, NX-5 Planet Remover, Party Mixer, S.S. Independence, Sneezy XL, Space Beth's spaceship, **Space Cruiser** [Meshy, two versions]


## Weapons (17)

Chris, Elemental Rings, Freeze ray, Gutsy Grabber, Hammerhead Morty (Fortnite), Infinity Glove, Laser gun, Lightsaber, Long Neck Dog Gun, Neutrino Bomb, Omega Device, Pink Sentient Switchblade, Portal Pistol, Pulse Rifle, Summoned Katana, Transdimensional Energy Relay, Universe Bomb


## Gadgets (Rick's inventions) (55)

Age manipulation chamber, Ant Farm, Attribute Slider, Broken Leg Serum, Butter Robot (Fortnite), Cognition Amplifier, Courier Flap, Crystallized Xanthenite, Cure for Tuberculosis, Demonic Alien Containment Box, Dream Inceptor, Entropy device, Evil Morty's Portal Gun, Fading Pills, Freeze ray, Grappling shoes, Groin system 6000, Gwendolyn, Horse Breeding Mount, **Interdimensional Cable** [the TV toy], Interdimensional Goggles, Ionic Defibulizer, Kirkland Meeseeks Box, Laser gun, Lightsaber, List of Rick's inventions, Long Neck Dog Gun, Matrix Simulator, Mechanical Morty, Mechanical Rick, Mechanical Summer, Microverse Battery, Mindblower gun, Mindblower helmet, Morphizer-XE, MortyPad, Movie-lizer, **Mr. Meeseeks Box** [code-built], Operation Phoenix, Pokeball, Pooplickian GamePod XL, **Portal Gun** [Sketchfab (wardrobe)], Portal Gun Jr., Portal Pistol, **Purpose Robot** [code-built butter robot], Re-Build-A-Morty, Save-Point Device, Senthol Diempathate, Series 9000 Brainalyzer, Shrink ray, **Space Cruiser** [Meshy, two versions], Time Stabilizing Collar, Time travel, Tommy's Clone, Wristwatches


## Races (species) (131)

Alphabetrians, Amfiddians, Arbolian Mentirososians, Bepisians, Bird People, Blamphs, Bliznarvians, Bluubosians, Boobloosians, Borpocians, Broghs, Brosephamons, Buttmouth, Changeformers, Chuds, Ciancans, Courier Flap, Crittendians, **Cromulons** [Meshy, prop + code head on the map], **Cronenbergs** [Meshy, prop], Crow Aliens, Crustolomons, Dangelians, Dinosaurs, Drumbloxians, Ferkisians, Flansians, Floovians, Friggans, Garblovians, **Gazorpians** [Meshy, rigged (male)], **Gear People** [gearship in map traffic], Germaphobic species, Giant Telepathic Spiders, Glorzo, Gobblers, Googa Aliens, Googas, Gorpathian Dermaks, Greebybobes, **Gromflomites** [Meshy, rigged (soldier + agent)], Grunglokians, Hambrosians, Hamsters In Butts, Harolds, Hell Demons, Hot Dogs, Hrinchs, Humans, Karvesshians, Kitlers, Klaaxzovians, Korblockians, Korlunxes, Kozbians, Krootabulans, Laarvians, Larvaalians, Lizard People, Lockerean, Magdalians, Mailboxians, Mancors, Mantis-people, Martians, Mega Gargantuans, Memory Parasites, Moopians, **Mr. Meeseeks** [Meshy, rigged (Portal panic)], Mr. Meeseeks (Kirkland), Mr. Youseeks, Narduarvians, Nevanians, Nippalians, Numbericons, Nuptians, Obravadians, Observers, Partially sighted aliens, Penps, Photography Cyborgs, Pizarians, Plutonian, Post-Apocalyptic Mutants, Predators, Pripudlians, Promotians, Protolaxians, Quadropians, Resort Aliens, Ricklets, Robobros, Sausage Fellas, Scary People, Schlami, Scropons, Scrotians, Semosites, Sentient Dogs, Severnians, Shimshamians, Shipzuvians, Slime Aliens, Smarkians, Smumpians, Space Snakes, Spaghetti People, Species (Beth and Summer), Splorpians, Squanchies, Squirrels, Stair Goblins, TC-1, Time Cops, Torsos, Traflorkians, Tree People, Trunk People, Tumblorkians, Turkey Monsters, Vampire, Varrix, Venusians, Voiceovarian, Vulvorvians, Wharborgarbors, Xenisians, Xorjhans, Zerillians, Zigerions, Zombodians


## Robots (43)

Android Morty, Arbor Knight, Beau, Butter Robot (Fortnite), Catogami, Changeformers, Chi-Chi, Conroy, Corsica, Crow Horse, Cypress, Delivery Drone, Devil's Advocate Bot, Digestibot, Donna Guterman, Farmer Rick's Dog, Gwendolyn, Heistotron, Killer Droid Rick, Lady Katana, Mechanical Morty, Mechanical Rick, Mechanical Summer, Palm D'Or, Pat Guterman, Pink Sentient Switchblade, Pizza Box Robot, **Purpose Robot** [code-built butter robot], Randotron, Redwood, Reese, RickBot, Robo Trees, Robo-Ghost, Robobros, Robot Alien Hitler, Robot Morty, Robot Rick, Robot Soldiers, Salvatron, Singing Robot, Tannenbaum, Trash of the Trash


## Animals (79)

Apeborg, Aqua Morty, Aqua Rick, Arthricia, Asher Hess, Balthromaw, Beebo, Bible-saurus, Bill (Dog), Buzz Advil, Cat Beth, Cat Morty, Cat Rick, Caveman Snake, Chachi, Chud King, Chuds, Crocubot, Crow Horse, Crustolomons, Dagon, Debranavox, Diesel Weasel, Duck with Muscles, Easter Bunnies, Fear Spider, Fido, Gazorpazorpfield (Character), General Store Owner, Giant Telepathic Spiders, Gibble Snake, Gobblers, Hamsters In Butts, Izzy, Jerry Smith (H-90), Lighthouse Keeper, Lizard Morty, Lizard People, Lizard Rick, Lizzy, Million Ants, Mr. Poopybutthole's Cat, Mr. Poopybutthole's Dog, New Lizzy, Party Dog, Penps, Poñeta, Purge Planet Ruler, Pussifer, Rabbit Morty, Reverse Giraffe, Rick's Foal, Rodent Morty, Scaly Morty, Semosites, Sentient Dogs, Shadow Jacker, Shmooglite Runner, Slippy, Snake Adolf Hitler, Snake Morty, Snake President, **Snuffles** [Meshy, prop (Snowball in the exo-suit only)], Space Snake, Space Snakes, Squanchies, Squanchy, Squirrels, Talking Cat, The Kerblin, The Triceratops, Time Bird, Tinkles, Tough Rat, Turkey Monsters, Two Crows, Vermigurber, Vultureperson, When Wolf (character)


## Monsters (41)

Alan Chomps, Barnabas Marsh, Camp David Swamp Witch, Cathy, Centaur, Coach Feratu, Cronenberg Elle, Crow Aliens, Cthulhu Monster, Diseases, Dracula (Mort: Ragnarick), Dracula (President Curtis), Easter Bunnies, Fear Spider, Frankenstein's Monster (Mort: Ragnarick), Frankenstein's Monster (Total Rickall), Franklin D. Roosevelt, Gar's Mytholog, Ghost in a Jar, Gill-Man, Jerricky, Loch Ness Monster, Mantis-people, Monster Morty, Morty Jr., Morty Jr. (C-130), Morty Jr. (Parmesan Dimension), Mr. Chimney, Mummy, Mutant Sperm, Scary Brandon, Scary Glenn, Swamptopus, Thoolie Smith, Three Unknown Things, Vampire, Vampire Master, When Wolf (character), Wolf Man, XenoBeth, Zarbadar's Mytholog


## Groups and organisations (39)

Alien Gangsters, Beta-Seven, Beth and the Beths, Christ Troopers, Citadel's militia, Council of Orbship, **Council of Ricks** [Meshy, 3 councillors rigged], David Prime, Death Stalkers, Diseases, Easter Aliens, Farty McFartface, Florp Squad, Freedom Fighters Crew, **Galactic Federation** [patrol ship, agents, hunters, squads], Galactic Sauce Vault, Harry Herpson Herpsons, Headism, Hell Demons, Henchweeds, Hog Resistance, Jerryboree, Legion of Hitlers, Memory Beths, Mortyism, Precogs, Robo Trees, SEAL Team Ricks, Self-Referential Six, Shadow Council of Ricks, Task Force Alpha, The Defiance, The New Galactic Federation, The Vindicators, Time Cops, Tina-Teers, Ultromflomites, Unity, Valhalla Vikings


## Reading the harvest

- The wiki's **Species** and **Items** categories are empty; the lists live under **Races**, **Aliens**, **Objects** and **Gadgets**.
- **Vehicles** holds only 12 pages; most ships are on `List of minor vehicles` or a character's page (Birdperson's ship, the Vindicators' ship, the Zigerion mothership, the Story Train).
- Every character page has an infobox image (`prop=pageimages&piprop=original`) and most have an `== Appearance ==` section: the two together are the reference sheet the model prompts are written and judged against.
- rickandmortyapi.com's `episode` arrays are the cleanest measure of who matters; the wiki's `Recurring Characters` is the fan-judged one. The spec uses both.
