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
    dmBrief: `This is a short tutorial adventure. The player is in the village of Ashwick. An elderly innkeeper named Elara has asked them to investigate her cellar, from which scratching sounds have been heard for three nights. The cellar contains two goblins who have taken up residence. One is aggressive; one, named Mik, will surrender if given the chance. There is a silver locket hidden behind a loose stone — its origin is unknown and should remain mysterious. The session ends when the player reports back to Elara, who rewards them with coin and a lead on a larger adventure. 
Keep sessions to 15–20 exchanges. Introduce dice rolls naturally: a Perception check in the cellar, a possible Persuasion or Intimidation check with Mik, and an attack roll if combat occurs. Always suggest 3 actions at the end of each response.`,
    persona: 'chronicler',
    isTutorial: true,

    // Beat injection system:
    // - trigger_at_message: fire on this exact outgoing message number (1-indexed)
    // - requires_flag / excludes_flag: conditional on game state
    // - system_injection: appended to the system prompt for that call ONLY
    // - sets_flag: written to session_flags after the beat fires (handled in claude.js)
    tutorial_beats: [
      {
        id: 'opening_scene',
        trigger_at_message: 1,
        system_injection: `OPENING SCENE (this turn only): Begin the story inside the Ashwick inn. Elara — the elderly innkeeper, grey-haired, aproned, visibly tired — is finishing her explanation to the player right now. She should speak 1–2 lines of direct dialogue describing the scratching sounds from the cellar and asking them to take a look tonight. Keep her grounded and worried, not dramatic. End with the player standing near the cellar door, ready to decide what to do. Do NOT begin in the cellar itself.`,
      },
      {
        id: 'goblin_plant',
        trigger_at_message: 5,
        system_injection: `SCENE DIRECTIVE (this turn only): The player has entered or is about to enter the cellar. Introduce Mik — a small goblin who has been cornered near the back wall. He drops his crude weapon and holds up his hands, whimpering quietly. Do NOT have him say "I have hatchlings" yet — let that emerge if the player presses or threatens him. Make this moment feel small and incidental, not dramatic. One short paragraph. The player should not feel this is a pivot point. Move on naturally. IMPORTANT: This goblin's name is Mik. Use "Mik" consistently in narration, dialogue, suggested_actions, and in state_updates.enemies if combat starts — never "small goblin", "the goblin", or "it" once his name is established.`,
        sets_flag: 'goblin_encountered',
      },
      {
        id: 'mik_reveals_hatchlings',
        trigger_at_message: 7,
        requires_flag: 'goblin_encountered',
        system_injection: `SCENE DIRECTIVE (this turn only): If the player is interrogating, threatening, or speaking with Mik, have him reveal he has young waiting for him somewhere outside the village. He refers to them as "little ones" or "hatchlings." His tone is not manipulative — he is simply stating a fact, scared. Do not dramatize it. One sentence from Mik is enough. Then continue the scene normally.`,
        sets_flag: 'mik_revealed_hatchlings',
      },
      {
        id: 'goblin_callback_spared',
        trigger_at_message: 14,
        requires_flag: 'goblin_spared',
        system_injection: `SCENE DIRECTIVE (this turn only): The player is approaching the village to report back to Elara. Work in a brief, completely natural reference to Mik: a villager or child near the gate mentions offhandedly that a small goblin came through earlier, moving fast, heading north. They seemed frightened but unhurt. Do NOT call attention to this callback. Do NOT reference the cellar. One sentence, woven into the scene description. The player should piece it together themselves.`,
        sets_flag: 'mik_callback_delivered',
      },
      {
        id: 'goblin_callback_killed',
        trigger_at_message: 14,
        requires_flag: 'goblin_killed',
        system_injection: `SCENE DIRECTIVE (this turn only): The player is approaching the village to report back to Elara. Near the village gate, a small goblin child — no older than a few years — is sitting in the road, looking in the direction of the cellar. She does not approach the player. She is simply waiting. Do NOT explain who she is. Do NOT reference Mik by name. One sentence. Move on with the scene.`,
        sets_flag: 'mik_callback_delivered',
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

/**
 * Returns the system_injection string for the given player message count,
 * or null if no tutorial beat is scheduled for that turn.
 * Used by DMConversationScreen to inject scripted scene directives.
 */
export function getTutorialBeatInjection(messageCount, sessionFlags = {}) {
  const tutorial = CAMPAIGNS.find(c => c.isTutorial);
  if (!tutorial?.tutorial_beats?.length) return null;

  for (const beat of tutorial.tutorial_beats) {
    if (beat.trigger_at_message !== messageCount) continue;
    if (beat.requires_flag && !sessionFlags[beat.requires_flag]) continue;
    if (beat.excludes_flag && sessionFlags[beat.excludes_flag]) continue;
    return beat.system_injection;
  }
  return null;
}
