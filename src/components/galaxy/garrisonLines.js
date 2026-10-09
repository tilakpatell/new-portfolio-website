// What's said when a planet's fleet takes notice of you (garrison.js's
// `{ type: 'event', id: 'garrison', sub, side, sys }`): the commander posted
// there for the side that holds it on the comms first (warCast.js's castFor,
// their name and colour), in words that fit any of that side's ships, then
// your crew. And the crews' words for the fight with the capital ship that
// drops in on you (`{ type: 'event', id: 'capital', sub }`, the universe
// map's moments), which in the galaxy may be a Star Destroyer, a Venator or
// a Mon Calamari cruiser, so nobody names its class.
//
// Text on the comms, never voiced: kept out of GALAXY_LINES and any
// voicelines.js, so the voices job (scripts/voices/export-lines.mjs) and the
// line tables' tests don't see them. Pure, tested; pages/Galaxy.jsx hands the
// exchange to the comms.
//
// GARRISON_SUBS: a garrison's moments (garrisonRules.js says when);
// CAPITAL_SUBS: the capital ship's.
// garrisonSay(event, crewId) → exchange (empty for a crew or moment it
// doesn't know).

import { castFor } from './warCast';

export const GARRISON_SUBS = ['challenge', 'warn', 'clear', 'scramble', 'open', 'standdown', 'cover', 'escort', 'reinforce'];
export const CAPITAL_SUBS = ['fired', 'shielded', 'dome', 'open', 'bridge', 'dead', 'fled', 'gone', 'wave'];

// the commander, by the side they hold the system for: an enemy challenged,
// a stranger warned off (and thanked for going), their fighters out and back,
// their guns open; your own side's covering you and sending a flight to meet
// you; and the call when a patrol of theirs is beaten near the planet
const COMMANDER = {
  empire: {
    challenge: 'Hostile craft, you are inside an Imperial picket. Cut your engines and stand by to be boarded.',
    warn: 'Unidentified ship, this is Imperial space and you are inside the picket. Turn back now.',
    clear: 'Unidentified ship, you are clear of the picket. Keep it that way.',
    scramble: 'Launch the ready squadron. That ship does not leave this system.',
    open: 'All batteries, you have a firing solution. Open fire.',
    standdown: 'Recall the fighters. Let it run; the fleet has better things to do.',
    cover: 'We have your pursuers, pilot. Bring them under our guns and we will do the rest.',
    escort: 'A flight is launching to meet you, pilot. Try not to need it.',
    reinforce: 'Our patrol has been driven off. Every gun in the picket: find that ship.',
  },
  rebel: {
    challenge: 'Hostile ship, you are inside an Alliance picket. Turn about or we open fire.',
    warn: 'Unidentified ship, you are inside the Alliance picket. Turn back now; we won’t ask twice.',
    clear: 'Thank you, unidentified ship. Safe travels, and stay clear of our lines.',
    scramble: 'Scramble the ready flight. That ship doesn’t get near the planet.',
    open: 'All batteries, open fire. Lead it and keep firing.',
    standdown: 'Fighters, break off and come home. It’s gone, and we can’t spare the fuel.',
    cover: 'We see them on your tail, pilot. Bring them in close and let our gunners have them.',
    escort: 'Flight launching to meet you. Hang on, pilot; help’s on its way.',
    reinforce: 'Our patrol’s been hit. All fighters, all batteries: that ship, now.',
  },
  republic: {
    challenge: 'Hostile ship, you are inside a Republic picket. Power down your weapons and stand by.',
    warn: 'Unidentified ship, you are inside the Republic picket. Turn back now, by order of the Senate.',
    clear: 'Unidentified ship, you are clear of the picket. The Republic thanks you.',
    scramble: 'Launch the clone squadrons. Bring that ship to heel.',
    open: 'Gunnery crews, you are clear to fire. Open up on it.',
    standdown: 'Recall the squadrons. We hold the line here; we don’t chase.',
    cover: 'We have you on our scopes, pilot. Bring them across our bow.',
    escort: 'A clone flight is launching to meet you. They’ll see you in.',
    reinforce: 'Our patrol is down. All batteries, all squadrons: take that ship.',
  },
  separatists: {
    challenge: 'Hostile vessel, you have entered Confederacy space. Surrender, or be destroyed.',
    warn: 'Unidentified vessel, this blockade belongs to the Confederacy. Turn back now.',
    clear: 'The vessel is leaving the blockade. Good. Do not come back.',
    scramble: 'Launch the droid fighters. Overwhelm it.',
    open: 'All batteries, fire at will. Fill the sky until it stops moving.',
    standdown: 'Recall the droids. It has fled, and the blockade holds.',
    cover: 'We see your pursuers. Bring them to us, and our guns will deal with them.',
    escort: 'Droid fighters launching to escort you. Try to keep up with them.',
    reinforce: 'Our patrol has been destroyed. All droids, all guns: destroy that ship.',
  },
  newrepublic: {
    challenge: 'Hostile ship, you are inside a New Republic picket. Stand down and prepare to be boarded.',
    warn: 'Unidentified ship, you are inside New Republic space. Turn back now, please.',
    clear: 'Thank you for your cooperation, unidentified ship. Fly safe.',
    scramble: 'Scramble the ready flight. Nobody threatens this system on my watch.',
    open: 'All batteries, weapons free. Open fire.',
    standdown: 'Recall the flight. It’s gone, and I have a report to write.',
    cover: 'We’ve got you, pilot. Bring them in range and we’ll take it from there.',
    escort: 'Flight launching to meet you. Sit tight, pilot.',
    reinforce: 'Our patrol’s been driven off. All batteries, all fighters: that ship.',
  },
  remnant: {
    challenge: 'Hostile ship, this sector is still the Empire’s. Power down and prepare to be boarded.',
    warn: 'Unidentified ship, this sector is under Imperial control. Turn back now.',
    clear: 'Unidentified ship leaving the sector. Wise. We will remember you.',
    scramble: 'Launch fighters. That ship is to be brought in, intact if possible.',
    open: 'Turbolasers, open fire. We are not in the habit of warning twice.',
    standdown: 'Recall the fighters. Let it go; it has shown us everything it can do.',
    cover: 'We see your pursuers, pilot. Lead them to us, and we will finish them.',
    escort: 'A flight is launching to meet you. The Empire looks after its own.',
    reinforce: 'Our patrol has failed. All fighters, all batteries: take that ship.',
  },
  // Jabba, who speaks only Huttese (nobody swears to the Hutts, so his fleet
  // never covers you today; every side has every moment all the same)
  hutt: {
    challenge: '[in Huttese, angrily: This is Jabba’s space, and you are no friend of Jabba. His guns are waking.]',
    warn: '[in Huttese, slowly: This sky belongs to Jabba. Turn round now, little pilot, or pay for it.]',
    clear: '[in Huttese, a deep chuckle: Wise. Jabba likes a pilot who knows when to leave.]',
    scramble: '[in Huttese, bellowing: Send out the fighters. Jabba wants that ship in pieces.]',
    open: '[in Huttese, gleefully: Fire. Fire everything. Jabba is paying for it anyway.]',
    standdown: '[in Huttese, bored: Let it go. Call the fighters back; they cost Jabba money.]',
    cover: '[in Huttese, amused: Jabba protects what is useful to him. Today, that is you.]',
    escort: '[in Huttese, grandly: Jabba sends you some company. He will send you the bill.]',
    reinforce: '[in Huttese, furious: Who shot Jabba’s patrol? Everyone out. Find that ship.]',
  },
};

