# Chronicle RPG — Project Context for Claude Code

## What This Is
A DnD-inspired mobile RPG with an AI Dungeon Master. Built in React Native + Expo SDK 55, iOS-first. Two co-founders. Early prototype stage, moving fast with Claude Code.

## Tech Stack
- React Native + Expo SDK 55
- VS Code + Claude Code
- Navigation: `@react-navigation/stack`
- AI: Anthropic Claude API (Haiku 4.5 for DM responses, Sonnet 4.6 for session summaries)
- API key lives in: `src/utils/claude.js`

---

## Current Build State

### Phase 1 ✅ Complete
Core game loop is working end-to-end on iOS:
- **Main menu** → Campaign select → Character creation → DM conversation
- Live Claude API calls with prompt caching (90% cost reduction on system prompt)
- Structured DM responses: narration / NPC dialogue / system text each render differently
- Dice roller triggered only by DM skill checks (not manually accessible)
- Session summary + Chronicle Card (shareable) generated at session end
- 4 DM persona presets tied to campaign selection
- **Auto-save** after every DM response (1.5s debounce, expo-file-system)
- **Continue / New Game / Erase Save** on main menu

### Build Now 🔨 In Progress
Six workstreams to reach soft-launch readiness. Build in this order:
1. **Combat state machine** ✅ — refinement sprint complete (see Combat Refinement Sprint section below); next: conditions system
2. **World registry & name seeding** — data architecture, no UI, low risk
3. **Tutorial beat finalisation** — refine existing + wire to new combat system
4. **Music system** — self-contained once tone field exists in DM JSON
5. **Art foundation** — scene_tag field in DM JSON + image mapping
6. **Monetisation infrastructure** — RevenueCat + IAP last, once mechanics are stable

---

## Architecture Decisions

### AI Cost Strategy
- Use `claude-haiku-4-5-20251001` for all real-time DM responses
- Use `claude-sonnet-4-6` only for session summary / Chronicle Card generation
- Prompt caching on system prompt, persona, campaign context, character sheet — these 4 blocks marked `cache_control: ephemeral`
- World state (HP, inventory, conditions, quest flags, combat state) lives in structured JSON (GameContext), **never** in AI context window
- Rolling summary system: Phase 2 for regular campaigns; already exempt in tutorial (see below)

### Message Counting & Free Tier
- Count ONLY player-sent turns, not DM responses
- **Tutorial is exempt from the counter** — does not decrement the daily allowance
- Free tier = 40 player turns/day (post-tutorial open play)
- Warning fires at turn 32 (8 remaining)
- On final turn: inject closing instruction to DM, then auto-generate Chronicle Card
- Frame to users in playtime ("hours of adventure"), not raw message counts

### DM JSON Contract — Full Spec
Every DM response must be valid JSON. This is the complete contract including combat fields:

```json
{
  "narration": "Scene description, action results, atmosphere. Second person present tense. Max 120 words.",
  "npc_dialogue": [
    { "name": "NPC Name", "text": "Exact words they speak." }
  ],
  "system": null,
  "suggested_actions": ["Short action 1", "Short action 2", "Short action 3"],
  "tone": "exploration",
  "scene_tag": "dungeon_corridor",
  "combat_start": false,
  "combat_end": false,
  "enemy_action": null,
  "state_updates": {
    "flags": {},
    "npc_updates": [],
    "hp_change": null,
    "loot": null,
    "conditions_applied": [],
    "conditions_removed": []
  }
}
```

**Field rules:**
- `tone` — one of: `exploration`, `tension`, `combat_light`, `combat_heavy`, `boss`, `discovery`, `victory`, `somber`, `tavern`, `travel`. Drives music system.
- `scene_tag` — one of the predefined scene library keys (see Art section below). Drives ambient imagery.
- `combat_start: true` — triggers COMBAT_INIT state, client rolls initiative immediately
- `combat_end: true` — triggers COMBAT_RESOLUTION, client requests outro narration
- `enemy_action` — `{ name, attack_roll_hint, damage_hint }` — client overrides with actual dice; this is a narrative hint only
- `hp_change` — integer delta (negative = damage). Client applies to GameContext. AI never computes final HP values.
- `conditions_applied` / `conditions_removed` — arrays of condition strings (Poisoned, Frightened, Stunned, etc.)

