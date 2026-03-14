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
    title: 'The Shattered Crown',
    genre: 'Epic Quest',
    tone: 'Heroic',
    difficulty: 'Standard',
    estimatedLength: '60–80 messages',
    description: 'A kingdom fractures as three claimants vie for a broken throne. The party is drawn into a conflict that will determine the fate of a generation. Ancient loyalties and fresh treacheries at every turn.',
    dmBrief: `A multi-act epic campaign. The kingdom of Valdenmere is in crisis — King Aldric died without naming an heir, and three factions now claim the Shattered Crown: the King's niece Sera (young, idealistic, popular with commoners), the High Marshal Vane (ruthless, pragmatic, backed by the military), and the Merchant Council (wealthy, corrupt, favored by the noble houses). The party begins as hired escorts for a courier carrying sealed documents whose contents are unknown. Act 1 ends when the documents are read and their significance understood. The party will be forced to pick a side by Act 2. There is a fourth player no one knows about yet.
Run this as a proper campaign with meaningful choices that carry forward. The faction the party ultimately supports should shape the ending. NPCs should remember previous interactions.`,
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
