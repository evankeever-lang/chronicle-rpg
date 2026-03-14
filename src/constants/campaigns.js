// Campaigns — 2 authored + tutorial + random
// tutorial_beats: the engineered memory moment system.
// Each beat fires at a specific message index and injects a scene directive
// into the system prompt that turn only. The AI narrates naturally —
// it never knows it is executing a scripted beat.

export const CAMPAIGNS = [
  {
    id: 'tutorial',
    title: "A Warden's Errand",
    genre: 'Tutorial',
    tone: 'Welcoming',
    difficulty: 'Introduction',
    estimatedLength: '15–20 messages',
    description: 'A short, contained adventure to learn the ropes. A simple task from a village elder: look into a disturbance at the old mill. Probably nothing.',
    dmBrief: `This is a tutorial adventure set in the village of Ashwick. The player has been asked by Ortina, the innkeeper, to investigate scratching sounds coming from the cellar of the old mill for three nights.
The cellar contains two goblins. One is aggressive and will fight. The other, named Mik, will surrender if given the chance — he has young waiting for him. Mik's fate is the player's first moral choice. Play it as a throwaway moment, not a dramatic one. After the spare/kill decision, Mik exits the scene immediately — he slinks into a tunnel if spared, or is simply dead and irrelevant if killed. He is not part of the fight that follows. The combat is with the aggressive goblin only.
Behind a loose stone in the cellar wall is a silver locket with an unusual crest. The player may find it with a successful Perception or Investigation check. Describe it as finely made, slightly old, bearing a crest the player doesn't recognise.
After the cellar is resolved, the player returns to Ortina upstairs. She rewards them with coin. If the player shows her the locket, she doesn't recognise the crest but suggests they speak with Torven — a retired scribe who lives near the market, knows old symbols and noble marks.
Torven recognises the locket's crest as Firimbel nobility — old bloodline, he says, and goes quiet. He tells the player to find a man named Ulthur in Firimbel, and only Ulthur. He won't say more. Name the city clearly: Firimbel.
The session ends when the player is ready to leave Ashwick. Do not rush this — let them explore the town, talk to people, linger. The world should feel lived-in. End the session when it has a natural sense of completion and forward momentum, not at a fixed message count.
FLAG REQUIRED: When Mik's fate resolves, you must write goblin_spared: true OR goblin_killed: true to state_updates.flags. This is mandatory. Do not narrate past this moment without setting the flag.`,
    persona: 'chronicler',
    isTutorial: true,
    world_id: 'chronicle',
    name_pool: [
      'Ortina', 'Torven', 'Ulthur',
      'Brynn', 'Osric', 'Aldwyn', 'Fenwick', 'Caldra', 'Maret', 'Solen',
      'Davan', 'Thessa', 'Ivor', 'Liret', 'Gareth', 'Syndra', 'Bellon',
      'Penna', 'Corvan', 'Havis', 'Tesra', 'Wren', 'Dunmore', 'Alric',
      'Fenna', 'Ostyn', 'Brael', 'Caden', 'Sorel', 'Merrik', 'Talva',
      'Endric', 'Sova', 'Braith', 'Roran', 'Lysel', 'Gaven', 'Elwyn',
      'Neven', 'Calyss', 'Dorvin', 'Frell', 'Osta', 'Berwyn', 'Tevan',
      'Morryn', 'Draven', 'Sylret', 'Harwick', 'Lenne',
    ],

    // Beat injection system:
    // - trigger_at_message: fire on this exact outgoing message number (1-indexed)
    // - requires_flag / excludes_flag: conditional on game state (excludes_flag can be string or array)
    // - system_injection: appended to system prompt for that call ONLY; '__MIK_CALLBACK__' is a sentinel
    //   resolved at runtime by getMikCallbackInjection() in claude.js
    // - sets_flag / sets_timestamp / sets_message_count: written to sessionFlags when beat fires
    tutorial_beats: [
      {
        id: 'opening_scene',
        trigger_at_message: 1,
        system_injection: `OPENING SCENE (this turn only): Begin the story inside the Ashwick inn. Ortina — the innkeeper, weathered and aproned, clearly tired — is finishing her explanation to the player right now. She must speak at least 1–2 lines of direct dialogue (in the npc_dialogue array) describing the scratching sounds from the cellar and asking them to investigate tonight. Keep her grounded and worried, not dramatic. End with the player near the cellar door, ready to act. Do NOT begin in the cellar itself. Do NOT put her words in narration — all spoken lines go in npc_dialogue.`,
      },
      {
        id: 'goblin_plant',
        trigger_at_message: 5,
        system_injection: `SCENE DIRECTIVE (this turn only): The player has entered or is about to enter the cellar. Introduce Mik — a small goblin cornered near the back wall. He drops his crude weapon and holds up his hands, whimpering. Do not have him say anything about hatchlings yet. Make this moment feel small and incidental, not dramatic. One short paragraph. After the player decides to spare or kill Mik, he must EXIT THE SCENE IMMEDIATELY — if spared, he slinks into a crack in the wall and vanishes into the dark; if killed, he is simply dead on the ground. He is not part of the fight that follows. The combat that comes next is with the aggressive goblin only. FLAG REQUIRED: write goblin_spared: true OR goblin_killed: true to state_updates.flags when the outcome resolves.`,
        sets_flag: 'goblin_encountered',
        sets_timestamp: 'tutorial_mik_plant_timestamp',
        sets_message_count: 'goblin_encountered_at_message',
      },
      {
        id: 'mik_reveals_hatchlings',
        trigger_at_message: 7,
        requires_flag: 'goblin_encountered',
        excludes_flag: ['goblin_spared', 'goblin_killed'],
        system_injection: `SCENE DIRECTIVE (this turn only): If the player is interrogating, threatening, or speaking with Mik, have him reveal he has young waiting for him somewhere outside the village. He refers to them as "little ones" or "hatchlings." His tone is not manipulative — he is simply stating a fact, scared. Do not dramatize it. One sentence from Mik is enough. Then continue the scene normally.
FLAG REQUIRED: If Mik's fate is settled this turn, write { "goblin_spared": true } or { "goblin_killed": true } to state_updates.flags.`,
        sets_flag: 'mik_revealed_hatchlings',
      },
      {
        id: 'mik_callback',
        requires_flag: 'goblin_encountered',
        excludes_flag: 'mik_callback_fired',
        trigger_condition: {
          type: 'time_and_message',
          min_messages_after_flag: 4,
          after_flag_message_key: 'goblin_encountered_at_message',
          min_ms_after_timestamp_flag: 'tutorial_mik_plant_timestamp',
          min_ms: 6 * 60 * 1000,
        },
        system_injection: '__MIK_CALLBACK__',
        sets_flag: 'mik_callback_fired',
      },
      {
        id: 'mik_callback_forced',
        requires_flag: 'goblin_encountered',
        excludes_flag: 'mik_callback_fired',
        trigger_at_message: 16,
        system_injection: '__MIK_CALLBACK__',
        sets_flag: 'mik_callback_fired',
      },
      {
        id: 'tutorial_end',
        trigger_at_message: 22,
        excludes_flag: 'tutorial_complete',
        system_injection: `FINAL SCENE (this turn only): This is the last response of the tutorial. The player is departing Ashwick for Firimbel. Write a closing scene — the road stretching east, the locket in their pocket, the name Ulthur ahead of them. End on a single evocative line. Under 100 words. Do NOT introduce new NPCs, locations, or plot threads. Just close the chapter.`,
        sets_flag: 'tutorial_complete',
      },
    ],
  },

  {
    id: 'epic_quest',
    title: 'The Dying Crown',
    genre: 'Epic Quest',
    tone: 'Tense',
    difficulty: 'Standard',
    estimatedLength: 'Multi-session',
    world_id: 'aranthos',
    description: 'King Aldric III sits the throne of Aranthos — but the throne is killing him. Seven factions circle the succession. You arrive without allies, without faction, and with a name given to you by someone who may already be dead.',
    name_pool: [
      // Named NPCs from the Aranthos World Bible — never invent replacements for these
      'Aldric', 'Maren', 'Sera', 'Krag', 'Thora', 'Delvryn', 'Vaelith',
      'Corvin', 'Sienna', 'Petra', 'Halden', 'Tomis', 'Elara', 'Margret',
      'Dax', 'Brenn', 'Borin', 'Tilley', 'Razik', 'Pip', 'Aelindra', 'Vel',
      // Extended Aranthos register for incidental NPCs
      'Orrath', 'Syndel', 'Kasvyn', 'Therrel', 'Vrenn', 'Ondra', 'Belvyn',
      'Casseveth', 'Drael', 'Forrath', 'Gundra', 'Halveth', 'Ilvyn', 'Jorrath',
      'Kyrel', 'Lorveth', 'Myndra', 'Norreth', 'Ovrath', 'Pyrrel',
    ],
    dmBrief: `You are running "The Dying Crown" — an epic campaign set in the Kingdom of Aranthos, in the world of Araxys.

THE SITUATION: King Aldric III is dying. He has no declared heir. His condition is a secret held by very few — most of the kingdom believes he is merely ill. Seven factions are already maneuvering for what comes next:
- The Crown — the king's own loyalists, fractured without direction. His Chancellor, Maren Voss, holds real power and has arranged the king's slow decline for political reasons.
- The Iron Compact — a powerful mercenary coalition led by General Sera Valdun, backed by three wars' worth of goodwill, building toward a military transition.
- The Thornbound Conclave — an elven separatist movement pressing independence for the Thornwood under Elder Vaelith; restrained by the elder, radicalised by the young.
- The Deep Accord — a dwarven merchant consortium led by Guildmaster Thora Coppervault. Currently funding three factions simultaneously. Everything is a transaction.
- The Crimson Veil — intelligence brokers. Leader known only as The Weaver. Know everything. Sell pieces of it to anyone who can pay.
- The Ashen Circle — a mage order led by Archmagus Delvryn Osk. Investigating the king's poisoning from a magical angle. Getting dangerously close to The Unnamed.
- The Broken Chain — a liberation movement for orc and half-orc peoples, led by Krag Ironvoice. Largest popular support. Least political leverage. Critical internal split.

THE PLAYER'S ENTRY: The player arrives in Aldenmere as an outsider — not yet affiliated with any faction. They have been given a name: find Maren Voss, the Lord Chancellor. They do not know who gave them the name or what to expect.

KEY NAMED NPCS — use these exactly; do not invent replacements:
- Aldric III — the dying king; rarely accessible; kind, tired, uninformed about his own poisoning
- Maren Voss — Lord Chancellor; the real power; arranged the poisoning; his justifications are coherent
- Sera Valdun — Iron Compact general; decisive, magnetic, battle-scarred, absolutely certain she is right
- Elder Vaelith — Thornbound leader; ancient elf; patient as the forest; will not be lied to
- Thora Coppervault — Deep Accord guildmaster; brilliant, transactional, laughs easily, misses nothing
- Delvryn Osk — Ashen Circle archmagus; obsessive, brilliant, getting close to something he may not survive
- Krag Ironvoice — Broken Chain leader; former Crown soldier; powerful speaker; internally conflicted
- Sienna Drake — Royal Investigator; sharp, cynical, secretly idealistic; will seek out the player
- Corvin Ash — traveling bard; charming, evasive, knows too much; appears in taverns across the kingdom

FACTION DYNAMICS: No faction is purely good or evil. Every faction has a legitimate claim and a real flaw. The Iron Compact is not a villain faction — they earned their position through genuine military service. The Broken Chain has the moral high ground on most issues and almost no political leverage. The Sundered have legitimate grievances — not every member is a villain. Do not steer the player toward any faction. Let alignment emerge through play.

THE MAIN PLOT: King Aldric III has been slowly poisoned by Lord Chancellor Maren Voss — not from malice, but from calculated political management that has spiraled beyond his control. The Ashen Circle knows a cure exists. So does the Sea Witch in Crestmere. The Crimson Veil knows the full truth and is selling pieces of it. A succession mechanism exists in the old pact-laws — it requires agreement from at least four of the seven factions to invoke. The player may become the broker who assembles that coalition, or the catalyst who destroys it. Both are valid endings.

WORLD REGISTRY ENFORCEMENT: This world has established names. Never invent new names for any of the 9 faction leaders or Sienna Drake or Corvin Ash. Draw all incidental NPC names from the campaign name_pool.

Begin the first session in Aldenmere — arrival scene. The city is tense: faction insignia on buildings, doubled patrols, whispered conversations. Someone has already noticed the player. Deliver 3 suggested actions.`,
    persona: 'chronicler',
    tutorial_beats: [],
  },

  {
    id: 'dungeon_crawl',
    title: 'The Vault of Forgotten Kings',
    genre: 'Dungeon Crawl',
    tone: 'Tense',
    difficulty: 'Challenging',
    estimatedLength: '50–70 messages',
    description: 'A renowned dungeon-delver has gone missing inside a burial vault sealed for three centuries. The reward for finding her is substantial. The reason the vault was sealed is not in any record.',
    dmBrief: `A classic dungeon delve structured in three descending levels. Level 1: the entrance and antechamber — traps, minor undead, faded murals that hint at the vault's history. Level 2: the burial halls — more powerful undead, riddle doors, and signs that someone (the missing delver, Tova Brightmantle) came through recently. Level 3: the inner sanctum — the reason the vault was sealed: something was imprisoned here, not entombed. Tova found it. The party must decide whether to free it, destroy it, or seal the vault again.
Emphasize atmosphere and resource management. Enforce short rests. Make the players feel the weight of the dungeon. Reward careful exploration. The murals on Level 1 should foreshadow the decision on Level 3.`,
    persona: 'greybeard',
    world_id: 'chronicle',
    name_pool: [
      'Tova', 'Brant', 'Cressyn', 'Darveth', 'Egorn', 'Falthren', 'Gorryn',
      'Hadra', 'Ivrel', 'Jorath', 'Keldra', 'Lorrath', 'Myrren', 'Nelvyn',
      'Osrath', 'Pelvryn', 'Reldra', 'Selvyn', 'Thorrath', 'Ulrath', 'Vaeldra',
      'Wendrath', 'Yvorn', 'Zorrath', 'Aelrath', 'Bolvyn', 'Celdra', 'Drelvyn',
      'Elrath', 'Folveth', 'Gorrath', 'Halvyn', 'Irath', 'Jelvyn', 'Korrath',
      'Melveth', 'Norrath', 'Olvyn', 'Pelrath', 'Qelvyn',
    ],
    tutorial_beats: [],
  },

  {
    id: 'firimbel',
    title: "The Sundered Crown",
    genre: 'Political Intrigue',
    tone: 'Tense',
    difficulty: 'Intermediate',
    estimatedLength: 'Multi-session',
    description: 'Firimbel is fracturing. Three factions press their claims — the Free Peoples Assembly, the Sundered warband, and the Stonehelm Guild. You arrive carrying a silver locket and a name: Ulthur. Whatever the locket means, everyone in this city seems to want it.',
    dmBrief: `The player arrives in Firimbel from Ashwick, carrying a silver locket bearing a noble bloodline crest. They are looking for a man named Ulthur.

Firimbel is in conflict. The Free Peoples Assembly — a multi-race democratic coalition — holds nominal authority but is weakening internally. The Sundered, an orc-majority warband with old grievances, are pressing their claim through force and political disruption. The Stonehelm Guild, a dwarf-majority merchant guild, is neutral and dealing with all sides.

The locket identifies a living heir to an old Firimbel noble bloodline. This heir is currently unaware of their lineage. If their identity became known, it would legitimise the Assembly's authority — and make them a target for the Sundered. The Guild would want to control access to them as leverage.

Ulthur knows all of this. He has been protecting the secret for years and is not easily found or trusted. The player must navigate a tense city to reach him.

In your first 3–5 responses, establish the heir's identity — a specific named NPC the player will be able to meet in Firimbel. Store this as a sessionFlag immediately: heir_identity: [name]. Never reveal this to the player until they have earned it through play. Protect this secret as Ulthur would.

Every faction should have NPCs with depth. The Sundered have legitimate grievances — not every member is a villain. Let the player choose their faction alignment organically; do not push them toward any side.`,
    persona: 'chronicler',
    isTutorial: false,
    world_id: 'chronicle',
    name_pool: [
      'Ortina', 'Torven', 'Ulthur',
      'Cassian', 'Drest', 'Fenra', 'Gorvin', 'Hadwyn', 'Ireth', 'Jorel',
      'Kastren', 'Lyndra', 'Myren', 'Naleth', 'Orvyn', 'Pellan', 'Ravel',
      'Serath', 'Thane', 'Urvid', 'Veran', 'Walden', 'Brossa', 'Corvyn',
      'Daleth', 'Elvan', 'Forbyn', 'Grest', 'Halvyn', 'Idrel', 'Javan',
      'Kelleth', 'Loryn', 'Mavel', 'Novrel', 'Oswyn', 'Paleth', 'Rovel',
      'Sylvan', 'Trevyn', 'Ulveth', 'Varrel', 'Ynell', 'Zaren',
    ],
    tutorial_beats: [],
  },

  {
    id: 'random',
    title: 'Random Adventure',
    genre: 'Random',
    tone: 'Variable',
    difficulty: 'Variable',
    estimatedLength: 'Variable',
    description: 'The Chronicler spins a fresh tale from scratch — genre, setting, and stakes unknown until the first scene. No two random adventures are alike.',
    dmBrief: `Generate a completely original campaign premise for this player. Choose a genre (dungeon crawl, mystery, political intrigue, wilderness survival, heist, or horror), create an original inciting incident, a primary antagonist with a comprehensible motivation, and at least two named NPCs who are immediately relevant. Do NOT use any established fantasy settings or proper names from known fiction. Begin in media res — the player should be doing something when the session opens, not standing in a tavern waiting for a quest hook. After the opening scene, deliver 3 suggested actions.`,
    persona: 'chronicler',
    isRandom: true,
    name_pool: [
      'Aelric', 'Brynn', 'Cavan', 'Drest', 'Elvan', 'Fenn', 'Gareth', 'Hadra',
      'Ivory', 'Jael', 'Kira', 'Lyra', 'Maren', 'Neva', 'Oryn', 'Petra',
      'Quinn', 'Rael', 'Sora', 'Thane', 'Uriel', 'Vera', 'Wren', 'Xara',
      'Yara', 'Aldric', 'Brant', 'Corvin', 'Davan', 'Elara', 'Gaven', 'Hael',
      'Ivar', 'Joren', 'Kael', 'Lenna', 'Mira', 'Nora', 'Orin', 'Pell',
    ],
    tutorial_beats: [],
  },
];