### Combat State Machine
**THE AI IS A NARRATOR OF OUTCOMES, NOT A CALCULATOR.**
Only client-side code can modify HP, resolve dice, or apply conditions.

State machine lives in GameContext with its own reducer actions:

| State | Trigger | What happens |
|---|---|---|
| `EXPLORATION` | Default | AI handles narrative, NPCs, exploration. No combat tracking. |
| `COMBAT_INIT` | `combat_start: true` in DM JSON | Client rolls initiative for all parties. Turn order calculated and shown in HUD. |
| `COMBAT_STATE` | Initiative resolved | Turn order tracked in GameContext. All attack/damage/save rolls client-side. AI narrates once per round after all turns resolve. |
| `COMBAT_RESOLUTION` | `combat_end: true` | AI generates outro with full battle summary injected as context. |
| `DOWNED` | Player HP = 0 | Death save tracker activates. d20 client-side each turn. 3 successes = stabilise, 3 failures = death. Natural 20 = 1 HP. |

**What runs client-side vs. what goes to AI:**
- Initiative rolls → client computes, injects final turn order as structured field
- Attack rolls (d20 + prof + mod vs AC) → client computes, sends "Hit, 11 damage" to AI
- Damage rolls → client computes, sends new HP value to AI
- Death saves → client tracks successes/failures, AI notified of outcome only
- HP modification → GameContext only, never AI
- NPC turn log lines → programmatic template strings (see below), never AI
- Combat narrative / flavour → AI only, once per round

### Combat UX & Flow — Implementation Spec

**Initiative Ceremony (COMBAT_INIT)**
Do NOT show initiative as a chat message. The sequence is:
1. `combat_start: true` detected → HUD appears immediately (before any AI narrative)
2. Each combatant's d20 animates and lands sequentially (client-side, no API call)
3. Turn order locks into the HUD initiative chips with final scores visible
4. THEN the AI's combat-opening narration renders below the HUD
This is zero API cost and the highest-value trust/ceremony moment in the game.

**CombatHUD Persistence**
- HUD mounts at `COMBAT_INIT` and must NOT unmount until `COMBAT_RESOLUTION`
- The HUD is a persistent overlay/sticky header — it does not re-render or disappear between turns or when the message list updates
- Round counter, active turn indicator (glowing chip), and all HP bars must remain visible at all times during `COMBAT_STATE`

**Turn-Stepping Model**
Combat steps through turns one at a time. The player taps to advance NPC turns. No API calls occur mid-round.

```
Round N begins
  → NPC turn: programmatic log line renders, "Tap to continue" prompt
  → Player turn: Combat Action Panel appears (replaces text input entirely)
  → [repeat for all combatants]
Round N ends
  → All turns resolved → 1 AI call for round narration
  → Round counter increments, next round begins
Combat ends (all enemies at 0 HP or player flees)
  → 1 AI call for combat outro with full battle summary injected
```

**Combat Action Panel (replaces freeform text input during COMBAT_STATE)**
The `"Describe your attack or action..."` text input must be hidden during `COMBAT_STATE`. Replace with a structured action panel:

Primary actions row (always visible):
- ⚔️ **Attack** → expands to weapon list with dice notation (e.g. "Short Sword d6+DEX")
- 🏃 **Dash** → doubles movement, no attack
- 🛡️ **Dodge** → attackers have disadvantage until next turn
- 🙋 **Help** → give ally advantage on next roll

Secondary row:
- 🧪 **Use Item** → opens inventory (potions, consumables)
- 📜 **Spells** → opens spell list if class has spells (grayed out if none / slots spent)
- 💬 **Taunt / RP** → one free RP line, does not consume action
- 🚪 **Disengage / Flee** → triggers flee prompt, may end combat

If the player needs to do something not on the panel, a "Custom Action" button triggers a single targeted AI call — this is the fallback, not the default.

**Programmatic NPC Turn Log Templates**
These render instantly with no API call. Use for all NPC/ally turns:

