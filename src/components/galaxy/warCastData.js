// The commanders of the galaxy's wars, as data (warCast.js has the rules):
// the films' and the shows' own, the side or sides each commands for, their
// colour on the comms, and what they say at each moment of a battle; who's
// each side's general; and who's posted where.

export const CAST = {
  ackbar: {
    id: "ackbar",
    name: "Admiral Ackbar",
    sides: ["rebel"],
    color: "#ff7f50",
    lines: {
      front:
        "All craft, engage. If anything out here looks like a trap, say so at once. I would rather not be the one who says it.",
      join: "Welcome to the fleet, {rank}. Stay close to the cruisers, and never trust anything that looks too easy.",
      gens: "Shields are down on the big ship. All fighters, close on her; this will be settled within a kilometre of that hull.",
      bridge:
        "The bridge has been hit. That ship is all hull and no head now. Watch the reactor.",
      reactor:
        "Reactor breach! Clear the area. Nobody wants to be anywhere near that when it goes.",
      won: "We have done it. Fall back to the fleet and take a breath; you have earned one.",
      lost: "We cannot hold here. All craft, disengage and fall back. We will fight again, and wiser.",
      again:
        "You have flown here before, {rank}. You know where the guns are, so act like it.",
    },
  },
  leia: {
    id: "leia",
    name: "Princess Leia",
    sides: ["rebel"],
    color: "#ffc27a",
    lines: {
      front:
        "Somebody has to save our skins. All wings, engage, and try not to make it complicated.",
      join: "Glad you could make it, {rank}. Try not to be heroic; it is rarely as useful as it looks.",
      gens: "The shields are down. Now everyone stop talking and fly; this is the part that counts.",
      bridge:
        "The bridge is gone. That ship is flying on hope and habit now. I know the feeling.",
      reactor:
        "The reactor’s going. Everyone get clear; I am not losing a pilot to somebody else’s explosion.",
      won: "We did it! I’d hug you, {rank}, but you’d never let me hear the end of it.",
      lost: "We’re losing too much. Pull out now; I would rather have pilots than pride.",
      again:
        "You again, {rank}. Good. You already know all the ways this place tries to kill you.",
    },
  },
  rieekan: {
    id: "rieekan",
    name: "General Rieekan",
    sides: ["rebel"],
    color: "#e8a87c",
    lines: {
      front:
        "All units, to your stations. It is cold, it is dark, and it is ours to decide. Move.",
      join: "Good to have you, {rank}. Keep your engines warm; out here nothing else will be.",
      gens: "Shield generators down. You may not feel it in this cold, but everything just got faster.",
      bridge:
        "The bridge is gone. Keep moving, all of you; standing still is how Hoth kills you.",
      reactor: "Reactor breach. Stand clear, and let the ice have it.",
      won: "Well flown. Come in and thaw out; the hot drinks are on me, such as they are.",
      lost: "We cannot hold. Fall back and get clear; we can lose the ground, but not the pilots.",
      again:
        "Back on Hoth, {rank}? Then you already know the cold is the easy part.",
    },
  },
  dodonna: {
    id: "dodonna",
    name: "General Dodonna",
    sides: ["rebel"],
    color: "#ff9966",
    lines: {
      front:
        "Man your ships, and may the Force be with you. Nothing about today will be easy; fly as if you expected that.",
      join: "Glad to have you, {rank}. Fly it as briefed, and when the briefing is wrong, fly it better.",
      gens: "The shields are down. One small fighter can change everything now. Be the one that does.",
      bridge:
        "Bridge destroyed. Even a ship that size needs someone to tell it what to do.",
      reactor:
        "Reactor breach. Somebody always forgets to cover the exhaust ports. Clear the area!",
      won: "Well done. This goes in the briefings; the next lot of pilots will be insufferable about it.",
      lost: "Pull back. I underestimated them, and I will not ask you to pay for my arithmetic.",
      again:
        "Back over Yavin, {rank}. You know the approach. Try not to make it look easy; it upsets the cadets.",
    },
  },
  raddus: {
    id: "raddus",
    name: "Admiral Raddus",
    sides: ["rebel"],
    color: "#ff6f61",
    lines: {
      front:
        "All wings, this is Raddus. Whoever holds that shield gate holds Scarif. Get to it.",
      join: "Just in time, {rank}. I never trust a battle that starts without a few late arrivals.",
      gens: "Shields are down on that ship. Close in, all of you, and make the next minute count.",
      bridge:
        "The bridge is gone. That ship is now a very large problem with nobody aboard to solve it.",
      reactor:
        "The reactor is going. Pull away, all of you. Scarif has seen enough explosions for one war.",
      won: "Well done. May the Force be with you, and may it stay a little longer this time.",
      lost: "We are finished here. All craft, jump while you can; somebody has to carry this home.",
      again:
        "Back at the gate, {rank}. You know how this goes. Let us see that it goes our way.",
    },
  },
  hera: {
    id: "hera",
    name: "General Syndulla",
    sides: ["rebel", "newrepublic"],
    color: "#ffa94d",
    lines: {
      front:
        "This is the Ghost. Everyone on my wing and keep it tidy; I do not want to explain the dents to Chopper.",
      join: "Welcome aboard, {rank}. Fly smart, look after each other, and ignore anything Chopper says.",
      gens: "Shields are down on that ship! Watch the bombers; this is where it gets loud.",
      bridge:
        "That is the bridge gone. Nobody is giving orders on that ship now, so keep thinking for yourselves.",
      reactor:
        "The reactor is going up! Everyone break off and get clear, now. Chopper, that includes you.",
      won: "That is how it is done. I am proud of you, {rank}. Do not tell Chopper; he will want the credit.",
      lost: "Fall back to the Ghost and get out. We regroup, we heal, and we come back.",
      again:
        "Lothal again, {rank}. This place has my heart, so fly it like it has yours.",
    },
  },
  monmothma: {
    id: "monmothma",
    name: "Mon Mothma",
    sides: ["rebel", "newrepublic"],
    color: "#f5d0a9",
    lines: {
      front:
        "Every ship here is a vote. Cast it well, and let us have no recounts.",
      join: "Thank you for coming, {rank}. The galaxy will not see what you do here, but I will.",
      gens: "The shields are down. Many brave pilots have paid for this moment; do not waste it.",
      bridge:
        "The bridge has fallen. I have known senates with a better sense of direction than that ship has now.",
      reactor:
        "The reactor is failing. Clear the area, please; I would like you all at the reception afterwards.",
      won: "Well done. I shall make a speech about this, and for once it will need no embellishment.",
      lost: "We withdraw. A setback is not a defeat, and I have given that speech before.",
      again:
        "Back again, {rank}. Persistence is the only politics I have ever truly trusted.",
    },
  },
  wedge: {
    id: "wedge",
    name: "Wedge Antilles",
    sides: ["rebel"],
    color: "#ff5c5c",
    lines: {
      front:
        "All wings, lock S-foils in attack position. And nobody remark on the size of anything.",
      join: "Good to have you on my wing, {rank}. Stay tight, and if I say break, break.",
      gens: "Shields are down! Here we go. The hard part is always the bit right after this.",
      bridge:
        "There goes the bridge! Keep your heads; that ship will thrash about before she settles.",
      reactor:
        "Reactor breach! I have done this before; trust me, you want to be a long way off. Go!",
      won: "We did it! Drinks are on me, and I will deny saying so in the morning.",
      lost: "That is it, we are done here. Everyone peel off and jump. No heroics; I have seen how they end.",
      again: "Back again, {rank}? Good. Same as last time, only better.",
    },
  },
  bail: {
    id: "bail",
    name: "Bail Organa",
    sides: ["rebel"],
    color: "#e8b4a0",
    lines: {
      front:
        "Diplomacy has failed, as diplomacy so often does. All ships, I leave the rest to you.",
      join: "Welcome, {rank}. I am a senator, not a pilot, so I shall trust you to know what you are doing.",
      gens: "The shields are down, I am told. I am also told that is very important, so do be careful.",
      bridge:
        "The bridge is gone. In my experience a body without a head still has a temper. Keep clear.",
      reactor:
        "The reactor is failing. Please get clear; I would rather not write that letter to anyone’s family.",
      won: "Splendid. I shall tell the Senate it was all very orderly, and you will kindly not contradict me.",
      lost: "We must withdraw. Go now; I would rather explain a retreat than a funeral.",
      again:
        "Back again, {rank}. Coruscant deserves better than this, but it will settle for you.",
    },
  },
  piett: {
    id: "piett",
    name: "Admiral Piett",
    sides: ["empire"],
    color: "#9db3c9",
    lines: {
      front:
        "All squadrons, engage. Lord Vader expects results, and I expect to go on breathing.",
      join: "Welcome to the fleet, {rank}. Follow orders, report promptly, and never be the bearer of bad news.",
      gens: "Shields are down on that ship. Intensify the forward batteries; I do not want anything to get through.",
      bridge:
        "The bridge is gone. I have seen that happen once before, and I would prefer not to see it again.",
      reactor:
        "Reactor breach. All craft, withdraw from that hull at once. That is an order, and a kindness.",
      won: "Excellent. I shall inform Lord Vader personally; it is so rarely a pleasure.",
      lost: "We are withdrawing. I shall inform Lord Vader myself. Please remember me fondly.",
      again:
        "Back again, {rank}. Good. Lord Vader approves of persistence, and of very little else.",
    },
  },
  vader: {
    id: "vader",
    name: "Darth Vader",
    sides: ["empire"],
    color: "#93a3b8",
    lines: {
      front:
        "Engage them. I have no patience for delays, and less for those who cause them.",
      join: "{rank}. I am told you are capable. Do not make liars of those who told me.",
      gens: "The shields are down. Now the battle begins in earnest. Do not fail me.",
      bridge:
        "The bridge is gone. Its captain need not report to me. He has spared us both the conversation.",
      reactor:
        "The reactor will not hold. Withdraw. You are of more use to me alive, for now.",
      won: "Impressive. Most impressive. Do not imagine it makes you indispensable.",
      lost: "You have failed me. Be grateful I am not on your bridge.",
      again:
        "You have fought here before, {rank}. I sense you have learned something. Prove it.",
    },
  },
  tarkin: {
    id: "tarkin",
    name: "Grand Moff Tarkin",
    sides: ["empire"],
    color: "#b8c4d2",
    lines: {
      front: "You may fire when ready. Fear will do the rest; it usually does.",
      join: "Ah, {rank}. Do try to be useful; the alternative is so tedious to arrange.",
      gens: "The shields are down. How very predictable. Proceed, and do not dawdle.",
      bridge:
        "The bridge is gone. Command is always the first casualty of overconfidence.",
      reactor:
        "The reactor is failing. Evacuate? Very well; on this occasion, I shall allow it.",
      won: "As expected. Fear will keep the local systems in line now.",
      lost: "Withdraw. I overestimated their chances of failing. It will not happen twice.",
      again:
        "Back again, {rank}. Repetition is the soul of discipline. Do not disappoint me twice.",
    },
  },
  krennic: {
    id: "krennic",
    name: "Director Krennic",
    sides: ["empire"],
    color: "#dde3ea",
    lines: {
      front:
        "All units, engage. And do remember who you are fighting for; I shall be reading the report.",
      join: "Welcome, {rank}. Fly well, and if anyone asks, I recommended you personally.",
      gens: "Shields down! Open the gate, close the gate, I do not care; just win the next minute.",
      bridge:
        "The bridge is gone. Someone will be blamed for this, and it will not be me.",
      reactor:
        "Reactor breach. It is quite beautiful, actually. Get clear anyway.",
      won: "Splendid. I shall report it to Tarkin myself, before he can take the credit.",
      lost: "We were on the verge of greatness. We were this close. Fall back.",
      again:
        "Back again, {rank}. Good; I need witnesses who can confirm it was my plan.",
    },
  },
  thrawn: {
    id: "thrawn",
    name: "Grand Admiral Thrawn",
    sides: ["empire", "remnant"],
    color: "#87a9d4",
    lines: {
      front:
        "Observe before you strike. Every enemy tells you how they fight; most of them tell you loudly.",
      join: "Welcome, {rank}. I have studied your record. It is short, but not without promise.",
      gens: "The shields have fallen, precisely on schedule. Now we see who planned for this moment.",
      bridge:
        "The bridge is lost. A ship without a mind is only furniture. Watch what it does next.",
      reactor:
        "That reactor will fail within the minute. Withdraw. There is no art in dying beside a fire.",
      won: "As anticipated. Admire the pattern of it, {rank}; there is art in a battle well fought.",
      lost: "A defeat, but an instructive one. I will know them better next time; they will not know me.",
      again:
        "You have fought here before, {rank}. Then you have studied them. Show me what you learned.",
    },
  },
  ozzel: {
    id: "ozzel",
    name: "Admiral Ozzel",
    sides: ["empire"],
    color: "#a9b6c4",
    lines: {
      front:
        "All units, engage. We are exactly where we intended to be, and I will hear no remarks about lightspeed.",
      join: "Welcome to the fleet, {rank}. Do as I say, and do not repeat anything I say to Lord Vader.",
      gens: "The shields are down. Splendid, I think. Somebody tell me if this is splendid.",
      bridge: "The bridge is gone. I do hope nobody thinks that was my idea.",
      reactor:
        "Reactor breach! Everyone clear off, quickly, before anybody asks who planned the approach.",
      won: "A triumph, and entirely as I planned it. See that Lord Vader hears it from me first.",
      lost: "Fall back. And kindly say nothing to Lord Vader; I find he takes these things personally.",
      again:
        "Back again, {rank}? Then you know the approach. Do come out of lightspeed further out this time.",
    },
  },
  jerjerrod: {
    id: "jerjerrod",
    name: "Moff Jerjerrod",
    sides: ["empire"],
    color: "#93a5b6",
    lines: {
      front:
        "All units, engage. We are on schedule, and we shall double our efforts to stay there.",
      join: "Welcome, {rank}. Work quickly; the Emperor is not nearly as forgiving as I am.",
      gens: "The shields are down. That was not in the schedule. Nothing ever is.",
      bridge:
        "The bridge is gone. Every schedule I have just changed. Adjust accordingly.",
      reactor:
        "Reactor breach. Clear the area! I know what a reactor does on its way out, and so does Endor.",
      won: "Done, and ahead of schedule. I shall mention you in my report, if anyone reads them.",
      lost: "We withdraw. I assure you, my men were working as fast as they could.",
      again:
        "You have flown here before, {rank}. Good; I have no time in the schedule for introductions.",
    },
  },
  gideon: {
    id: "gideon",
    name: "Moff Gideon",
    sides: ["empire", "remnant"],
    color: "#8494ac",
    lines: {
      front:
        "Engage. I would tell you to be careful, but care was never our strength. Precision is.",
      join: "Welcome, {rank}. You may think you know what you have signed up for. You do not.",
      gens: "The shields are down. This is the part I enjoy. Do try to keep up.",
      bridge:
        "The bridge is gone. Leadership is overrated; discipline is not. Hold your formation.",
      reactor:
        "That reactor is finished. Pull back and let it burn. There are always more ships.",
      won: "Exactly as it should be. Order always returns, {rank}; it only needs people like us to fetch it.",
      lost: "Fall back. A setback, nothing more; I have survived far worse than a bad afternoon.",
      again:
        "You have been here before, {rank}. So have I. The difference is that I always come back.",
    },
  },
  yoda: {
    id: "yoda",
    name: "Master Yoda",
    sides: ["republic"],
    color: "#9ad4ff",
    lines: {
      front:
        "Begun, this battle has. Fly well you must, and rush not. Patience, the strongest weapon is.",
      join: "Welcome, {rank}. Fear not. Afraid, the enemy should be. Hmm.",
      gens: "Down, the shields are. Now, matters most. Focus, you must.",
      bridge:
        "Gone, the bridge is. Headless, that ship flies. Dangerous still, a headless thing is.",
      reactor:
        "Breaking, the reactor is. Away, all of you! A good death there is not. Live, you will.",
      won: "Won, we have. Celebrate a little, you may. Arrogant, become you must not.",
      lost: "Lost, this battle is. Not the war, hmm? Fall back. Learn from failure, we must.",
      again:
        "Here before, you have been, {rank}. Remember what you learned. Use it, you must.",
    },
  },
  obiwan: {
    id: "obiwan",
    name: "General Kenobi",
    sides: ["republic"],
    color: "#6fb7ff",
    lines: {
      front:
        "Hello there. All ships, engage, and do try to keep this civilised.",
      join: "Ah, {rank}. Welcome. I have a bad feeling about this, but then I always do.",
      gens: "The shields are down. Now comes the delicate part, so naturally everyone will start shooting.",
      bridge:
        "There goes the bridge. Well, that is one way to end a conversation.",
      reactor:
        "The reactor is going. I suggest we all find somewhere else to be. Quickly.",
      won: "Well done. Another happy landing. Anakin will say it was his idea, of course.",
      lost: "We are pulling out. Not every battle can be won from the high ground, I am afraid.",
      again:
        "Back again, {rank}. You know what they say about the high ground. Find it.",
    },
  },
  anakin: {
    id: "anakin",
    name: "General Skywalker",
    sides: ["republic"],
    color: "#4fa3ff",
    lines: {
      front:
        "This is where the fun begins. Stay on my wing and try to keep up.",
      join: "Glad you made it, {rank}. Plans are overrated; just follow me and improvise.",
      gens: "Shields are down! Now we are talking. Everyone in close; this is the good part.",
      bridge:
        "There goes the bridge! Without it that ship flies about as well as Obi-Wan does.",
      reactor:
        "The reactor is blowing. Pull out! Spinning is a good trick, but distance is a better one.",
      won: "That was easy. Well, not easy. Well, mostly me. Good flying, {rank}.",
      lost: "Pull back! I hate retreating, so do it quickly, before I change my mind.",
      again:
        "Back again, {rank}? Then you know the plan. There is no plan. Let us go.",
    },
  },
  ahsoka: {
    id: "ahsoka",
    name: "Commander Tano",
    sides: ["republic"],
    color: "#7fd6ff",
    lines: {
      front:
        "All right, everyone, eyes up. Stay sharp, stay together, and try not to fly like Skyguy.",
      join: "Welcome, {rank}. I was new once too. It wore off quickly, and so will this.",
      gens: "Shields are down! This is where it gets messy. Keep your heads and watch each other.",
      bridge:
        "The bridge is gone. That ship is running on instinct now, and instinct makes mistakes.",
      reactor:
        "The reactor is going! Everyone clear out. Nobody gets to be a hero today.",
      won: "We did it! Not bad, {rank}. Skyguy would have taken twice as long and broken something.",
      lost: "We are falling back. Losing is a lesson too. I just hate that it is.",
      again:
        "Back again, {rank}? Good. You know the ground; trust it, and trust yourself.",
    },
  },
  rex: {
    id: "rex",
    name: "Captain Rex",
    sides: ["republic"],
    color: "#5c9eff",
    lines: {
      front:
        "All right, troopers, you know the drill. Eyes front, and nobody do anything Fives would do.",
      join: "Welcome aboard, {rank}. In my book, experience outranks everything. Go and get some.",
      gens: "Shields are down! Stay tight, troopers. This is where it gets loud.",
      bridge:
        "The bridge is down! That ship is running blind now. Keep your distance and your discipline.",
      reactor:
        "Reactor breach! Everybody out of there, double time. That is an order.",
      won: "Good work, troopers. Another one for the books, and Fives owes me a drink.",
      lost: "Fall back! Wounded out first. We regroup, and we come back harder.",
      again:
        "Back again, {rank}. Good. You know what to expect, and that makes you dangerous.",
    },
  },
  windu: {
    id: "windu",
    name: "Master Windu",
    sides: ["republic"],
    color: "#8f9bff",
    lines: {
      front:
        "All units, engage. I am not in the mood for surprises today, so do not give me any.",
      join: "{rank}. Good. Keep your focus and your discipline, and we will get through this.",
      gens: "The shields are down. Now we find out who trained properly. Focus.",
      bridge:
        "The bridge is gone. Without command, that ship is just a fight waiting for an ending.",
      reactor:
        "Reactor breach. Clear the area, now. I have seen enough explosions for one lifetime.",
      won: "This party’s over. Well fought, {rank}. Do not let it go to your head.",
      lost: "Fall back. We are not finished here; we are just finished for today.",
      again:
        "You have fought here before, {rank}. Then I expect better than before.",
    },
  },
  yularen: {
    id: "yularen",
    name: "Admiral Yularen",
    sides: ["republic"],
    color: "#a9cbee",
    lines: {
      front:
        "All batteries, open fire. Fighters, engage. Let us show them what a proper fleet looks like.",
      join: "Welcome to the fleet, {rank}. Fly by the book; the Jedi rarely do, and somebody must.",
      gens: "Shields are down on that ship. All batteries, concentrate. This is no time for improvisation.",
      bridge:
        "The bridge is gone. A ship without its officers is unpredictable. Steady, everyone.",
      reactor:
        "Reactor breach. All fighters, clear the blast radius. We are not losing anyone to physics.",
      won: "Well fought. I shall enter it in the log, in suitably restrained language.",
      lost: "All ships, withdraw. In good order, please; we lose with dignity or not at all.",
      again:
        "Back again, {rank}. The Jedi call it the Force. I call it practice. Carry on.",
    },
  },
  grievous: {
    id: "grievous",
    name: "General Grievous",
    sides: ["separatists"],
    color: "#d9a441",
    lines: {
      front:
        "All units, engage! Crush them! Make them suffer! [coughs] And do not miss this time.",
      join: "Another {rank}. Try to last longer than the last one; I am running out of spare parts.",
      gens: "The shields are down! [coughs] Now it gets interesting. Cowards will be scrapped.",
      bridge:
        "The bridge is gone! Bah. Officers are always the first thing to break.",
      reactor:
        "Reactor breach! Get clear, you fools. I am not paying for more droids.",
      won: "Ha! A fine addition to my collection. [coughs] Victory almost suits you.",
      lost: "Retreat! Retreat! [coughs] This is not over. It is merely postponed.",
      again:
        "You again, {rank}. Good. You survived. That makes you rarer than my droids.",
    },
  },
  dooku: {
    id: "dooku",
    name: "Count Dooku",
    sides: ["separatists"],
    color: "#c98f3a",
    lines: {
      front:
        "Begin. Do try to be elegant about it; brute force is so terribly common.",
      join: "Ah, {rank}. Welcome. I do hope you are better company than the droids.",
      gens: "The shields are down. Elegance is no longer an option; now it is simply a matter of will.",
      bridge:
        "The bridge is gone. Twice the pride, double the fall. I am sure I warned somebody.",
      reactor:
        "The reactor is failing. Withdraw. I have no wish to be anywhere near so vulgar a display.",
      won: "Splendid. Victory is so much more civilised than the alternative. Do not gloat.",
      lost: "We withdraw. A temporary inconvenience. I have other plans; I always do.",
      again:
        "Back again, {rank}. Persistence. How refreshingly unlike a droid.",
    },
  },
  ventress: {
    id: "ventress",
    name: "Asajj Ventress",
    sides: ["separatists"],
    color: "#e8c06a",
    lines: {
      front:
        "Let us get this over with. Fly fast, hit hard, and try not to bore me.",
      join: "So, {rank}. Dooku sent you? How touching. Try not to die before I learn your name.",
      gens: "The shields are down. Finally, something worth paying attention to.",
      bridge:
        "There goes the bridge. Pity. I was rather hoping to do that myself.",
      reactor:
        "The reactor is going. Run along, little pilots; I am not carrying anyone out of the fire.",
      won: "Well, that was almost entertaining. Do not expect a thank you.",
      lost: "We are done here. I am leaving, and I suggest you do the same. Quickly.",
      again: "You came back, {rank}. Brave, or stupid. We shall see which.",
    },
  },
  gunray: {
    id: "gunray",
    name: "Viceroy Gunray",
    sides: ["separatists"],
    color: "#bf9a4f",
    lines: {
      front:
        "Begin the operation. Remember, every ship you lose comes out of somebody’s profits. Mine, mostly.",
      join: "Welcome, {rank}. Your contract is most generous. Do try to live long enough to collect.",
      gens: "The shields are down! This is getting out of hand. Somebody fix it, or profit from it.",
      bridge:
        "The bridge is gone? Gone! Who authorised that? I certainly did not.",
      reactor:
        "The reactor is going! Pull out, pull out! Do you know what those cost?",
      won: "Ah, victory. Most profitable. I shall tell the Count it was my idea.",
      lost: "Retreat! And wipe the records. All of them. Nobody must know we were here.",
      again:
        "You again, {rank}. Repeat business. How very good for the ledger.",
    },
  },
  teva: {
    id: "teva",
    name: "Captain Teva",
    sides: ["newrepublic"],
    color: "#8fe0c4",
    lines: {
      front:
        "All wings, engage. Whatever the Senate thinks is happening out here, we are the ones who find out.",
      join: "Welcome to the fleet, {rank}. We are short on everything but nerve, so I hope you brought some.",
      gens: "Shields are down. This is the part the reports always leave out. Stay with me.",
      bridge:
        "There goes the bridge. Write it down; somebody back home will want it in triplicate.",
      reactor:
        "Reactor breach! Everyone clear. I am not filling in a loss report for anyone today.",
      won: "Good work, {rank}. I will send it up the chain. They will not read it, but we will know.",
      lost: "Fall back. Nobody else gets lost on my watch. We report it, and we come back.",
      again:
        "Back again, {rank}? Good. I keep telling them it is not over out here. You are the proof.",
    },
  },
  elsbeth: {
    id: "elsbeth",
    name: "Magistrate Elsbeth",
    sides: ["remnant"],
    color: "#b4bac6",
    lines: {
      front:
        "Begin. I built most of the ships in this line, and I should like most of them back.",
      join: "Welcome, {rank}. I do not reward loyalty. I reward results, and I keep very good books.",
      gens: "The shields are down. Anything forged can be broken; now we learn what was forged well.",
      bridge: "The bridge is gone. Command is a luxury. Steel is what remains.",
      reactor:
        "That reactor is lost. Withdraw. Wrecks can be melted down and made useful again; pilots are harder.",
      won: "Good. The Grand Admiral will hear of this. So will everyone else, eventually.",
      lost: "We withdraw. A loss is only metal, and metal I can always find more of.",
      again:
        "Back again, {rank}. Good. Patience is the only virtue I have ever found profitable.",
    },
  },
  jabba: {
    id: "jabba",
    name: "Jabba the Hutt",
    sides: ["hutt"],
    color: "#9bbf5a",
    lines: {
      front:
        "[in Huttese, laughing wetly: Another little pilot in Jabba’s sky. Jabba will collect whatever is left of you.]",
      won: "[in Huttese, furious: You will regret this. Jabba never forgets a face, and he has put a price on yours.]",
      lost: "[in Huttese, gleefully: Ho ho ho! Put this one in carbonite. It will look lovely beside the throne.]",
    },
  },
};