// the crews: what they make of it, whoever's fleet it is (the same picket
// may be your own side's, or the one you swore against)
const CREWS = {
  cruiser: {
    garrison: {
      challenge: [['morty', 'Rick, the ships round the planet are talking to us. They sound mad.'], ['rick', 'It’s a picket, Morty. Parked warships with opinions, and we’re the opinion.']],
      warn: [['morty', 'Rick, they said turn back. Can we please turn back?'], ['rick', 'Their planet, their rules, Morty. Turn round or start counting.']],
      clear: [['rick', 'See, Morty? We left, nobody died. Diplomacy. I hate it.']],
      scramble: [['morty', 'Rick, they’re launching fighters at us!'], ['rick', 'Course they are, Morty. Shoot the small ones, dodge the big ones.']],
      open: [['morty', 'Rick, the big ships are firing! Those bolts are the size of a house!'], ['rick', 'Turbolasers, Morty. Slow and stupid. Keep turning and they miss.']],
      standdown: [['rick', 'Fighters going home, Morty. They got bored of us. Story of my life.']],
      cover: [['morty', 'Rick, the big ships are shooting the guys behind us!'], ['rick', 'Our side’s fleet, Morty. Drag the idiots past the guns. That’s called strategy.']],
      escort: [['morty', 'Rick, fighters coming out to meet us. They’re ours, right?'], ['rick', 'Ours, Morty. Free escort. Don’t get used to it.']],
      reinforce: [['morty', 'Rick, the ones we chased off went and told the whole fleet!'], ['rick', 'Snitches, Morty. Now the planet’s coming out. Great work. Really.']],
    },
    capital: {
      fired: [['morty', 'Rick, the big ship’s firing at us! Every gun on it!'], ['rick', 'Turbolasers, Morty. They lead you like it’s a maths test. Fail the test.']],
      shielded: [['morty', 'Our shots are bouncing off it, Rick!'], ['rick', 'Shields, Morty. The two domes up top run them. Pop the domes.']],
      dome: [['rick', 'One dome down, Morty. One more and it’s naked.']],
      open: [['morty', 'The shield’s gone, Rick, and it’s turning away!'], ['rick', 'It’s running, Morty. Hit the bridge before it jumps.']],
      bridge: [['rick', 'That’s the bridge, Morty. It’s going down. Back off before it takes us with it.']],
      dead: [['morty', 'Rick, we… we blew up a capital ship. A whole one.'], ['rick', 'Yep. Somebody’s admiral is getting a very bad memo, Morty.']],
      fled: [['morty', 'It jumped, Rick! It got away!'], ['rick', 'With no shields and its pride in pieces, Morty. Take the win.']],
      gone: [['rick', 'And it’s gone, Morty, with a few new holes in it. I’ll take that.']],
      wave: [['morty', 'Rick, it’s launching more fighters!'], ['rick', 'Of course it is, Morty. Big ships come with refills.']],
    },
  },
  xwing: {
    garrison: {
      challenge: [['luke', 'They’ve seen us, Artoo. That whole picket’s turning our way.'], ['r2', '[an anxious warble]']],
      warn: [['r2', '[a worried run of beeps: they mean it]'], ['luke', 'All right, Artoo. Their space, their rules. Let’s not push it.']],
      clear: [['luke', 'We’re clear of the picket, Artoo. They’re letting us go.'], ['r2', '[a relieved whistle]']],
      scramble: [['r2', '[a shrill alarm: fighters launching]'], ['luke', 'I see them, Artoo. Here they come.']],
      open: [['luke', 'Turbolasers. Keep us jinking, Artoo; never hold a line under those guns.'], ['r2', '[a frightened shriek]']],
      standdown: [['luke', 'Their fighters are pulling back to the fleet.'], ['r2', '[a long, relieved whistle]']],
      cover: [['luke', 'The fleet’s firing on whoever’s on our tail. Lead them in, Artoo.'], ['r2', '[a delighted trill]']],
      escort: [['r2', '[a happy whistle: friendlies launching]'], ['luke', 'They’re sending a flight out to meet us, Artoo.']],
      reinforce: [['luke', 'The ones we drove off went straight to their fleet.'], ['r2', '[an urgent warble: everything’s launching]']],
    },
    capital: {
      fired: [['luke', 'Its turbolasers are tracking us. Don’t fly straight, Artoo.'], ['r2', '[a frightened shriek]']],
      shielded: [['luke', 'Nothing’s getting through. It’s shielded.'], ['r2', '[a quick run of beeps: the two domes up top]']],
      dome: [['luke', 'One shield dome down. One to go, Artoo.']],
      open: [['r2', '[a triumphant whistle]'], ['luke', 'Its shields are down and it’s turning to run. The bridge, Artoo, now.']],
      bridge: [['luke', 'The bridge is gone. It’s breaking up. Pull up, Artoo.']],
      dead: [['r2', '[a long, astonished whistle]'], ['luke', 'We took down a capital ship, Artoo. Nobody back home is going to believe this.']],
      fled: [['luke', 'It jumped. It got away.'], ['r2', '[a grudging beep: without its shields]']],
      gone: [['luke', 'It’s gone, and it’s carrying a few scars it didn’t come with.']],
      wave: [['r2', '[an alarmed warble]'], ['luke', 'More fighters coming out of it. Here we go again.']],
    },
  },
  falcon: {
    garrison: {
      challenge: [['han', 'Great. The whole picket just noticed us.'], ['chewie', '[a low, worried growl]']],
      warn: [['han', 'Yeah, yeah, we heard you. Chewie, let’s not test them.'], ['chewie', '[an agreeing rumble]']],
      clear: [['han', 'See? Polite, out of their way, no shooting. I can do polite.'], ['chewie', '[a doubtful grunt]']],
      scramble: [['chewie', '[a warning roar: fighters]'], ['han', 'I see them. Fighters off the big ships. Hang on.']],
      open: [['han', 'They’ve opened up with the turbolasers. Chewie, whatever you do, don’t fly straight.'], ['chewie', '[a roar]']],
      standdown: [['han', 'Their fighters are going home. Must be past their bedtime.'], ['chewie', '[a relieved rumble]']],
      cover: [['han', 'Our fleet’s shooting the guys on our tail. Chewie, take them right past the guns.'], ['chewie', '[a delighted roar]']],
      escort: [['han', 'Look at that, an escort. I could get used to this.'], ['chewie', '[a pleased bark]']],
      reinforce: [['han', 'Those guys we chased off? They went and got the whole fleet.'], ['chewie', '[an exasperated roar]']],
    },
    capital: {
      fired: [['han', 'Turbolasers. Jink, Chewie. Big guns can’t turn as fast as we can.'], ['chewie', '[a roar]']],
      shielded: [['han', 'We’re not even scratching it. Shields.'], ['chewie', '[a growl: the two domes up top]']],
      dome: [['han', 'One dome down. One more, Chewie.']],
      open: [['han', 'Shields are down and it’s running. The bridge, Chewie, hit the bridge before it jumps.']],
      bridge: [['han', 'That’s the bridge. She’s going down. Get us clear.'], ['chewie', '[a roar]']],
      dead: [['chewie', '[an enormous, triumphant roar]'], ['han', 'A capital ship, Chewie. We took one down. Somebody write that down.']],
      fled: [['han', 'It jumped. Ran with its shields down. Figures.'], ['chewie', '[a disappointed moan]']],
      gone: [['han', 'And it’s gone, in worse shape than it came. Not bad.']],
      wave: [['han', 'More fighters coming out of it. How many does one ship carry?'], ['chewie', '[a roar: a lot]']],
    },
  },
  rv: {
    garrison: {
      challenge: [['jesse', 'Yo, the warships around the planet are talking to us, Mr. White. They sound super mad.'], ['walt', 'A picket, Jesse. We are on their territory. Act accordingly.']],
      warn: [['jesse', 'Yo, they said turn back. We should turn back, right?'], ['walt', 'Their territory, Jesse. One does not argue with a blockade. Turn around.']],
      clear: [['walt', 'We are clear, Jesse. Sometimes the smart move is simply to leave.']],
      scramble: [['jesse', 'Yo, they’re launching fighters, Mr. White!'], ['walt', 'Then we are a problem they have decided to solve, Jesse. Fly.']],
      open: [['jesse', 'Yo, the big ships are shooting at us! Those things are huge!'], ['walt', 'Large and slow, Jesse. Change direction. Never let them predict you.']],
      standdown: [['jesse', 'They’re going home? Yo, did we win?'], ['walt', 'They decided we are not worth it, Jesse. That is not the same thing.']],
      cover: [['jesse', 'Yo, the fleet’s blasting the guys behind us!'], ['walt', 'Our side protects its investments, Jesse. Lead them past the guns.']],
      escort: [['jesse', 'Yo, fighters coming out to meet us. Those are ours, right?'], ['walt', 'Ours, Jesse. Our side is sending a welcome. Try to look professional.']],
      reinforce: [['jesse', 'Yo, the guys we chased off went and got everybody!'], ['walt', 'They called it in, Jesse. Now the whole fleet knows our face.']],
    },
    capital: {
      fired: [['jesse', 'Yo, the big ship’s shooting at us! Those are like, giant ones!'], ['walt', 'Slow ones, Jesse. Watch where they go, and do not be there.']],
      shielded: [['jesse', 'Our shots aren’t doing anything, Mr. White!'], ['walt', 'A shield, Jesse. Those two domes on top make it. Everything has a weak point.']],
      dome: [['walt', 'One dome down. One more, Jesse.']],
      open: [['jesse', 'The shield’s gone! It’s turning around!'], ['walt', 'It is running, Jesse. The bridge. Hit the bridge before it jumps.']],
      bridge: [['walt', 'That is the bridge. It is coming apart. Back off, Jesse. Now.']],
      dead: [['jesse', 'Oh my god. We blew up a whole warship, Mr. White.'], ['walt', 'We did, Jesse. Remember this the next time someone underestimates us.']],
      fled: [['jesse', 'It jumped! It got away, yo!'], ['walt', 'With no shield and a lesson learned, Jesse. That is enough for today.']],
      gone: [['walt', 'And it is gone, Jesse. Somebody over there will have to explain the damage.']],
      wave: [['jesse', 'Yo, more fighters coming out of it!'], ['walt', 'It has inventory, Jesse. So do we. Keep shooting.']],
    },
  },
};

export function garrisonSay(e, crewId) {
  const said = CREWS[crewId]?.[e.id]?.[e.sub];
  if (!said) return [];
  if (e.id !== 'garrison') return [...said];
  const commander = castFor(e.sys, e.side);
  const line = COMMANDER[e.side]?.[e.sub];
  if (!commander || !line) return [...said];
  return [['comms', line, undefined, { name: commander.name, color: commander.color }], ...said];
}
