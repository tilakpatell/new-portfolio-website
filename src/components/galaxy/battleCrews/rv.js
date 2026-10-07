// Walt and Jesse’s lines in the galaxy's wars' battles (battleLines.js says
// how they're picked, by the side you swore to's stance, the war and the
// place, and how their blanks are filled).

export default {
  battle: {
    ask: {
      any: [
        [
          "jesse",
          "Yo, there’s a whole war out there! Mr. White, whose side are we even on?",
        ],
        [
          "walt",
          "Nobody’s. Yet. Swear to a side on the holotable or the panel, Jesse. Then we fly.",
        ],
        ["jesse", "Like picking a cartel. Cool. Totally cool."],
      ],
    },
    front: {
      light: [
        [
          "jesse",
          "Yo, we’re flying for {us} at {place}! We’re the good guys this time, right?",
        ],
        ["walt", "This time, Jesse. Stay on my wing."],
      ],
      dark: [
        [
          "walt",
          "We fly for {us} at {place}, Jesse. Discipline, logistics, a chain of command. Professionals.",
        ],
        ["jesse", "Mr. White, are we the bad guys right now?"],
      ],
      hutt: [
        [
          "walt",
          "The Hutts, Jesse. A family business, run by slugs. I know cartels.",
        ],
        [
          "jesse",
          "Last time we took on a cartel, everybody ended up face down in a pool, yo.",
        ],
      ],
    },
    join: {
      light: [
        ["jesse", "We’re in it, yo! Lasers everywhere!"],
        ["walt", "One target at a time, Jesse. Chemistry is a sequence."],
      ],
      dark: [
        ["walt", "In we go, Jesse. For {us}. Try to look intimidating."],
        ["jesse", "In an RV?!"],
      ],
    },
    gens: {
      light: [
        [
          "jesse",
          "Yo, a flagship’s shield generators just blew! Is that good? Whose is that?",
        ],
        ["walt", "Check the hull, Jesse. Then decide whether to celebrate."],
      ],
      dark: [
        [
          "walt",
          "A flagship’s generators are gone. Whoever owns it just became a very large target.",
        ],
        ["jesse", "Please don’t be ours. Please don’t be ours."],
      ],
    },
    bridge: {
      light: [
        ["jesse", "Whoa, the bridge just went! Like, the whole top bit!"],
        [
          "walt",
          "Cut off the head, Jesse. Somebody’s flagship is flying itself now.",
        ],
      ],
      dark: [
        [
          "walt",
          "A flagship without a bridge, Jesse. Nobody in charge. That’s how operations die.",
        ],
        ["jesse", "Whose operation, though?"],
      ],
    },
    reactor: {
      light: [
        ["jesse", "The reactor’s going! Mr. White, that’s a lot of boom!"],
        ["walt", "Exothermic, Jesse. Very. Get us clear."],
      ],
      dark: [
        [
          "walt",
          "A reactor breach. Unstable fuel, no containment. I could have told them.",
        ],
        ["jesse", "Can you tell me where to fly instead?!"],
      ],
    },
    won: {
      light: [
        ["jesse", "We won, yo! We freed {place}! We’re, like, heroes!"],
        ["walt", "Don’t get attached to it, Jesse."],
      ],
      dark: [
        [
          "walt",
          "We’ve taken {place}, Jesse. Territory. The only currency that never inflates.",
        ],
        ["jesse", "Yeah, science! Wait. Is this science?"],
      ],
      hutt: [
        ["jesse", "The Hutts are out of {place}! Bye, slugs!"],
        ["walt", "A cartel doesn’t forget, Jesse. Neither do I."],
      ],
    },
    lost: {
      light: [
        ["jesse", "We lost {place}, Mr. White. We, like, actually lost."],
        ["walt", "I’ve had worse news from a doctor, Jesse. We regroup."],
      ],
      dark: [
        [
          "walt",
          "We’ve lost {place} to {them}. Somebody in command is going to answer for that.",
        ],
        ["jesse", "As long as it’s not us, yo."],
      ],
      hutt: [
        ["jesse", "The slugs won?! We lost to the slugs, Mr. White!"],
        [
          "walt",
          "The Hutts keep {place}. For now. A cartel gets comfortable, Jesse. That’s when you strike.",
        ],
      ],
    },
    turncoat: {
      light: [
        [
          "jesse",
          "Yo, we switched sides? Mr. White, we were with the other guys like five minutes ago!",
        ],
        [
          "walt",
          "I walked away from Gray Matter, Jesse. I can walk away from anyone.",
        ],
      ],
      dark: [
        [
          "walt",
          "We fly for {us} now, Jesse. Better organised. Better funded. Better.",
        ],
        ["jesse", "So we’re, like, the bad guys now? On purpose?"],
        ["walt", "We were always going to end up here."],
      ],
    },
    ace: {
      light: [
        ["jesse", "I got their ace, yo! Their number one guy!"],
        ["walt", "Their best, Jesse. Now they know who ours is."],
      ],
      dark: [
        [
          "walt",
          "Their hero, Jesse. Every movement has one, and every one of them is mortal.",
        ],
        [
          "jesse",
          "They’re gonna put that guy on a poster. And we’re the ones who shot him.",
        ],
      ],
    },
    escort: {
      light: [
        ["jesse", "Yo, {us} sent backup! They’re flying with us!"],
        ["walt", "Don’t wave, Jesse. Just keep formation."],
      ],
      dark: [
        ["walt", "An escort from {us}, Jesse. They look after their assets."],
        ["jesse", "We’re an asset? Cool. I think?"],
      ],
    },
    deserter: {
      light: [
        [
          "jesse",
          "Mr. White, this is their space. The guys we ditched. They remember us, yo.",
        ],
        [
          "walt",
          "Nobody forgets a defector, Jesse. Keep your speed down and your head lower.",
        ],
      ],
      dark: [
        [
          "walt",
          "Our old employers’ space, Jesse. They’ll have our faces on a wall by now.",
        ],
        ["jesse", "Like a wanted poster? Yo, which picture did they use?"],
      ],
    },
    intercept: {
      light: [
        [
          "jesse",
          "Got it! Whatever it was carrying, it’s not getting there now, yo!",
        ],
        ["walt", "Distribution denied. That’s how you hold territory, Jesse."],
      ],
      dark: [
        [
          "walt",
          "Nothing gets past us, Jesse. Not a bomber, not a runner, not a crate.",
        ],
        ["jesse", "Wall of RV, yo!"],
      ],
    },
    runners: {
      light: [
        ["jesse", "Yo, a bunch of transports are making a run for it!"],
        [
          "walt",
          "Ours or theirs, Jesse? Look before you shoot. Then shoot accordingly.",
        ],
      ],
      dark: [
        [
          "walt",
          "Runners. A supply chain trying to get through a war, Jesse. I’ve been there.",
        ],
        ["jesse", "So do we shoot them or, like, cheer?"],
        ["walt", "Depends whose they are."],
      ],
    },
    gate: {
      light: [
        ["jesse", "The shield’s down! The big bubble just popped, yo!"],
        ["walt", "Every perimeter has a gate, Jesse. Somebody just found it."],
      ],
      dark: [
        [
          "walt",
          "The shield is down. Somebody’s perimeter just failed. I’d fire their head of security.",
        ],
        ["jesse", "Hope it’s not our head of security."],
      ],
    },
    interdictor: {
      light: [
        ["jesse", "Yo, the stretchy stars won’t stretch! Nobody can jump!"],
        ["walt", "An Interdictor, Jesse. Nobody leaves until somebody wins."],
      ],
      dark: [
        [
          "walt",
          "Gravity wells. Nobody leaves, Jesse. Not them, not us. A locked room with a killer in it.",
        ],
        ["jesse", "Which one of us is the killer?"],
        ["walt", "Fly, Jesse."],
      ],
    },
    blockade: {
      light: [
        ["jesse", "It’s a blockade at {place}, yo! Somebody’s making a run!"],
        [
          "walt",
          "A blockade is a border with guns, Jesse. We’ve moved product past worse.",
        ],
      ],
      dark: [
        [
          "walt",
          "A wall of ships around {place}, and somebody thinks they can drive through it.",
        ],
        ["jesse", "Yo, that’s literally us and the DEA every weekend."],
      ],
    },
  },
  battleWar: {
    clone: {
      front: {
        light: [
          [
            "jesse",
            "Yo, the Clone Wars! We’re with the clones, against the robot dudes!",
          ],
          [
            "walt",
            "The Republic, Jesse, against the Separatists’ droid foundries. Batch against batch.",
          ],
        ],
        dark: [
          [
            "walt",
            "The Separatists, Jesse. Droid foundries, banking clans, a production line that never sleeps.",
          ],
          [
            "jesse",
            "We’re with the robots? Yo, the Clone Wars are so confusing.",
          ],
        ],
      },
      won: {
        light: [
          ["jesse", "The droids are scrap, yo! The Republic wins!"],
          [
            "walt",
            "For now, Jesse. Somebody at the top of this Republic is playing a much longer game.",
          ],
        ],
        dark: [
          [
            "walt",
            "The Republic’s clones are falling back, Jesse. The Separatists take this round.",
          ],
          ["jesse", "Roger roger, yo!"],
        ],
      },
    },
    gcw: {
      front: {
        light: [
          ["jesse", "The Rebellion versus the Empire, yo! The real Star Wars!"],
          [
            "walt",
            "A handful of rebels against an empire, Jesse. I was a small operation once.",
          ],
        ],
        dark: [
          [
            "walt",
            "The Empire, Jesse. Uniforms, a chain of command, a Death Star on schedule. An organisation.",
          ],
          ["jesse", "Mr. White, we’re literally the stormtroopers right now."],
        ],
      },
      won: {
        light: [
          ["jesse", "We beat the Empire! The Rebellion wins, yo!"],
          [
            "walt",
            "The little guy beat the corporation, Jesse. Write that down. It almost never happens.",
          ],
        ],
        dark: [
          [
            "walt",
            "The Rebellion breaks, Jesse. The Empire holds. Order beats enthusiasm.",
          ],
          ["jesse", "Yay… Empire?"],
        ],
      },
    },
    remnant: {
      front: {
        light: [
          ["jesse", "Yo, the Empire’s back? I thought the New Republic won!"],
          [
            "walt",
            "What’s left of it, Jesse. The New Republic is cleaning up. Today, we’re the cleaners.",
          ],
        ],
        dark: [
          [
            "walt",
            "The Imperial Remnant, Jesse. Exiled, underfunded, plotting a comeback. I spent a winter in New Hampshire.",
          ],
          [
            "jesse",
            "Against the New Republic? Those are like the nice guys, yo.",
          ],
        ],
      },
      won: {
        light: [
          ["jesse", "The Remnant’s running! The New Republic wins, yo!"],
          [
            "walt",
            "Don’t celebrate yet, Jesse. The last time I was finished, I came back with an M60.",
          ],
        ],
        dark: [
          [
            "walt",
            "The New Republic retreats, Jesse. The Remnant isn’t a remnant any more.",
          ],
          ["jesse", "So the Empire’s, like, back back?"],
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
            "jesse",
            "Yo, a second Death Star! And its shield comes from that little forest moon!",
          ],
          [
            "walt",
            "The Emperor let them find it, Jesse. You don’t leak a location like that by accident.",
          ],
        ],
        dark: [
          [
            "walt",
            "The Emperor baited the whole Rebel fleet to Endor, Jesse. Fully armed and operational. Magnificent.",
          ],
          ["jesse", "What about the teddy bears on the moon, though?"],
        ],
      },
      won: {
        light: [
          [
            "jesse",
            "The Death Star blew up! Again! And the teddy bears are drumming, yo!",
          ],
          [
            "walt",
            "Beaten by bears with sticks, Jesse. Never underestimate the locals.",
          ],
        ],
        dark: [
          [
            "walt",
            "The trap closed, Jesse. The Rebel fleet is finished at Endor. A plan executed to perfection.",
          ],
          ["jesse", "The little bears are gonna be so sad, yo."],
        ],
      },
    },
    hoth: {
      war: "gcw",
      front: {
        light: [
          ["jesse", "Mr. White, giant robot camels are walking at the base!"],
          [
            "walt",
            "Walkers, Jesse. Echo Base needs every transport out before they reach the generator.",
          ],
        ],
        dark: [
          [
            "walt",
            "The admiral came out of lightspeed too close, Jesse. Sloppy. Lord Vader is dealing with it.",
          ],
          [
            "jesse",
            "Dealing with it how? Oh. Oh, he’s choking him. Through a hologram, yo.",
          ],
        ],
      },
      won: {
        light: [
          ["jesse", "They got off the ice, yo! Every last transport!"],
          ["walt", "A clean evacuation, Jesse. Leave nothing behind but snow."],
        ],
        dark: [
          [
            "walt",
            "Echo Base has fallen, Jesse. The walkers did it the slow way. Slow works.",
          ],
          ["jesse", "Yo, I feel kinda bad for the snow lizard horse things."],
        ],
      },
    },
    scarif: {
      war: "gcw",
      front: {
        light: [
          ["jesse", "Yo, the beach planet! The Rebellion’s robbing the vault!"],
          [
            "walt",
            "The plans, Jesse. One data tape, one shield gate, and a dish on top of a tower.",
          ],
        ],
        dark: [
          [
            "walt",
            "Rebels in the Citadel, Jesse, after Director Krennic’s blueprints. Nobody steals my formula.",
          ],
          ["jesse", "Technically, Mr. White, it’s not your formula."],
        ],
      },
      won: {
        light: [
          ["jesse", "The plans got out, yo! They beamed them up!"],
          [
            "walt",
            "Somebody built a flaw into that station on purpose, Jesse. A man after my own heart.",
          ],
        ],
        dark: [
          [
            "walt",
            "The vault holds, Jesse. The plans stay on Scarif. Security, done properly.",
          ],
          ["jesse", "So can we go to the beach now? Mr. White? The beach?"],
        ],
      },
    },
    yavin: {
      war: "gcw",
      front: {
        light: [
          [
            "jesse",
            "Yo, the Death Star’s coming round the gas planet! The Rebels have, like, minutes!",
          ],
          [
            "walt",
            "Thirty of them, Jesse, then the moon is in range. Stay on target.",
          ],
        ],
        dark: [
          [
            "walt",
            "Governor Tarkin intends to end this today, Jesse. One shot. One moon. One rebellion.",
          ],
          [
            "jesse",
            "Yo, they’re sending, like, tiny planes at it. Should we be worried?",
          ],
        ],
      },
      won: {
        light: [
          [
            "jesse",
            "They blew up the Death Star, yo! One shot! Right down the hole!",
          ],
          [
            "walt",
            "A station the size of a moon, Jesse, undone by a farm boy and a ventilation shaft.",
          ],
        ],
        dark: [
          [
            "walt",
            "The rebel base is gone, Jesse. Fear will keep the local systems in line. Tarkin said so.",
          ],
          ["jesse", "That dude’s scary, yo. Like, scarier than you."],
        ],
      },
    },
    bespin: {
      war: "gcw",
      front: {
        light: [
          [
            "jesse",
            "Yo, the cloud city! They froze the smuggler guy in, like, a block!",
          ],
          [
            "walt",
            "The administrator wants his city back, Jesse. Lando. A businessman. I respect him already.",
          ],
        ],
        dark: [
          [
            "walt",
            "Lord Vader has altered the deal, Jesse. Pray he doesn’t alter it any further.",
          ],
          ["jesse", "Yo, that’s exactly what Gus would say."],
        ],
      },
      won: {
        light: [
          ["jesse", "Cloud City’s free! The cape guy’s getting his city back!"],
          [
            "walt",
            "Tibanna gas, Jesse. A product that literally floats. That’s a business.",
          ],
        ],
        dark: [
          [
            "walt",
            "Cloud City is the Empire’s, Jesse. And a smuggler is on his way to a gangster, frozen solid.",
          ],
          ["jesse", "Worst delivery ever, yo."],
        ],
      },
    },
    coruscant: {
      war: "clone",
      front: {
        light: [
          [
            "jesse",
            "Yo, the robots are attacking the capital! Mr. White, they kidnapped the president guy!",
          ],
          [
            "walt",
            "The Chancellor, Jesse. Two Jedi are flying in to get him back. This is where the fun begins.",
          ],
        ],
        dark: [
          [
            "walt",
            "General Grievous has taken the Chancellor from his own capital, Jesse. Bold. Very bold.",
          ],
          [
            "jesse",
            "Yo, why does the robot general cough? Robots don’t even have lungs!",
          ],
        ],
      },
      won: {
        light: [
          [
            "jesse",
            "They got the Chancellor back! And they landed half a ship! Half, yo!",
          ],
          [
            "walt",
            "Watch that Chancellor, Jesse. He’s far too calm for a hostage.",
          ],
        ],
        dark: [
          [
            "walt",
            "Coruscant’s defences are broken, Jesse. The Separatists hold the Republic’s own capital.",
          ],
          [
            "jesse",
            "Yo, the robots took the whole city planet. Like, all trillion people.",
          ],
        ],
      },
    },
    naboo: {
      war: "clone",
      front: {
        light: [
          [
            "jesse",
            "Yo, there’s a ring of giant donut ships round the pretty planet!",
          ],
          [
            "walt",
            "A Trade Federation blockade, Jesse. A tax dispute, with battleships.",
          ],
        ],
        dark: [
          [
            "walt",
            "The Trade Federation’s blockade, Jesse. Unhappy about taxes, and in possession of a navy.",
          ],
          ["jesse", "All that over taxes? Yo, that’s so boring and so scary."],
        ],
      },
      won: {
        light: [
          [
            "jesse",
            "A little kid blew up the droid control ship! By accident! All the robots just stopped!",
          ],
          [
            "walt",
            "One control ship for every droid, Jesse. Never keep the whole operation in one lab.",
          ],
        ],
        dark: [
          [
            "walt",
            "The blockade holds, Jesse. The Viceroy will have his treaty signed, one way or another.",
          ],
          ["jesse", "Yo, the pretty planet deserved better."],
        ],
      },
    },
    lothal: {
      war: "remnant",
      front: {
        light: [
          [
            "jesse",
            "Yo, there’s a giant mural down there. Of a kid and a… space whale?",
          ],
          [
            "walt",
            "Purrgil, Jesse. A boy rode off with the Grand Admiral on one. The New Republic hears he’s back.",
          ],
        ],
        dark: [
          [
            "walt",
            "Grand Admiral Thrawn studies his enemies’ art before he breaks them, Jesse. That is research.",
          ],
          [
            "jesse",
            "I draw too, yo. Like, comics. Does that make me a genius?",
          ],
          ["walt", "No."],
        ],
      },
      won: {
        light: [
          ["jesse", "Lothal’s safe! The wolves are howling, yo! Giant wolves!"],
          [
            "walt",
            "The New Republic holds Lothal, Jesse. For once, the factories stay closed.",
          ],
        ],
        dark: [
          [
            "walt",
            "Thrawn is home, Jesse. Lothal is the Remnant’s again, factories and all.",
          ],
          ["jesse", "Yo, poor wolves."],
        ],
      },
    },
  },
};