```js
// Hit
`${attacker} strikes ${target} for ${damage} damage. [${target} HP: ${newHP}/${maxHP}]`

// Miss
`${attacker} swings at ${target} but misses. (Roll: ${roll} vs AC ${targetAC})`

// Critical hit
`${attacker} lands a CRITICAL HIT on ${target} for ${damage} damage!`

// Downed
`${target} falls, dropping to 0 HP.`

// Death save (player)
`Death save — roll ${roll}. ${result}. (${successes} successes / ${failures} failures)`
```

**Combat API Call Budget**
| Moment | Source | API Call? |
|---|---|---|
| Initiative rolls | Client dice | ❌ No |
| NPC attack + damage | Client dice + templates | ❌ No |
| Player action resolution | Client dice + math | ❌ No |
| HP modification | GameContext only | ❌ No |
| End-of-round narration | AI (1 per round) | ✅ Yes |
| Combat outro / resolution | AI (1 per encounter) | ✅ Yes |
| Custom player action (fallback) | AI (targeted) | ✅ Yes (rare) |

Target: a 3-round combat encounter costs 3–4 AI calls total, not 3–4 per round.

---

### Combat Refinement Sprint — Status

#### ✅ Completed (2026-03-09)

**Bugs fixed:**
1. **Combat not ending on flee/surrender** — DM prompt rewritten with explicit bullet list of all exit conditions. `checkCombatEnd()` now emits `⚔️ COMBAT ENDED — {Victory / Combat Ended / You Fled}` system message BEFORE the AI narration call. `claude.js` `### Ending combat` section strengthened.
2. **CombatHUD disappears after first player action** — Root cause: `COMBAT_RESOLUTION` was excluded from the visibility check. Fixed: `visible = combatState !== 'EXPLORATION'`. HUD now persists through the entire encounter including the outro narration.

**Dice roller improvements:**
3. **Context labels** — `DiceRoller` now accepts `rollContext` prop (string) and `requiredSides` prop (int). Labels derived in `DMConversationScreen` from `pendingCombatRoll.type`: "Roll for Initiative" / "Attack Roll" / "Damage Roll — {enemy name}". Skill check header unchanged.
4. **Advantage/Disadvantage hidden by default** — Added `hasAdvantage` / `hasDisadvantage` props (both default `false`). Row is hidden unless a condition grants one. Auto-derived from player's conditions in `combatTurnOrder` + `character.conditions`.
5. **Two-phase attack roll** — Attack flow split: `handleAttackPhase1` (d20 vs AC → hit/miss/crit) then `handleAttackPhase2` (weapon damage die → apply). On miss: roller closes, turn advances. On hit: roller transitions to damage context (stays open, resets state). Critical hit doubles the die result. Both phases show separate log messages.

**Implementation notes:**
- `pendingCombatRoll` type now: `'initiative' | 'attack' | 'damage'`
- `handleRollComplete` manages `setDiceVisible` per-branch (not unconditionally at top) to support the two-phase flow
- `DiceRoller` resets on `[visible, rollContext]` to handle the attack → damage context transition
- `checkCombatEnd(enemies, force, outcome)` — `outcome` param overrides auto-label; Flee passes `'You Fled'`

#### 🔜 Next: Conditions System (launch-critical)

**Must have at soft launch:**

| Feature | What it does | Implementation note |
|---|---|---|
| Conditions: Poisoned | Disadvantage on attack rolls and ability checks | Write to `combatTurnOrder[n].conditions[]`; auto-derive `hasDisadvantage` prop |
| Conditions: Frightened | Disadvantage on attacks while source is visible | Same |
| Conditions: Stunned | Can't act; attackers have advantage | Skip turn in `resolveEnemyTurn`; pass `hasAdvantage` to attacker |
| Conditions: Prone | Disadvantage on attacks; melee attackers have advantage, ranged have disadvantage | Same pattern |
| Conditions apply/remove | DM JSON `conditions_applied` / `conditions_removed` → `applyStateUpdates` → `combatTurnOrder` | Wire `applyStateUpdates` to update combatTurnOrder conditions, not just `character.conditions` |

HUD already renders condition chips per combatant — just needs the data to flow in.

**Strong candidates for launch (add if time allows):**

| Feature | What it does | Notes |
|---|---|---|
| Bonus action slot | Separate from main action; Rogues, some spells use it | Second action button in Combat Action Panel |
| Opportunity attack | When enemy leaves melee range, trigger a reaction attack | Simplified: prompt player "Opportunity Attack?" when enemy flees |
| Concentration | Only one concentration spell active; taking damage = CON save DC10 | Track `concentration` boolean on player state |