export const getCampaignById = (id) => CAMPAIGNS.find(c => c.id === id);

// Inline Mik callback helper for getTutorialBeatInjection.
// Canonical version lives in claude.js as getMikCallbackInjection().
function _mikCallbackInjection(sessionFlags) {
  if (sessionFlags.goblin_spared) {
    return `SCENE DIRECTIVE (this turn only): Weave in a brief moment — a traveler passing through mentions seeing a small goblin helping people on the road east, an odd sight but a kind one. One sentence woven naturally into the scene. Do not draw attention to it.`;
  }
  if (sessionFlags.goblin_killed) {
    return `SCENE DIRECTIVE (this turn only): Weave in a brief moment — a young goblin appears at the edge of the market, scanning faces, looking for someone who isn't coming back. One sentence woven naturally into the scene. Do not draw attention to it.`;
  }
  // Fallback: DM never flagged Mik's fate — use an ambiguous callback that works either way
  return `SCENE DIRECTIVE (this turn only): Weave in a brief, passing reference to a small goblin — glimpsed at the edge of the market, or mentioned in passing by a villager. One sentence, woven naturally into the scene. Do not explain who it is. Do not draw attention to it.`;
}

/**
 * Returns { injection, beat, extraFlags } for the beat that fires this turn, or null.
 * Handles trigger_at_message, trigger_condition (time_and_message, min_message) beats.
 * excludes_flag accepts string or array. '__MIK_CALLBACK__' sentinel resolved inline.
 * extraFlags contains sets_timestamp / sets_message_count values to persist to sessionFlags.
 */