export const GENERALS = {
  republic: "yularen",
  separatists: "grievous",
  rebel: "ackbar",
  empire: "piett",
  newrepublic: "teva",
  remnant: "gideon",
  hutt: "jabba",
};

export const POSTS = {
  rebel: {
    hoth: "rieekan",
    yavin: "dodonna",
    scarif: "raddus",
    endor: "ackbar",
    lothal: "hera",
    tatooine: "leia",
    bespin: "leia",
    coruscant: "bail",
    kashyyyk: "wedge",
  },
  empire: {
    hoth: "ozzel",
    scarif: "krennic",
    endor: "jerjerrod",
    yavin: "tarkin",
    bespin: "vader",
    mustafar: "vader",
    lothal: "thrawn",
    nevarro: "gideon",
    mandalore: "gideon",
  },
  republic: {
    kashyyyk: "yoda",
    coruscant: "anakin",
    tatooine: "anakin",
    kamino: "obiwan",
    naboo: "obiwan",
    mustafar: "obiwan",
    mandalore: "ahsoka",
    geonosis: "windu",
    lothal: "rex",
  },
  separatists: {
    coruscant: "grievous",
    geonosis: "dooku",
    tatooine: "dooku",
    mustafar: "gunray",
    naboo: "gunray",
    kamino: "ventress",
  },
  newrepublic: {
    nevarro: "teva",
    lothal: "hera",
    coruscant: "monmothma",
  },
  remnant: {
    nevarro: "gideon",
    lothal: "thrawn",
    mandalore: "elsbeth",
  },
  hutt: {
    tatooine: "jabba",
  },
};