**Phase 2 (post-launch):**
Full conditions list (Blinded, Charmed, Deafened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Restrained, Silenced), area-of-effect spells, multi-attack (Fighter level 5+), legendary actions, environmental hazards, Inspiration.

#### 📐 Soft-Launch Readiness Bar for Combat
Combat is launch-ready when:
- [x] State machine transitions are airtight — no broken states, no stuck transitions
- [x] `combat_end: true` fires on all exit conditions (kill, flee, surrender)
- [x] Dedicated "COMBAT ENDED" system message renders before any AI narration
- [x] CombatHUD persists for the entire combat encounter without disappearing
- [x] Two-roll attack flow (attack → damage) works with correct math
- [x] Critical hits double damage dice and trigger distinct feedback
- [x] Dice roller shows context labels and hides advantage/disadvantage unless triggered
- [x] Combat Action Panel replaces freeform text input during `COMBAT_STATE`
- [x] Player can flee combat cleanly
- [ ] Basic conditions (Poisoned, Frightened, Stunned, Prone) apply/remove correctly and show in HUD

---

### Pacing & Message Heartbeat Model
**Rule: One API call per narrative beat. Not per player interaction.**

The five levers that reduce API calls without reducing experience:

1. **Multi-round combat batching** — full encounter resolves client-side. 1–2 AI calls per encounter (start narration + outcome), not per round. 66% fewer calls in combat sessions.
2. **Local examine system** — objects and exits from the last DM message become tappable locally. No API call. Only new narrative locations or meaningful discoveries trigger a message.
3. **Skill check two-beat** — client resolves d20 + modifier + pass/fail with animation first. Brief AI call delivers narrative consequence only (not the setup).
4. **NPC dialogue tree caching** — on first encounter, AI generates 3–4 option dialogue tree and NPC personality object. Cached. Subsequent visits = 0 API calls for standard topics.
5. **Exploration pacing** — non-combat travel between known locations uses local fast-travel with cached ambient text. AI reserved for: new locations, story beats, combat initiation, major decisions.

### Tutorial — Beat Design & Scope
Tutorial is scoped by **narrative beats**, not message count. Target: 20–25 minutes of play. No message cap. Tutorial does not decrement the free tier counter.

The 7 required beats:
| Beat | Name | API Calls | Notes |
|---|---|---|---|
| 1 | World Drop | 1 | DM voice established in 3 sentences. No mechanics. |
| 2 | First Choice | 1–2 | Low-stakes binary. Establishes agency before mechanics. |
| 3 | Skill Check intro | 2 | DM triggers. Tooltip fires once on first d20 only. |
| 4 | **Mik Plant** ✅ | 1 | Message ~3–5. Spare or kill. Deliberately throwaway framing. |
| 5 | Combat encounter | 1–2 | Full new state machine. Should feel satisfying, not punishing. |
| 6 | **Mik Callback** ✅ | 1 | Via sessionFlag injection. Min 15 mins after plant. The viral moment. |
| 7 | Chronicle Card | 1 (Sonnet) | Auto-generated at arc end. Epithet reflects Mik choice. Share prompt fires. |

**Mik mechanic:** Plant at beat 4, callback at beat ~12–14. `sessionFlags.tutorial_mik_fate` drives the DM injection — this is **not** reliant on context window memory. Callback is always reliable regardless of summarisation state. Spare path: grateful goblin spotted helping travelers. Kill path: young goblin looking for her father. Chronicle Card epithet should reflect the choice where possible ("The Merciful" / "The Relentless").

### Rolling Summary — Context Window Management
Two history tiers maintained at all times:

| Tier | What it is | Rules |
|---|---|---|
| **Raw recency window** | Last 8–10 full exchanges | Always sent verbatim. Never summarised. Preserves DM tone and conversational momentum. |
| **Rolling summary** | Everything older | ~200-token narrative digest. Factual compression only. |
| **sessionFlags** | Consequential choices | Permanent. Never summarised. Always injected. Zero context cost. |
| **worldRegistry** | All proper nouns used | Compact JSON. Injected as ~50-token field each call. |