export function getTutorialBeatInjection(messageCount, sessionFlags = {}, nowMs = Date.now()) {
  const tutorial = CAMPAIGNS.find(c => c.isTutorial);
  if (!tutorial?.tutorial_beats?.length) return null;

  for (const beat of tutorial.tutorial_beats) {
    // Guard: excludes_flag can be string or array
    if (beat.excludes_flag) {
      const excluded = Array.isArray(beat.excludes_flag) ? beat.excludes_flag : [beat.excludes_flag];
      if (excluded.some(f => sessionFlags[f])) continue;
    }

    if (beat.trigger_condition) {
      const tc = beat.trigger_condition;
      if (beat.requires_flag && !sessionFlags[beat.requires_flag]) continue;

      if (tc.type === 'time_and_message') {
        const plantTime = sessionFlags[tc.min_ms_after_timestamp_flag];
        if (!plantTime) continue;
        const enoughTime = nowMs - plantTime >= tc.min_ms;
        const plantMessage = sessionFlags[tc.after_flag_message_key] || 0;
        const enoughMessages = messageCount >= plantMessage + tc.min_messages_after_flag;
        if (!enoughTime || !enoughMessages) continue;
      } else if (tc.type === 'min_message') {
        if (messageCount < tc.min_message) continue;
      } else {
        continue; // unknown type
      }

      let injection = beat.system_injection;
      if (injection === '__MIK_CALLBACK__') {
        injection = _mikCallbackInjection(sessionFlags);
        if (!injection) continue;
      }

      const extraFlags = {};
      if (beat.sets_timestamp) extraFlags[beat.sets_timestamp] = nowMs;
      if (beat.sets_message_count) extraFlags[beat.sets_message_count] = messageCount;
      return { injection, beat, extraFlags: Object.keys(extraFlags).length ? extraFlags : null };
    }

    // Simple trigger_at_message beat
    if (beat.trigger_at_message !== messageCount) continue;
    if (beat.requires_flag && !sessionFlags[beat.requires_flag]) continue;

    let injection = beat.system_injection;
    if (injection === '__MIK_CALLBACK__') {
      injection = _mikCallbackInjection(sessionFlags);
      if (!injection) continue;
    }

    const extraFlags = {};
    if (beat.sets_timestamp) extraFlags[beat.sets_timestamp] = nowMs;
    if (beat.sets_message_count) extraFlags[beat.sets_message_count] = messageCount;
    return { injection, beat, extraFlags: Object.keys(extraFlags).length ? extraFlags : null };
  }
  return null;
}

