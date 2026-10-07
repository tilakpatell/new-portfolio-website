// Rick and Morty’s lines in the galaxy's wars' battles (battleLines.js says
// how they're picked, by the side you swore to's stance, the war and the
// place, and how their blanks are filled).

export default {
  battle: {
    ask: {
      any: [
        ["morty", "Rick, there’s a battle out there! Wh-whose side are we on?"],
        [
          "rick",
          "Nobody’s, Morty. Not yet. Swear on the holotable or the panel. Pick a team, any team. I’ll mock it.",
        ],
      ],
    },
    front: {
      light: [
        ["morty", "Rick, it’s a full-on space battle over {place}!"],
        [
          "rick",
          "And we’re with {us}, Morty. The good guys. Try not to make it weird.",
        ],
      ],
      dark: [
        [
          "morty",
          "Rick, we’re fighting for {us}. Doesn’t that make us the bad guys?",
        ],
        [
          "rick",
          "Technically, Morty. But the bad guys have the cooler ships. Sit up straight, there’s a dress code.",
        ],
      ],
      hutt: [
        ["morty", "Rick, Hutts! Giant slugs, with a whole navy!"],
        [
          "rick",
          "Space mafia, Morty. Half this galaxy owes {them} money. Let’s go cancel some debt.",
        ],
      ],
    },
    join: {
      light: [
        ["rick", "We’re in it, Morty! Shoot anything that’s shooting at {us}."],
        ["morty", "That’s everything, Rick! Everything’s shooting!"],
      ],
      dark: [
        [
          "rick",
          "Here we go, Morty. Shoot {them}. No thinking. Thinking’s for the other side.",
        ],
        ["morty", "I-I can’t not think about it, Rick!"],
      ],
    },
    gens: {
      light: [
        ["morty", "Rick, a flagship’s shields just dropped! Ours or theirs?"],
        ["rick", "Look who’s panicking, Morty. If it’s us, fly faster."],
      ],
      dark: [
        ["morty", "The shield generators are gone, Rick! Is that good?"],
        [
          "rick",
          "Depends whose they were, Morty. Either way, somebody in a cape is about to be very disappointed.",
        ],
      ],
    },
    bridge: {
      light: [
        ["morty", "Rick, the flagship’s bridge just blew off!"],
        [
          "rick",
          "Somebody’s admiral just became debris, Morty. Let’s hope it was the right somebody.",
        ],
      ],
      dark: [
        ["morty", "The bridge is gone, Rick! There were p-people up there!"],
        [
          "rick",
          "Admirals, Morty. Whichever side they were on, there’s a spare in a drawer. This side keeps ten.",
        ],
      ],
    },
    reactor: {
      light: [
        ["morty", "The flagship’s reactor’s going, Rick!"],
        [
          "rick",
          "Then be somewhere else, Morty! Distance is the best shield ever invented!",
        ],
      ],
      dark: [
        ["morty", "Rick, the reactor’s going critical!"],
        [
          "rick",
          "Big ship, big bang, Morty. If it’s ours, no surprise. This side builds everything to explode.",
        ],
      ],
    },
    won: {
      light: [
        ["morty", "We won, Rick! The whole fight at {place}!"],
        ["rick", "For now, Morty. Wars move. That’s their whole thing."],
      ],
      dark: [
        [
          "morty",
          "We won, Rick. For {us}. Am I supposed to feel good about it?",
        ],
        [
          "rick",
          "Feel it quietly, Morty. On this side, cheering’s a disciplinary matter.",
        ],
      ],
      hutt: [
        ["morty", "We beat {them}, Rick! Their ships are leaving!"],
        [
          "rick",
          "Hutts don’t leave, Morty. They ooze off and hire a bounty hunter. Enjoy it while it lasts.",
        ],
      ],
    },
    lost: {
      light: [
        ["morty", "Rick, we lost at {place}! Everybody’s pulling out!"],
        ["rick", "Then so are we. Live to meddle another day, Morty."],
      ],
      dark: [
        ["morty", "We lost, Rick. Is that bad? For us, I mean? Morally?"],
        [
          "rick",
          "Losing for the bad guys, Morty? That’s the most heroic thing we’ve done all week.",
        ],
      ],
      hutt: [
        ["morty", "We lost to {them}, Rick! To slugs!"],
        [
          "rick",
          "Never bet against organised crime, Morty. Somewhere a Hutt’s laughing. You can hear it from orbit.",
        ],
      ],
    },
    turncoat: {
      light: [
        ["morty", "We’re with {us} now, Rick? Just like that?"],
        [
          "rick",
          "Loyalty’s a construct, Morty. We swore, we switched, we’re the good guys. Keep up.",
        ],
      ],
      dark: [
        [
          "morty",
          "Rick, we just joined {us}! We were shooting at them five minutes ago!",
        ],
        [
          "rick",
          "Career change, Morty. Better hours, worse ethics, matching helmets.",
        ],
      ],
    },
    ace: {
      light: [
        ["morty", "I got their ace, Rick! The one with the fancy ship!"],
        [
          "rick",
          "Give anyone a name and a custom ship, Morty, they think they’re immortal. Nobody’s immortal. Except me.",
        ],
      ],
      dark: [
        [
          "morty",
          "Rick, I shot down their best pilot. They had a name. They p-probably had a family.",
        ],
        [
          "rick",
          "They’ll be back, Morty. Aces always get a sequel. Nice shot, though.",
        ],
      ],
    },
    escort: {
      light: [
        [
          "morty",
          "Rick, a whole squadron’s forming up next to us! Did we do something?",
        ],
        [
          "rick",
          "We’re in a club, Morty. Fly for {us} long enough and they assign you friends. Don’t be clingy.",
        ],
      ],
      dark: [
        [
          "morty",
          "Rick, the bad guys are flying right next to us. Our bad guys.",
        ],
        [
          "rick",
          "Escort, Morty. Half protection, half supervision. Smile. They write reports.",
        ],
      ],
    },
    deserter: {
      light: [
        [
          "morty",
          "Rick, this is our old side’s space. They know we left, right?",
        ],
        [
          "rick",
          "Oh, they know, Morty. Bad guys keep excellent records. Don’t answer the comms.",
        ],
      ],
      dark: [
        [
          "morty",
          "Rick, we’re back where we used to be the good guys. Everybody’s staring.",
        ],
        [
          "rick",
          "Exes, Morty. No eye contact. And don’t let them see the new paint job.",
        ],
      ],
    },
    intercept: {
      light: [
        ["morty", "I got it, Rick! It didn’t get through!"],
        [
          "rick",
          "Stopped at the door, Morty. Everyone on {place} owes you a drink. You’re fourteen. A juice.",
        ],
      ],
      dark: [
        [
          "morty",
          "Rick, that ship they were sneaking through. I got it. Was anybody on it?",
        ],
        [
          "rick",
          "Don’t ask questions with bad answers, Morty. That’s page one of the dark side handbook.",
        ],
      ],
    },
    runners: {
      light: [
        [
          "morty",
          "Rick, transports! They’re making a run right through the fight!",
        ],
        [
          "rick",
          "Check the markings, Morty. Ours, we cover. Theirs, we ruin their day.",
        ],
      ],
      dark: [
        [
          "morty",
          "Rick, transports are making a run for it! Do we shoot them or save them?",
        ],
        [
          "rick",
          "If they’re ours, wave them through, Morty. If not, well, we’re the bad guys. Act like it.",
        ],
      ],
    },
    gate: {
      light: [
        [
          "morty",
          "Rick, the shield gate’s gone! The whole planet’s wide open!",
        ],
        [
          "rick",
          "Somebody’s front door just fell off, Morty. Check it isn’t ours before you celebrate.",
        ],
      ],
      dark: [
        ["morty", "Rick, the shield’s gone! Wh-whose was it?"],
        [
          "rick",
          "Either way, Morty, somebody on this side gets a medal or a court martial. Sometimes both.",
        ],
      ],
    },
    interdictor: {
      light: [
        ["morty", "Rick, the hyperdrive won’t go! Nobody can jump!"],
        [
          "rick",
          "Gravity wells, Morty. A big ship pretending to be a planet. Nobody leaves till somebody wins. Make it us.",
        ],
      ],
      dark: [
        ["morty", "Rick, we can’t jump! We’re stuck in here with everybody!"],
        [
          "rick",
          "Interdictor, Morty. Doesn’t care whose it is. It traps {them}, it traps us. Equal-opportunity misery.",
        ],
      ],
    },
    blockade: {
      light: [
        ["morty", "Rick, it’s a blockade! Somebody’s trying to run it!"],
        [
          "rick",
          "Big ships in a line, Morty, little ships with a death wish. Guess which ones get the songs.",
        ],
      ],
      dark: [
        [
          "morty",
          "Rick, somebody’s running the blockade! Wait, which one are we?",
        ],
        [
          "rick",
          "We might be the wall, Morty. Walls don’t get happy endings. Walls get blown up in the third act.",
        ],
      ],
    },
  },
  battleWar: {
    clone: {
      front: {
        light: [
          ["morty", "Rick, clones and droids! Like, millions of each!"],
          [
            "rick",
            "The Clone Wars, Morty. The Republic’s clones versus the Separatists’ toasters. We’re Team Same Face.",
          ],
        ],
        dark: [
          ["morty", "Rick, we’re with the Separatists? Against the Republic?"],
          [
            "rick",
            "Clone Wars, Morty. Team Toaster. Count Dooku’s got a cape, a castle and a monologue. What’s not to like?",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "The Republic won, Rick! The clones are cheering!"],
          [
            "rick",
            "Enjoy it, Morty. Give it a year, they all get one weird order from the Chancellor.",
          ],
        ],
        dark: [
          [
            "morty",
            "The Separatists won, Rick. The droids are doing a little dance.",
          ],
          [
            "rick",
            "Roger roger, Morty. Victory, and it only cost us forty thousand toasters.",
          ],
        ],
      },
    },
    gcw: {
      front: {
        light: [
          ["morty", "Rick, X-wings and TIE fighters! It’s the actual movies!"],
          [
            "rick",
            "Galactic Civil War, Morty. The Rebellion versus the Empire. Space fascists. Easy pick.",
          ],
        ],
        dark: [
          [
            "morty",
            "Rick, we’re flying for the Empire in the Civil War. The Empire, Rick!",
          ],
          [
            "rick",
            "The Rebellion’s got a farm boy, Morty. We’ve got a moon that kills planets. Do the maths.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "The Rebellion won, Rick! The Empire’s running!"],
          [
            "rick",
            "Save the medals, Morty. The Empire’s still got a lot of Star Destroyers and no sense of humour.",
          ],
        ],
        dark: [
          [
            "morty",
            "We won for the Empire, Rick. They’ll build another Death Star now, won’t they?",
          ],
          [
            "rick",
            "Bigger, Morty. Always bigger. And the Rebellion will find the weak spot. They always do.",
          ],
        ],
      },
    },
    remnant: {
      front: {
        light: [
          [
            "morty",
            "Rick, Star Destroyers? Didn’t we already watch these guys lose?",
          ],
          [
            "rick",
            "We did, Morty. Remnant War. The New Republic versus the Imperial Remnant. The Empire’s reunion tour.",
          ],
        ],
        dark: [
          [
            "morty",
            "Rick, we’re with the Imperial Remnant against the New Republic? The Empire lost!",
          ],
          [
            "rick",
            "Ground floor of the comeback, Morty. In a couple of decades they rebrand as the First Order.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "The New Republic won, Rick! The Remnant’s finished!"],
          [
            "rick",
            "Sure, Morty. Now they’ll disarm, form a committee, and miss the fleet in the Unknown Regions.",
          ],
        ],
        dark: [
          [
            "morty",
            "The Remnant won, Rick. The New Republic’s pulling back. Is the Empire… back?",
          ],
          [
            "rick",
            "Somehow, Morty, the Empire returned. Nobody ever explains how. Just roll with it.",
          ],
        ],
      },
    },
  },
  battleAt: {
    endor: {
      war: "gcw",
      front: {
        light: [
          [
            "morty",
            "Rick, the Death Star’s up there, and its shield’s still on!",
          ],
          [
            "rick",
            "It’s a trap, Morty. Ackbar said so. The Rebellion’s staying anyway. That’s courage. Or a cult.",
          ],
        ],
        dark: [
          [
            "morty",
            "Rick, we’re with the Empire at Endor? I’ve seen this one! We lose!",
          ],
          [
            "rick",
            "No spoilers, Morty. The Emperor’s got a plan. His plans never account for teddy bears.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "Rick, the Ewoks won! And the second Death Star’s gone!"],
          [
            "rick",
            "Yub nub, Morty. The Emperor fell down a shaft. Definitely the last we’ll see of him.",
          ],
        ],
        dark: [
          [
            "morty",
            "We held Endor, Rick. The Death Star’s still up there. Oh geez.",
          ],
          [
            "rick",
            "The Ewoks lost, Morty. Now the Emperor’s going to be unbearable. Yes, that’s a pun. I’ve earned it.",
          ],
        ],
      },
    },
    hoth: {
      war: "gcw",
      front: {
        light: [
          ["morty", "Rick, walkers! Giant metal camels on the ice!"],
          [
            "rick",
            "AT-ATs, Morty. Echo Base needs time to get the transports out. Go for the legs. Tow cables.",
          ],
        ],
        dark: [
          [
            "morty",
            "Rick, we’re in Vader’s fleet over Hoth? The Rebellion lives in a cave down there!",
          ],
          [
            "rick",
            "Vader just choked an admiral for parking too close, Morty. Fly carefully. Park nowhere.",
          ],
        ],
      },
      won: {
        light: [
          [
            "morty",
            "The Rebellion held Hoth, Rick! The walkers are going home!",
          ],
          [
            "rick",
            "That’s not how the film goes, Morty. Vader’s going to choke an admiral about it. Another one.",
          ],
        ],
        dark: [
          ["morty", "We took Echo Base, Rick. It’s just snow and empty rooms."],
          [
            "rick",
            "The Empire won Hoth, Morty. Congratulations, we own an ice cube. Everybody left.",
          ],
        ],
      },
    },
    scarif: {
      war: "gcw",
      front: {
        light: [
          ["morty", "Rick, somebody put a lid on that planet!"],
          [
            "rick",
            "Rogue One, Morty. The Rebellion’s on the beach stealing the Death Star plans. Keep the gate busy.",
          ],
        ],
        dark: [
          ["morty", "Rick, Rebels on the beach! Are we stopping them?"],
          [
            "rick",
            "We guard the archive, Morty. The Empire kept its biggest secret on one tape in one tower. Geniuses.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "The plans got out, Rick! They actually got them out!"],
          [
            "rick",
            "Hope, Morty. Now leave, before a guy in a black helmet finds a corridor full of Rebels.",
          ],
        ],
        dark: [
          [
            "morty",
            "We won, Rick! And then the Death Star shot the base. Our base!",
          ],
          [
            "rick",
            "The Empire won Scarif, Morty. Then fired on it. That’s office politics.",
          ],
        ],
      },
    },
    yavin: {
      war: "gcw",
      front: {
        light: [
          ["morty", "Rick, the Death Star’s lining up on the moon!"],
          [
            "rick",
            "Battle of Yavin, Morty. One tiny exhaust port, one farm boy. Stay on target.",
          ],
        ],
        dark: [
          [
            "morty",
            "Rick, should somebody tell the Empire about the exhaust port?",
          ],
          [
            "rick",
            "Tarkin doesn’t take feedback, Morty. Fly with Vader and stay out of the trench.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "Rick, the farm boy hit it! Right down the hole!"],
          [
            "rick",
            "Great shot, kid. One in a million. The Rebellion hands out medals now. Not to the Wookiee.",
          ],
        ],
        dark: [
          ["morty", "We held Yavin, Rick. Nobody hit the exhaust port."],
          [
            "rick",
            "Somebody covered the exhaust port, Morty. Tarkin will take the credit. Tarkin always takes the credit.",
          ],
        ],
      },
    },
    bespin: {
      war: "gcw",
      front: {
        light: [
          ["morty", "Rick, they’re fighting over Cloud City!"],
          [
            "rick",
            "Lando made a deal with Vader, Morty, and the deal kept changing. Get the Rebellion off the platform.",
          ],
        ],
        dark: [
          [
            "morty",
            "Rick, we’re with Vader at Cloud City. He’s freezing people in carbonite!",
          ],
          [
            "rick",
            "He’s altering the deal, Morty. Pray he doesn’t alter it any further. Fly nicely.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "Cloud City’s free, Rick! The Rebellion did it!"],
          [
            "rick",
            "Lando came through, Morty. Turns out the guy in the cape had a conscience.",
          ],
        ],
        dark: [
          ["morty", "The Empire’s got Cloud City, Rick."],
          [
            "rick",
            "Lando’s out, Morty. Vader keeps the carbon freezer for awkward guests. Don’t be an awkward guest.",
          ],
        ],
      },
    },
    coruscant: {
      war: "clone",
      front: {
        light: [
          [
            "morty",
            "Rick, ships everywhere over Coruscant! It’s a traffic jam with guns!",
          ],
          [
            "rick",
            "Grievous grabbed the Chancellor, Morty. The Republic wants him back. This is where the fun begins.",
          ],
        ],
        dark: [
          [
            "morty",
            "Rick, we’re helping General Grievous kidnap the Chancellor? For the Separatists?",
          ],
          [
            "rick",
            "Relax, Morty. The Chancellor’s not the victim in this story. Trust me. Watch the guy.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "The Republic got the Chancellor back, Rick!"],
          [
            "rick",
            "Great job, Morty. Real heroes. Absolutely nothing bad comes of this. Nothing at all.",
          ],
        ],
        dark: [
          [
            "morty",
            "The Separatists won over Coruscant, Rick? Over the capital?",
          ],
          [
            "rick",
            "Grievous coughed his way to victory, Morty. Somewhere the Chancellor’s smiling. He’s always smiling.",
          ],
        ],
      },
    },
    naboo: {
      war: "clone",
      front: {
        light: [
          [
            "morty",
            "Rick, droid ships all round Naboo! It’s a blockade again!",
          ],
          [
            "rick",
            "Same Trade Federation, Morty, new Separatist logo. Last time a nine-year-old beat them by accident.",
          ],
        ],
        dark: [
          [
            "morty",
            "Rick, we’re blockading Naboo for the Separatists? It’s so pretty!",
          ],
          [
            "rick",
            "Trade dispute, Morty. Boring and profitable. And this time the droids don’t all run off one ship.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "The Republic broke the blockade, Rick! Naboo’s free!"],
          [
            "rick",
            "Venators this time, Morty, not a kid in a starfighter. Less charming. Much more reliable.",
          ],
        ],
        dark: [
          ["morty", "We held Naboo, Rick. The Gungans are really upset."],
          [
            "rick",
            "Blockade holds, Morty. Nute Gunray’s finally happy. Don’t get used to that face.",
          ],
        ],
      },
    },
    lothal: {
      war: "remnant",
      front: {
        light: [
          [
            "morty",
            "Rick, Imperials over Lothal! I thought they got kicked out!",
          ],
          [
            "rick",
            "They did, Morty. Space whales dragged Thrawn into hyperspace. Now he’s back, and he’s brought the Chimaera.",
          ],
          ["rick", "So the New Republic’s here to see him off again."],
        ],
        dark: [
          [
            "morty",
            "Rick, the Remnant’s back over Lothal, and we’re in it. The loth-cats hate us.",
          ],
          [
            "rick",
            "Everybody hates us, Morty. Thrawn’s on the bridge, so at least somebody here has a plan.",
          ],
        ],
      },
      won: {
        light: [
          ["morty", "Lothal’s free again, Rick! The New Republic did it!"],
          [
            "rick",
            "Liberated twice, Morty. Lothal’s got a loyalty card. Ten liberations, the eleventh’s free.",
          ],
        ],
        dark: [
          ["morty", "The Remnant took Lothal back, Rick. The cats are hiding."],
          [
            "rick",
            "Smart cats, Morty. Thrawn’s back on his old patch. He’s going to be insufferably calm about it.",
          ],
        ],
      },
    },
  },
};