Summarisation triggers:
- Standard campaigns: first roll at message 15, then every 15 messages
- Tutorial: first roll at message 25 (tutorial must feel coherent start-to-finish)
- Context ceiling: ~4,000 tokens of history max, regardless of campaign age
- Summary model: Haiku 4.5. Target length: 180–220 tokens.

### World Registry & Name Prevention
A `worldRegistry` object in GameContext, injected as a compact structured field on every API call.

```json
{
  "used_npc_names": ["Elara", "Marcus"],
  "used_location_names": ["Thornwood", "The Broken Axe Inn"],
  "used_quest_names": ["A Warden's Errand"],
  "used_item_names": []
}
```

**DM system prompt must include:** *"Never reuse any name from worldRegistry.used_npc_names. Draw NPC names from the campaign name_pool instead."*

On campaign creation, inject a `name_pool` of 40–60 culturally appropriate names for the campaign's setting. The AI draws from this pool, not statistical priors. This prevents the "Elara problem" (every AI model defaults to the same high-frequency fantasy names from training data — Chronicle's first generated NPC was named Elara unprompted).

### DM Personas
4 archetypes in `src/constants/personas.js`:
- **The Chronicler** (default) — epic, neutral
- **The Trickster** — witty, subversive
- **The Greybeard** — warm, lore-heavy
- **The Shadowweaver** — tense, atmospheric

Each is a tone paragraph prepended to the base system prompt. Tutorial is locked to Chronicler. Persona selection shown after campaign pick (modal sheet).

### Music System
Driven by the `tone` field in DM JSON. Client reads the field and transitions audio state. No ML inference — pure state machine.

**Stem architecture (16 files → 256+ combinations):**
- 4 environments: dungeon/underground, wilderness/travel, settlement/tavern, planar/mystical
- 4 stem layers per environment: ambient (always on), rhythmic (exploration+), melodic (story peaks), intensity (combat only)
- 3 one-shot stings: combat start, critical hit, downed/death
- Transitions: 3–4 second crossfade between states. Never hard cut.
- Storage: compressed OGG bundled in app. ~50–80MB. Zero marginal cost. Works offline.

**Tone → state mapping:**
- `exploration` → ambient + rhythmic
- `tension` → ambient + rhythmic + intensity (low)
- `combat_light` / `combat_heavy` / `boss` → all layers, escalating intensity
- `discovery` → ambient + melodic
- `victory` → short victory sting, then ambient
- `somber` → ambient only, slow
- `tavern` → distinct tavern loop
- `travel` → light ambient + rhythmic

### Art & Content Strategy
All visual content is AI-generated. The style guide (one master prompt: dark candlelit fantasy, gritty realism, mobile-optimised framing) is applied as prefix to all generation. Consistency is the output.

Three tiers:
1. **Bundled static** (zero marginal cost): UI, campaign card art, character portrait matrix (6 races × 6 classes × 2 genders = ~200 variants after skin/hair variation). Generated once, bundled.
2. **Scene library CDN** (one-time ~$3–10): 150–200 archetypal environments. DM JSON `scene_tag` maps to this library. Covers ~90% of scenes.
3. **On-demand high-impact** (~$0.05/image via Flux Pro API): Boss reveals, campaign finales, Chronicle Card portraits. 3–5 per campaign max.

`scene_tag` values (predefined): `dungeon_corridor`, `torch_chamber`, `forest_clearing`, `tavern_interior`, `mountain_pass`, `coastal_cliff`, `underground_lake`, `throne_room`, `city_street`, `ruins`, `cave_entrance`, `forest_night`, `plains_dawn`, `desert_ruins`, `arcane_library`

### Text-to-Speech Policy
- **Free + Adventurer tiers:** No TTS.
- **Champion tier only:** 4 DM voices (one per persona). OpenAI TTS-1 provider. Pre-generated for static/tutorial content. Live for dynamic DM responses.
- Cost: ~$0.023/message. Budget assumes 30% Champion adoption, 50% of messages with TTS enabled → ~$0.40–0.52/Champion subscriber/month.
- Do not implement TTS before Champion subscriber base exists.

---

## Game State (GameContext)

Key state fields beyond character:

```js
{
  // Story
  sessionFlags: {},         // discrete story events — never summarised, always injected
  npcMemory: [],            // known NPCs with name, race, status, disposition, lastSeen, notes
  worldRegistry: {          // all proper nouns used — injected to prevent repetition
    used_npc_names: [],
    used_location_names: [],
    used_quest_names: [],
    used_item_names: [],
  },
  rollingSummary: null,     // compact narrative digest replacing old conversation history
  messageCount: 0,          // player turns only

  // Combat
  combatState: 'EXPLORATION', // EXPLORATION | COMBAT_INIT | COMBAT_STATE | COMBAT_RESOLUTION | DOWNED
  combatTurnOrder: [],      // [{ name, initiative, isPlayer, hp, maxHp, ac, conditions }]
  combatRound: 0,
  activeEnemies: [],        // [{ name, hp, maxHp, ac, conditions }]
  deathSaves: { successes: 0, failures: 0 },

  // Audio
  currentTone: 'exploration',

  // Monetisation
  dailyTurnsUsed: 0,
  isTutorial: false,        // tutorial exempt from counter
}
```

**Critical:** `messages`, `sessionFlags`, `npcMemory` must have `= []` / `= {}` defaults in context destructure to prevent undefined spread crash on first render.

---

## File Structure

```
chronicle-rpg/
├── App.js                          ← Navigation root, GameProvider wrapper
├── app.json                        ← Expo config, SDK 55
├── CLAUDE.md                       ← This file
├── setup.md                        ← Local environment setup guide
└── src/
    ├── constants/
    │   ├── theme.js                ← Colors, spacing, shadows (dark medieval palette)
    │   ├── races.js                ← 6 races with stat bonuses and traits
    │   ├── classes.js              ← 6 classes with full DnD 5e mechanics
    │   ├── campaigns.js            ← Campaign definitions + tutorial beat scripts + name_pool per campaign
    │   └── personas.js             ← 4 DM persona presets with system prompt tone
    ├── context/
    │   └── GameContext.js          ← Full game state, reducer, action creators
    │                                  Combat actions: START_COMBAT, ADVANCE_TURN, APPLY_DAMAGE, END_COMBAT
    │                                  World actions: UPDATE_WORLD_REGISTRY, SET_ROLLING_SUMMARY
    ├── utils/
    │   ├── dice.js                 ← All DnD 5e math (point buy, modifiers, checks, combat resolution)
    │   ├── claude.js               ← All API calls (DM, summary, Chronicle Card)
    │   ├── combat.js               ← Combat state machine logic (NEW — Build Now)
    │   ├── music.js                ← Tone → audio state mapping + crossfade logic (NEW — Build Now)
    │   └── storage.js              ← Save/load via expo-file-system (autosave.json in documentDirectory)
    ├── components/
    │   ├── DMMessage.js            ← Renders narration/NPC/system text with accent bars
    │   ├── DiceRoller.js           ← Pseudo-3D die, forced roll, peek mode
    │   ├── ChronicleCard.js        ← Shareable session summary card
    │   ├── CombatHUD.js            ← Turn order, enemy HP bars, conditions (NEW — Build Now)
    │   └── ExamineOverlay.js       ← Local tappable objects from last DM message (NEW — Build Now)
    └── screens/
        ├── MainMenuScreen.js           ← Title screen; Continue/New Game/Erase Save; shows save card
        ├── CampaignSelectScreen.js     ← Campaign grid + persona selector modal
        ├── CharacterCreationScreen.js  ← 4-step wizard (Race → Class → Stats → Name)
        └── DMConversationScreen.js     ← Main game screen
```

---

## Known Issues Fixed
- `@react-navigation/stack` must be explicitly installed (`npm install @react-navigation/stack`)
- Strings containing apostrophes must use double quotes as wrapper in JS
- `messages`, `sessionFlags`, `npcMemory` must have `= []` / `= {}` defaults in context destructure to prevent undefined spread crash on first render
- `getHpColor` should be inlined in DMConversationScreen rather than imported from dice.js
- Combat not ending on flee/surrender — DM prompt strengthened + `⚔️ COMBAT ENDED` banner added before AI narration
- CombatHUD disappears after first action — fixed: `visible = combatState !== 'EXPLORATION'` (was excluding COMBAT_RESOLUTION)
- Dice roller shows no context label — added `rollContext` prop; combat rolls now show "Roll for Initiative" / "Attack Roll" / "Damage Roll"
- Advantage/Disadvantage always visible — hidden by default; `hasAdvantage`/`hasDisadvantage` props derived from active conditions
- Attack resolution single-roll — replaced with two-phase flow: attack d20 → damage die (separate roller, sequential)