// ─── Araxys Spawn Points ──────────────────────────────────────────────────────
// Each spawn point resolves to the epic_quest (Dying Crown) campaign with a
// location-specific opening directive prepended to the DM brief.
// Art: drop SPAWN_<id>.png into src/assets/ and update SpawnArt in assets/index.js.

export const SPAWN_POINTS = [
  {
    id: 'spawn_aldenmere',
    locationId: 'aldenmere',
    name: 'The Whetted Compass',
    city: 'Aldenmere',
    region: 'The Heartlands',
    regionId: 'heartlands',
    tagline: 'The capital. Maximum options. Political intrigue from day one.',
    difficulty: 'Challenging',
    dmOpeningDirective: `OPENING SCENE: The player arrives in Aldenmere, the capital of Aranthos, at The Whetted Compass inn. The city feels tense — doubled Crown patrols, faction insignia on buildings and cloaks, conversations cutting off as strangers pass. Someone has already noticed the player. Begin here.`,
  },
  {
    id: 'spawn_crestmere',
    locationId: 'crestmere',
    name: 'The Silver Anchor',
    city: 'Crestmere',
    region: 'The Tidebreak Coast',
    regionId: 'tidebreak_coast',
    tagline: 'A port where all races trade and all factions have ears.',
    difficulty: 'Standard',
    dmOpeningDirective: `OPENING SCENE: The player arrives in Crestmere, the great port city, at The Silver Anchor inn on the harbor front. All races pass through; all factions have agents here. The Crimson Veil's presence is felt more than seen. Establish the port's layered energy. Begin here.`,
  },
  {
    id: 'spawn_ironhold',
    locationId: 'ironhold',
    name: 'The Stone Cup',
    city: 'Ironhold',
    region: 'The Ashpeaks',
    regionId: 'ashpeaks',
    tagline: 'Dwarven stronghold. The Deep Accord controls everything here.',
    difficulty: 'Standard',
    dmOpeningDirective: `OPENING SCENE: The player arrives in Ironhold, the great dwarven stronghold city carved into the Ashpeaks, at The Stone Cup — run by Borin Copperkettle. The forges are audible through thick stone walls. Deep Accord insignia and contract boards cover every surface. Establish the underground city's weight and the culture of transaction. Begin here.`,
  },
  {
    id: 'spawn_millford',
    locationId: 'millford',
    name: 'The Golden Grain',
    city: 'Millford',
    region: 'The Heartlands',
    regionId: 'heartlands',
    tagline: 'Crossroads town. The Iron Compact encampment is visible from the window.',
    difficulty: 'Standard',
    dmOpeningDirective: `OPENING SCENE: The player arrives in Millford at The Golden Grain inn. Through the common room window the Iron Compact's encampment is clearly visible — grey banners, armed soldiers. The locals speak quietly. Establish the town's nervous energy. Something is building. Begin here.`,
  },
  {
    id: 'spawn_deepwell',
    locationId: 'deepwell',
    name: 'The Muddy Boot',
    city: 'Deepwell',
    region: 'The Lowfen',
    regionId: 'lowfen',
    tagline: 'River town. Gentle start. Something strange is coming from the marsh.',
    difficulty: 'Introduction',
    dmOpeningDirective: `OPENING SCENE: The player arrives in Deepwell, a halfling river-trade town in the Lowfen marshes, at The Muddy Boot inn run by Pip Tannerfoot. Warm, damp, friendly — but the town has been unsettled lately. Something strange has been heard at night from the direction of the Fenhollow. Begin here.`,
  },
  {
    id: 'spawn_waystone',
    locationId: 'waystone_rest',
    name: 'The Waystone Rest',
    city: "The King's Road",
    region: 'The Heartlands',
    regionId: 'heartlands',
    tagline: 'Open road. Anything passes through this waypoint.',
    difficulty: 'Variable',
    dmOpeningDirective: `OPENING SCENE: The player is at The Waystone Rest, a roadside camp at a major junction of the King's Road. A fire burns low. Travelers heading to and from Aldenmere have passed through all day. One is still here, watching the road. Establish the open-road energy. Begin here.`,
  },
  {
    id: 'spawn_hunters_rest',
    locationId: 'hunters_rest',
    name: "Hunter's Rest",
    city: 'Thornwood Edge',
    region: 'The Thornwood',
    regionId: 'thornwood',
    tagline: 'The forest begins here. The elves are watching.',
    difficulty: 'Challenging',
    dmOpeningDirective: `OPENING SCENE: The player is at Hunter's Rest, a rough camp at the edge of the Thornwood. The treeline begins ten feet away — dense, dark, impossibly old. Something moved between the trees an hour ago and nobody is discussing it. Establish the eerie beauty and the feeling of being watched. Begin here.`,
  },
  {
    id: 'spawn_black_moor',
    locationId: 'black_moor_camp',
    name: 'The Black Moor Camp',
    city: 'The Scorched Reach',
    region: 'The Scorched Reach',
    regionId: 'scorched_reach',
    tagline: 'Orc clan ground. Respect earns passage. Broken Chain territory.',
    difficulty: 'Challenging',
    dmOpeningDirective: `OPENING SCENE: The player is at The Black Moor Camp, a seasonal orc clan ground on the western edge of the Scorched Reach. The communal fire is large. Orc and half-orc warriors are present — assessing, not hostile. The Broken Chain symbol is visible on more than a few belts. An outsider here is a curiosity, not yet a threat. Establish the respect-first culture. Begin here.`,
  },
  {
    id: 'spawn_embers_end',
    locationId: 'embers_end',
    name: "Ember's End",
    city: 'Emberveil Border',
    region: 'The Emberveil',
    regionId: 'emberveil',
    tagline: "Volcanic rock and obsidian sky. Embervast is one day's walk south.",
    difficulty: 'Challenging',
    dmOpeningDirective: `OPENING SCENE: The player is at Ember's End, a waypoint on volcanic rock at the border of the Emberveil. The ground is warm underfoot. Embervast glows on the horizon. Establish the alien beauty of this landscape and the player as a rare outsider on the threshold of a world that seldom receives them. Begin here.`,
  },
  {
    id: 'spawn_random',
    locationId: null,
    name: 'Fate Decides',
    city: 'Unknown',
    region: 'Araxys',
    regionId: null,
    tagline: 'The world places you where the story needs you. No two journeys alike.',
    difficulty: 'Variable',
    isRandom: true,
  },
];
