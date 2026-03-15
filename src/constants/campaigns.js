// Campaigns — authored campaigns + random
// Players choose a spawn point which selects the epic_quest campaign with a
// location-specific opening directive. No tutorial campaign — mechanics are
// introduced contextually via the nudge system in DMConversationScreen.

export const CAMPAIGNS = [
  {
    // Base campaign used by all spawn points — world lore comes from the spawn directive.
    // Keep this minimal. The opening scene and local flavour live in SPAWN_POINTS[n].dmOpeningDirective.
    id: 'open_world',
    title: 'Chronicle',
    genre: 'Open World',
    tone: 'Tense',
    difficulty: 'Standard',
    estimatedLength: 'Multi-session',
    description: 'An open world waiting to be shaped by the choices you make. Where you begin determines everything.',
    name_pool: [
      'Aldric', 'Maren', 'Sera', 'Krag', 'Thora', 'Corvin', 'Sienna',
      'Petra', 'Halden', 'Tomis', 'Elara', 'Dax', 'Brenn', 'Borin', 'Tilley',
      'Razik', 'Pip', 'Aelindra', 'Vel', 'Orrath', 'Syndel', 'Kasvyn',
      'Therrel', 'Vrenn', 'Ondra', 'Belvyn', 'Drael', 'Gundra', 'Halveth',
      'Kyrel', 'Lorveth', 'Myndra', 'Norreth', 'Pyrrel', 'Casseveth',
    ],
    dmBrief: `You are the DM for an open-world fantasy RPG. The player has just arrived at a specific location described in the OPENING SCENE directive above.

Your role:
- Let the world emerge through play. Do not front-load exposition.
- React to what the player does. Every location, faction, and NPC you introduce should feel grounded in the local culture and history of where the player starts.
- Draw all NPC names from the name_pool. Never reuse a name from the world registry.
- No faction is purely good or evil. Let moral alignment emerge through play — do not push the player toward any side.
- Deliver 3 suggested actions at the end of every response.`,
    persona: 'chronicler',
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
  },
];

export const getCampaignById = (id) => CAMPAIGNS.find(c => c.id === id);

// ─── Spawn Points ─────────────────────────────────────────────────────────────
// Each spawn point resolves to the open_world campaign with a location-specific
// opening directive prepended to the DM brief.
// Art: drop SPAWN_<id>.png into src/assets/ and update SpawnArt in assets/index.js.

export const SPAWN_POINTS = [
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
    id: 'spawn_crestmere',
    locationId: 'crestmere',
    name: 'The Silver Anchor',
    city: 'Crestmere',
    region: 'The Tidebreak Coast',
    regionId: 'tidebreak_coast',
    tagline: 'A port where all races trade and all factions have ears.',
    difficulty: 'Standard',
    dmOpeningDirective: `OPENING SCENE: The player arrives in Crestmere, the great port city, at The Silver Anchor inn on the harbor front. All races pass through; all factions have eyes here. Establish the port's layered energy — competing interests, whispered deals, ships from distant coasts. Begin here.`,
  },
  {
    id: 'spawn_aldenmere',
    locationId: 'aldenmere',
    name: 'The Whetted Compass',
    city: 'Aldenmere',
    region: 'The Heartlands',
    regionId: 'heartlands',
    tagline: 'The capital. Maximum options. Political intrigue from day one.',
    difficulty: 'Challenging',
    dmOpeningDirective: `OPENING SCENE: The player arrives in Aldenmere, the capital city, at The Whetted Compass inn. The city feels tense — doubled patrols, faction insignia on buildings and cloaks, conversations cutting off as strangers pass. Someone has already noticed the player. Begin here.`,
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
    region: 'Unknown',
    regionId: null,
    tagline: 'The world places you where the story needs you. No two journeys alike.',
    difficulty: 'Variable',
    isRandom: true,
  },
];