## Known Issues Active
- **Conditions not wired to combatTurnOrder** — DM JSON `conditions_applied`/`conditions_removed` only updates `character.conditions`, not combatants in turn order; `hasAdvantage`/`hasDisadvantage` auto-derive won't fire for combat conditions until this is wired
- **Dead combatants still taking turns** — When an enemy or ally reaches 0 HP mid-round, the turn loop still processes their turn. Fix: in `resolveEnemyTurn` and turn-advance logic, skip any combatant with `hp <= 0`. Mark them visually as defeated in the HUD (greyed out / struck-through name) but leave them in the turn order array for display continuity.
- **"COMBAT ENDED" banner only appears in History, not main chat** — The system message is being added to the adventure log but not rendered in the main `DMConversationScreen` message feed. Fix: ensure `checkCombatEnd()` pushes the system message into the same `messages` array that `DMMessage` renders from, not a separate history log. It must appear inline in the main chat before the AI outro narration renders.
- **DiceRoller layout: "Read prompt" button overlaps roll context title** — The "Read prompt ↓" button is covering the "Perception Check" / roll context label. Fix: remove absolute positioning from the button; stack the modal content vertically — title → DC/modifier badges → "Read prompt" button → die graphic — with no overlap. The die and Roll button must remain below all header content.

---

---

## Combat Visual Design — Future State

### Design Problem
The current combat experience is almost entirely text-based in a chat feed. Players who've played BG3, Pokémon, Final Fantasy, or Slay the Spire expect to read the entire battle state (who's alive, how hurt they are, whose turn it is, what they can do) at a glance — without reading any text. That's the target.

### Reference Inspirations (adapted for mobile narrative RPG)

| Game | What to steal | What to skip |
|---|---|---|
| **Pokémon** | Enemy sprite on top, player info on bottom, single HP bar per combatant, clean turn handoff | Static sprites; Chronicle should have animated states |
| **Slay the Spire** | Enemy intent displayed above them ("will attack for 8"), HP numbers always visible, dead enemies visually removed | Card hand (Chronicle uses action panel instead) |
| **BG3** | Turn order strip at top with portrait chips, action bar at bottom, condition icons on unit frames | Overhead tactical map (mobile text RPG doesn't need positioning) |
| **Final Fantasy (mobile)** | Clear party/enemy zones, animated attack sequences, distinct visual feedback per action type | ATB bar (turn-based is cleaner for mobile) |

### Target Combat Screen Layout

The current approach embeds combat entirely in the chat feed. The improved model uses a **dedicated combat layout mode** that activates during `COMBAT_STATE` and returns to normal chat on `COMBAT_RESOLUTION`.

```
┌─────────────────────────────────────────┐
│  [ROUND 2]  Mik ▶ Goblin ▶ You         │  ← Initiative strip (sticky top)
│  [Mik chip, active glow] [Goblin] [You] │    Active combatant chip highlighted
├─────────────────────────────────────────┤
│                                         │
│   👹 AGGRESSIVE GOBLIN    👺 MIK        │  ← Enemy zone (top half)
│   ████████░░  7/7 HP      ███  5/5 HP  │    HP bars + names
│   AC 15                   AC 13         │    Condition badges below if active
│                                         │
│   [ ⚡ Mik attacks you for 4 dmg ]      │  ← Combat log strip (2–3 lines max)
│   [ You strike goblin — CRITICAL! ]     │    Scrollable but auto-collapses
│                                         │
├─────────────────────────────────────────┤
│  ⚔️ ATTACK   🛡️ DODGE   🏃 DASH  ...  │  ← Action panel (your turn only)
│                                         │    Grayed out / hidden on NPC turns
│  [         Tap to continue →         ]  │  ← NPC turn advance (replaces action panel)
└─────────────────────────────────────────┘
```

### Enemy Visual Treatment

**Phase 1 (text + shape, no art dependency):**
- Each enemy gets a distinct coloured silhouette shape (circle, angular, tall/thin) based on enemy type — pure CSS/RN shapes, no image assets needed
- Colour signals threat level: green/neutral → orange/wounded → red/critical
- Shape animates on attack (brief shake), on hit (flash), on death (fade + collapse)

**Phase 2 (with art assets):**
- Bundled enemy silhouette sprites (dark fantasy style, same art direction as scene library)
- One sprite per enemy archetype (Goblin, Bandit, Wolf, Skeleton, etc.) — ~20 images covers most encounters
- Sprites have 3 states: idle (subtle breathe loop), hit (flash + recoil), defeated (collapse + grey)
- Enemy intent icon above sprite: ⚔️ (will attack), 🛡️ (will defend), 💀 (enraged / special)

### Condition Badges
Active conditions render as small icon badges on each combatant frame in the HUD — not as text:
- 🟣 Poisoned, 😨 Frightened, ⚡ Stunned, 💤 Prone, 🔥 Burning, ❄️ Frozen
- Tap badge to see tooltip with condition name + effect summary
- Badges appear/disappear as conditions apply/remove

### Combat Log Strip
Replace the full chat-feed-during-combat with a compact 2–3 line log strip:
- Shows the last 2–3 programmatic combat lines (attack rolls, damage, status)
- Auto-collapses to 1 line when it's the player's turn (don't obscure the action panel)
- Expands to show last 5–6 lines via tap
- AI round narration appears as a distinct "DM says" block below the strip, not mixed with mechanical log lines
- Full log available via "History" tap (already implemented)

### Action Panel Visual Polish
When it's the player's turn:
- Panel slides up from bottom with a subtle spring animation
- Active weapon shown in Attack button ("⚔️ Short Sword — d6+2")
- Unavailable actions are visibly greyed (no spell slots, already used bonus action)
- Brief tap feedback on each button before resolving

### Implementation Priority
1. **Now (no art assets needed):** Layout restructure — enemy zone, combat log strip, action panel position. Use coloured placeholder shapes for enemies.
2. **Before launch:** Condition badges on HUD frames. Action panel polish.
3. **Post-launch with art assets:** Enemy sprites with idle/hit/death animation states. Enemy intent icons.

---

## Phase Roadmap

- **Phase 1** ✅ — Main menu + save system, campaign select, character creation, DM conversation, dice, Chronicle Card
- **Build Now** 🔨 — Combat state machine, tutorial beats, music system, world registry, art foundation, monetisation infra
- **Phase 2** — Character sheet overlay, inventory UI, leveling (1–10), spell slots + conditions, rolling summary, DM's Dispatch, suggested action chips, streaming text, world map (simplified), TTS (Champion only), party companion (solo mode), iPad layout
- **Phase 3** — Multiplayer (2–4 players online), social features, community events, leaderboards, full world map, Android launch, Apple Watch companion

---

## Legal
- DnD mechanics are not copyrightable — safe to use
- Avoid: Mind Flayer, Beholder, Tiefling (WotC-coined names), Forgotten Realms, spell names like "Bigby's Hand"
- Safe: d20 system mechanics, Fighter/Wizard/Rogue/Cleric/Ranger/Paladin archetypes, Elf/Dwarf/Halfling names
- Market as "tabletop RPG tradition" or "classic pen-and-paper adventures", not "D&D"

---

## Competitive Context
- **Primary competitor:** Everweave (iOS, ~340K downloads, 3.7★). Solo developer. Critical failures we are solving: walls of text, broken dice math, toxic message cap monetisation, no party context, no shareable output.
- **Biggest strategic threat:** AI Dungeon "Heroes" update — structured RPG mechanics being added to 3M+ download base. Monitor their dev logs weekly. Launch before Heroes ships.
- **Our differentiators:** Structured narration blocks, visible game-state HUD, deterministic client-side dice, fair unlimited paid tier, Chronicle Card social loop, adaptive music (first in category), Claude narrative quality.
- **Naming:** "AI" in product names is a liability for premium brands. "Chronicle" is correct. Use "AI" aggressively in App Store metadata only (subtitle, keywords, description).
