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
1. **Combat state machine** ✅ — complete including conditions system (Poisoned, Frightened, Stunned, Prone)
2. **World registry & name seeding** ✅ — worldRegistry in GameContext, injected in every API call, name pool per campaign
3. **Tutorial → replaced with spawn-point open world** ✅ — see Campaign Architecture section below
4. **Music system** ✅ — menu music, gameplay music, SFX all working (see Music System section)
5. **Art foundation** ✅ — assets reorganised into subdirectories; race/class/campaign/dice/icon/splash art all bundled; GifHealthBar for animated HP
6. **Monetisation infrastructure** — RevenueCat + IAP last, once mechanics are stable

### Recently Completed (2026-03-14) ✅
- **Menu music** — `MenuMusicManager` mounted in `App.js` (never unmounts); picks random track from `MENU_TRACKS` on launch; 1.6s fade-out on game start; respects Master × Music volume preferences
- **Gameplay music** — `GameplayMusicManager` mounted in `DMConversationScreen`; two players (exploration, combat); crossfade driven by `combatState`; `gameMusic.js` singleton with `SELECTED_TRACKS` (exploration + combat tracks live)
- **SFX system** — `SfxManager` mounted in `DMConversationScreen`; 4 sounds live: `dice_roll`, `dice_land_success`, `dice_land_fail`, `combat_start`; `sfx.js` singleton; add new sounds by dropping MP3 into `src/assets/sfx/` and adding a player in `SfxManager`
- **Settings modal** — `SettingsModal` component; bottom sheet with drag-to-scrub sliders for Master / Music / SFX volume; accessible from main menu, campaign select, and character creation via ⚙ icon
- **Preferences persistence** — `preferences` object in `GameContext` (`diceSkin`, `masterVolume`, `musicVolume`, `sfxVolume`); loaded on mount from `savePreferences`/`loadPreferences` in `storage.js`; saved immediately on change
- **Dice skins** — 5 skins on main menu selector (Classic, Graystone, Obsidian, Dragon, Crystal); persisted in preferences; art at `src/assets/dice/DICE_<skin>_face.png`; 3D GLB model at `src/assets/dice/DiceSet.glb`
- **Art asset reorganisation** — all art moved from flat `src/assets/` into typed subdirectories: `campaigns/`, `classes/`, `dice/`, `icons/`, `races/`, `splash/`, `ui/`, `sfx/`, `music/`; `src/assets/index.js` exports `RaceArt`, `ClassArt`, `CampaignArt`, `SpawnArt`, `DiceFaceArt`, `IconArt`, `Splashes`
- **GifHealthBar** — `src/components/GifHealthBar.js`; renders correct frame from extracted GIF frames based on HP%; falls back to plain colour bar if frames not extracted; extraction script at `scripts/extract-health-bar-frames.js`
- **Campaign architecture rebuilt** — tutorial removed entirely; replaced with spawn-point model (see Campaign Architecture section); contextual mechanic nudges replace tutorial beats
- **World bible** — `src/constants/world.js`; Araxys world / Aranthos kingdom; 6 regions with dominant races and faction control; 5 factions (Crown, Broken Chain, Deep Accord, Thornbound, Crimson Veil); used as DM reference context
- **Character creation overhaul** — race/class art portraits, recommended stat presets per class, per-stat rationale tooltips, `SettingsModal` accessible from header
- **seenMechanics nudge system** — `seenMechanics: Set` in GameContext; tracks which mechanics the player has encountered this session (`skill_check`, `combat`, `inventory`); `DMConversationScreen` injects contextual nudges at message thresholds (skill_check nudge at turn 3, combat nudge at turn 6, inventory nudge at turn 12) if the mechanic hasn't fired naturally

---

## Architecture Decisions

### AI Cost Strategy
- Use `claude-haiku-4-5-20251001` for all real-time DM responses
- Use `claude-sonnet-4-6` only for session summary / Chronicle Card generation
- Prompt caching on system prompt, persona, campaign context, character sheet — these 4 blocks marked `cache_control: ephemeral`
- World state (HP, inventory, conditions, quest flags, combat state) lives in structured JSON (GameContext), **never** in AI context window
- Rolling summary system: auto-triggers from GameContext `useEffect` — no manual call needed (see Rolling Summary section)

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
- [x] Dedicated "COMBAT ENDED" system message renders inline in main chat before AI narration (not just History)
- [x] Dead combatants: turn-skip logic in ADVANCE_TURN reducer; visually defeated in HUD but stay in turn order array
- [x] CombatHUD persists for the entire combat encounter without disappearing
- [x] Two-roll attack flow (attack → damage) works with correct math
- [x] Critical hits double damage dice and trigger distinct feedback
- [x] Dice roller shows context labels and hides advantage/disadvantage unless triggered
- [x] Combat Action Panel replaces freeform text input during `COMBAT_STATE`
- [x] Player can flee combat cleanly
- [x] Basic conditions (Poisoned, Frightened, Stunned, Prone) apply/remove correctly and show in HUD

---

### Pacing & Message Heartbeat Model
**Rule: One API call per narrative beat. Not per player interaction.**

The five levers that reduce API calls without reducing experience:

1. **Multi-round combat batching** — full encounter resolves client-side. 1–2 AI calls per encounter (start narration + outcome), not per round. 66% fewer calls in combat sessions.
2. **Local examine system** — objects and exits from the last DM message become tappable locally. No API call. Only new narrative locations or meaningful discoveries trigger a message.
3. **Skill check two-beat** — client resolves d20 + modifier + pass/fail with animation first. Brief AI call delivers narrative consequence only (not the setup).
4. **NPC dialogue tree caching** — on first encounter, AI generates 3–4 option dialogue tree and NPC personality object. Cached. Subsequent visits = 0 API calls for standard topics.
5. **Exploration pacing** — non-combat travel between known locations uses local fast-travel with cached ambient text. AI reserved for: new locations, story beats, combat initiation, major decisions.

### Campaign Architecture (Current)
The separate tutorial campaign has been removed. Mechanics are now introduced contextually via the **seenMechanics nudge system** in `DMConversationScreen`. Players jump directly into the world.

**Spawn-point model** (`src/constants/campaigns.js`):
- `SPAWN_POINTS` array: 5 named starting locations + 1 "Fate Decides" random option
- Each spawn point has: `locationId`, `name`, `city`, `region`, `regionId`, `tagline`, `difficulty`, `dmOpeningDirective`
- On selection, `CampaignSelectScreen` builds a variant of the `open_world` base campaign with the spawn point's `dmOpeningDirective` prepended to `dmBrief`
- The `open_world` base campaign drives all spawns — world lore and NPC name pool are shared

**Spawn points:**
| ID | Location | Region | Difficulty |
|---|---|---|---|
| `spawn_deepwell` | The Muddy Boot, Deepwell | The Lowfen | Introduction |
| `spawn_crestmere` | The Silver Anchor, Crestmere | Tidebreak Coast | Standard |
| `spawn_aldenmere` | The Whetted Compass, Aldenmere | The Heartlands | Challenging |
| `spawn_hunters_rest` | Hunter's Rest, Thornwood Edge | The Thornwood | Challenging |
| `spawn_embers_end` | Ember's End, Emberveil Border | The Emberveil | Challenging |
| `spawn_random` | Fate Decides | Unknown | Variable |

**Other campaigns** (on the `CAMPAIGNS` list, selectable if surfaced via deep link / future UI):
- `dungeon_crawl` — "The Vault of Forgotten Kings" (Greybeard persona, 3-level dungeon)
- `random` — Chronicler generates a fresh premise from scratch, in-media-res

**seenMechanics nudge system:**
- `seenMechanics: Set` in GameContext tracks `'skill_check'`, `'combat'`, `'inventory'`
- `markMechanicSeen(key)` dispatches `MARK_MECHANIC_SEEN`
- `DMConversationScreen` injects nudges into the DM system prompt at thresholds:
  - Turn 3: skill check nudge (if `skill_check` not yet seen)
  - Turn 6: combat nudge (if `skill_check` seen but `combat` not yet seen)
  - Turn 12: inventory nudge (if `combat` seen but `inventory` not yet seen)
- Mechanics can also fire naturally before the threshold — nudges are skipped if already seen

**Note on Message Counting:**
The `isTutorial` / tutorial-exempt-from-counter logic still exists in `GameContext` but is no longer actively used since the tutorial was removed. It can be repurposed or removed.

### Former Tutorial Notes (archived)
The "A Warden's Errand" tutorial beat design (Ashwick, Ortina, Mik the goblin, the locket, Torven, Firimbel destination) remains in CLAUDE.md below as world lore and campaign canon. The locket/Firimbel storyline is still the intended first authored campaign content. The Mik mechanic and dual-condition callback gate were built but the tutorial screen is no longer the entry point.

### Tutorial — Beat Design & Scope (ARCHIVED — no longer the entry flow)
Tutorial is scoped by **narrative beats**, not message count. Target: 28–35 minutes of play. No message cap. Tutorial does not decrement the free tier counter. A player who completes this tutorial is the exact player who pays — do not optimise for speed.

**The 10 required beats:**
| Beat | Name | API Calls | Notes |
|---|---|---|---|
| 1 | World Drop | 1 | DM voice established in 3 sentences. No mechanics. Ashwick at dusk. |
| 2 | First Choice | 1–2 | Low-stakes binary on the way to the mill. Establishes agency before mechanics. |
| 3 | Skill Check intro | 2 | Perception/Investigation in the cellar. Tooltip fires once on first d20 only. Locket discovered here. |
| 4 | **Mik Plant** | 1 | Mik surrenders. Spare or kill. Deliberately throwaway. **Mik exits scene immediately. He is not in the combat.** Sets `tutorial_mik_plant_timestamp` + `goblin_spared`/`goblin_killed`. |
| 5 | Combat | 1–2 | Aggressive goblin only. Full state machine. Satisfying, not punishing. |
| 6 | Ortina reward | 1 | Report back upstairs. Player shows locket. Ortina doesn't recognise it but names a contact in town — an old scribe named Torven — who knows old seals and crests. |
| 7 | Town exploration | 2–4 | Freeform. Player finds Torven. 2–3 exchanges. World texture. Torven recognises the locket as bearing a Firimbel noble crest — old bloodline, dangerous knowledge. Directs player to find **Ulthur** in Firimbel. Names the city once, clearly. |
| 8 | **Mik Callback** | 1 | Fires during town exploration when both time and message conditions are met. The "holy shit" moment. |
| 9 | Denouement | 1–2 | Player reacts to callback. Torven or the town itself surfaces one more texture beat. Firimbel sits open as a destination. World feels large. |
| 10 | Chronicle Card | 1 (Sonnet) | Fires as the player is poised to leave Ashwick. Epithet reflects Mik choice. Share prompt fires. "Bound for Firimbel." |

---

**Locket throughline:**
The locket is found in the cellar at Beat 3 — mysterious craftsmanship, unknown origin. It is the object that carries the player from the tutorial into the first real campaign. Its significance escalates naturally:
- Beat 3: found, described, feels like minor loot
- Beat 6: Ortina doesn't recognise it but it clearly means something
- Beat 7: Torven identifies the crest as Firimbel nobility — old bloodline, says the player should find Ulthur in Firimbel who will know more
- Firimbel campaign: Ulthur knows the locket identifies a living heir whose existence could end the conflict between the Free Peoples Assembly, The Sundered, and the Stonehelm Guild

The locket must never be fully explained in the tutorial. Torven gives just enough to create a destination, not an answer.

---

**Mik mechanic — critical rules:**

**Rule 1: Mik is never a combatant.**
The combat at Beat 5 is with the aggressive goblin only. Mik exits the scene immediately after the spare/kill decision — slinks into a tunnel if spared, lies dead and irrelevant if killed. The `goblin_plant` beat injection must explicitly direct the DM to remove Mik from the scene before any combat trigger. If Mik is in the fight, the callback cannot surprise.

**Rule 2: Callback is dual-condition gated — time AND message count.**
Combat rounds do not increment `playerTurnCount`. A player can spend 5+ real minutes in combat while the message counter barely moves. A fixed message trigger fires too soon in wall-clock time.

Store `tutorial_mik_plant_timestamp` (Unix ms) in `sessionFlags` when Beat 4 fires. Also store `goblin_encountered_at_message: messageCount`. The callback beat resolver checks **both** before firing:
1. `messageCount >= sessionFlags.goblin_encountered_at_message + 4` (at least 4 narrative exchanges post-plant)
2. `Date.now() - sessionFlags.tutorial_mik_plant_timestamp >= 6 * 60 * 1000` (6 minutes wall-clock minimum)

If either condition fails, skip this turn and re-evaluate next message. The callback fires during Beat 7 (town exploration) when both conditions are met — this is the ideal narrative headspace, curiosity not combat.

**Rule 3: Forced callback safety net.**
If the callback still hasn't fired by message 16, force it regardless of time gate. The tutorial cannot end without the callback landing. Add a `mik_callback_forced` beat at `trigger_at_message: 16` with `excludes_flag: 'mik_callback_fired'`. Both the normal and forced beats set `mik_callback_fired` on trigger. The normal beat also has `excludes_flag: 'mik_callback_fired'` to prevent double-fire.

Spare path: a traveler passing through mentions a small goblin who's been helping people on the road east — an odd sight, but a kind one. Kill path: a child goblin appears at the edge of the market, scanning faces, looking for someone who isn't coming back. Both paths are injected via `sessionFlags.tutorial_mik_fate` — never reliant on context window memory.

Chronicle Card epithet reflects the choice: **"The Merciful"** / **"The Relentless"**.

---

**Beat resolver architecture:**
The resolver in `claude.js` supports two trigger types:

```js
// Simple fixed trigger (most beats)
trigger_at_message: 5

// Dual-condition time+message gate (Mik callback)
trigger_condition: {
  type: 'time_and_message',
  min_messages_after_flag: 4,
  after_flag: 'goblin_encountered',
  min_ms_after_timestamp_flag: 'tutorial_mik_plant_timestamp',
  min_ms: 6 * 60 * 1000,
}

// Minimum message fallback (forced callback safety net)
trigger_condition: {
  type: 'min_message',
  min_message: 16,
}
```

Non-tutorial beats always use `trigger_at_message`. The `trigger_condition` field only exists on tutorial beats that need timing logic.

### Rolling Summary — Context Window Management
Four memory tiers maintained at all times:

| Tier | What it is | Rules |
|---|---|---|
| **Raw recency window** | Last 20 messages (10 full exchanges) | Always sent verbatim. Never summarised. Preserves DM tone and conversational momentum. |
| **Rolling summary** | Everything older | ~200-token narrative digest. Factual compression only. Auto-updated by GameContext `useEffect`. |
| **sessionFlags** | Consequential choices | Permanent. Never summarised. Always injected. Zero context cost. |
| **worldRegistry** | All proper nouns used | Compact JSON. Injected as ~50-token field each call. |
| **entityRegistry** | Richer per-entity data | `{ npcs, locations, items }` — upserted after each DM call from `state_updates`. Session-scoped. |
| **campaignMemory** | Cross-session digest | 80–100 token note generated at Chronicle Card end. Persists in save state. Injected via `## Prior Session Memory` block at session start. |

Summarisation triggers (auto-fired — no manual call needed):
- Standard campaigns: first roll at message 15, then every 15 messages
- Tutorial: first roll at message 25 (tutorial must feel coherent start-to-finish)
- Context ceiling: ~4,000 tokens of history max, regardless of campaign age
- Summary model: Haiku 4.5. Target length: 180–220 tokens.

### World Registry & Name Prevention
A `worldRegistry` object in GameContext, injected as a compact structured field on every API call.

```json
{
  "used_npc_names": ["Ortina", "Marcus"],
  "used_location_names": ["Thornwood", "The Broken Axe Inn"],
  "used_quest_names": ["A Warden's Errand"],
  "used_item_names": []
}
```

**DM system prompt must include:** *"Never reuse any name from worldRegistry.used_npc_names. Draw NPC names from the campaign name_pool instead."*

On campaign creation, inject a `name_pool` of 40–60 culturally appropriate names for the campaign's setting. The AI draws from this pool, not statistical priors. This prevents the "Ortina problem" (every AI model defaults to the same high-frequency fantasy names from training data — Chronicle's first generated NPC was named Ortina unprompted).

### DM Personas
4 archetypes in `src/constants/personas.js`:
- **The Chronicler** (default) — epic, neutral
- **The Trickster** — witty, subversive
- **The Greybeard** — warm, lore-heavy
- **The Shadowweaver** — tense, atmospheric

Each is a tone paragraph prepended to the base system prompt. Tutorial is locked to Chronicler. Persona selection shown after campaign pick (modal sheet).

### Music System
**Current implementation (shipped 2026-03-14):**

**Menu music** (`src/utils/menuMusic.js` + `src/components/MenuMusicManager.js`):
- `MenuMusicManager` mounted once in `App.js` — never unmounts
- Picks random track from `MENU_TRACKS` array on launch; loops
- `startMenuMusic()` / `stopMenuMusic({ fade })` singleton functions for screen components
- 1.6s fade-out (20 steps × 80ms) when transitioning to gameplay
- Add tracks: drop `MENU_XX.mp3` into `src/assets/music/` and uncomment in `MENU_TRACKS`

**Gameplay music** (`src/utils/gameMusic.js` + `src/components/GameplayMusicManager.js`):
- `GameplayMusicManager` mounted in `DMConversationScreen`
- Two `useAudioPlayer` instances: exploration track + combat track
- Crossfades on `combatState` change (1.5s fade-out, 0.6s fade-in)
- `SELECTED_TRACKS` in `gameMusic.js` — swap tracks by changing the `require()` there
- Singleton: `startGameMusic()`, `stopGameMusic({ fade })`, `setSituation(situation)`
- Situations: `'exploration'` | `'combat'` (derived from `combatState` via `combatStateToSituation`)

**SFX** (`src/utils/sfx.js` + `src/components/SfxManager.js`):
- `SfxManager` mounted in `DMConversationScreen`
- One `useAudioPlayer` per SFX key (hooks must be unconditional)
- Live sounds: `dice_roll`, `dice_land_success`, `dice_land_fail`, `combat_start`
- Call: `playSfx('dice_roll')` from anywhere
- Add sounds: drop MP3 in `src/assets/sfx/`, add to `SFX_SOURCES` in `sfx.js`, add `useAudioPlayer` hook in `SfxManager`

**All audio respects preferences** — `masterVolume × musicVolume` for music, `masterVolume × sfxVolume` for SFX; both 0–100 → 0–1 float

**Future stem architecture (not yet built):**
- 4 environments × 4 stem layers = 16 files → 256+ combinations
- Transitions: 3–4 second crossfades. Never hard cut.
- Storage: compressed OGG bundled in app. ~50–80MB. Works offline.

**Tone → situation mapping** (for future stem system):
- `exploration` / `travel` → exploration situation
- `tension` / `combat_light` / `combat_heavy` / `boss` → combat situation
- `discovery` / `victory` / `somber` / `tavern` → exploration situation (currently)

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
  worldRegistry: {          // all proper nouns used — injected to prevent name repetition
    used_npc_names: [],
    used_location_names: [],
    used_quest_names: [],
    used_item_names: [],
  },
  rollingSummary: null,     // ~200-token digest auto-updated every 15 turns by GameContext useEffect
  entityRegistry: {         // richer per-entity data upserted after each DM call (session-scoped)
    npcs: [],               // [{ name, race, disposition, notes }] — from state_updates.npc_updates
    locations: [],          // [{ name, notes }]
    items: [],              // [{ name }] — from state_updates.loot.items
  },
  campaignMemory: null,     // 80–100 token cross-session note; generated at Chronicle Card end;
                            // persists in save state; injected as ## Prior Session Memory at session start
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
├── App.js                          ← Navigation root, GameProvider wrapper, MenuMusicManager mount
├── app.json                        ← Expo config, SDK 55
├── CLAUDE.md                       ← This file
├── scripts/
│   └── extract-health-bar-frames.js ← One-time script: extracts GIF frames to PNG for GifHealthBar
└── src/
    ├── assets/
    │   ├── campaigns/              ← CAMPAIGN_ashen/court/glass/hollow/random.png
    │   ├── classes/                ← CLASS_cleric/fighter/paladin/ranger/rogue/wizard.png
    │   ├── dice/                   ← DICE_<skin>_face.png (5 skins) + DiceSet.glb (3D model)
    │   ├── icons/                  ← ICON_chronicler/d20/inventory/map/scroll/shield/skull/sword.png
    │   ├── music/                  ← MENU_01.mp3, COMBAT_01.mp3, EXPLORATION_01/02.mp3
    │   ├── races/                  ← RACE_dwarf/elf/halfling/human/orc/shadowborn.png
    │   ├── sfx/                    ← SFX_COMBAT_START/DICE_LAND_FAIL/DICE_LAND_SUCCESS/DICE_ROLL.mp3
    │   ├── splash/                 ← SPLASH_01–05.png
    │   ├── ui/                     ← health_bar.gif + health_bar_frames/
    │   └── index.js                ← Named exports: RaceArt, ClassArt, CampaignArt, SpawnArt,
    │                                  DiceFaceArt, IconArt, Splashes
    ├── constants/
    │   ├── theme.js                ← Colors, spacing, shadows (dark medieval palette)
    │   ├── races.js                ← 6 races with stat bonuses and traits
    │   ├── classes.js              ← 6 classes with full DnD 5e mechanics
    │   ├── campaigns.js            ← CAMPAIGNS array + SPAWN_POINTS array + name_pool per campaign
    │   ├── personas.js             ← 4 DM persona presets with system prompt tone
    │   └── world.js                ← Araxys world bible: REGIONS, FACTIONS, CITIES (static reference)
    ├── context/
    │   └── GameContext.js          ← Full game state, reducer, action creators
    │                                  Combat: START_COMBAT, ADVANCE_TURN, APPLY_DAMAGE, END_COMBAT
    │                                  World: UPDATE_WORLD_REGISTRY, SET_ROLLING_SUMMARY
    │                                  Prefs: SET_PREFERENCES (persisted separately from game save)
    │                                  Mechanics: MARK_MECHANIC_SEEN (seenMechanics Set)
    ├── utils/
    │   ├── dice.js                 ← All DnD 5e math (point buy, modifiers, checks, combat resolution)
    │   ├── claude.js               ← All API calls (DM, summary, Chronicle Card)
    │   ├── combat.js               ← Combat state machine logic
    │   ├── menuMusic.js            ← Menu music singleton (delegates to MenuMusicManager)
    │   ├── gameMusic.js            ← Gameplay music singleton (delegates to GameplayMusicManager)
    │   ├── sfx.js                  ← SFX singleton (delegates to SfxManager)
    │   ├── progress.js             ← resetProgress helper
    │   └── storage.js              ← Save/load via expo-file-system; savePreferences/loadPreferences
    ├── components/
    │   ├── DMMessage.js            ← Renders narration/NPC/system text with accent bars
    │   ├── DiceRoller.js           ← Pseudo-3D die, forced roll, peek mode, context labels
    │   ├── ChronicleCard.js        ← Shareable session summary card
    │   ├── CombatHUD.js            ← Turn order, enemy HP bars, conditions
    │   ├── GifHealthBar.js         ← Frame-based animated HP bar (falls back to plain bar)
    │   ├── MenuMusicManager.js     ← expo-audio hook component; mounted once in App.js
    │   ├── GameplayMusicManager.js ← expo-audio hook component; mounted in DMConversationScreen
    │   ├── SfxManager.js           ← expo-audio hook component; mounted in DMConversationScreen
    │   └── SettingsModal.js        ← Bottom-sheet volume sliders (Master / Music / SFX)
    └── screens/
        ├── MainMenuScreen.js           ← Title; Continue/New/Erase; dice skin selector; How to Play
        ├── CampaignSelectScreen.js     ← Spawn-point grid (region cards); Settings icon in header
        ├── CharacterCreationScreen.js  ← 4-step wizard; race/class art; recommended stats; rationale
        └── DMConversationScreen.js     ← Main game screen; GameplayMusicManager + SfxManager mounted here
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
- Dead combatants still taking turns — `ADVANCE_TURN` reducer skips combatants with `hp <= 0`; safety loop prevents infinite skip; defeated combatants greyed in HUD but kept in turn order array for display continuity
- "COMBAT ENDED" banner only in History — `checkCombatEnd()` now pushes system message into main `messages` array; renders inline before AI outro
- DiceRoller layout: "Read prompt" button overlaps roll context title — resolved by flex-row topBar layout (no absolute positioning)
- Advantage/Disadvantage always visible — hidden by default; `hasAdvantage`/`hasDisadvantage` props derived from active conditions
- Attack resolution single-roll — replaced with two-phase flow: attack d20 → damage die (separate roller, sequential)

## Known Issues Active
*(none — all previously tracked issues resolved)*

**Resolved (2026-03-15):**
- ~~Conditions not wired to combatTurnOrder~~ — Fixed: `applyStateUpdates` now calls `updateCombatantConditions` for player (by `targetId: 'player'`) and enemies (via new `enemy_conditions` field). `UPDATE_COMBATANT_CONDITIONS` reducer updates both `combatTurnOrder` and `activeEnemies`. Enemy conditions now flow from DM JSON → HUD chips.
- ~~Campaign memory not injected at session start~~ — Was already wired: `buildSystemPrompt` accepts `campaignMemory` and emits `## Prior Session Memory` block; `callDM` passes it through; `DMConversationScreen` destructures it from `useGame()`; `saveGame` persists it; `LOAD_GAME` restores it.
- ~~`isTutorial` flag orphaned~~ — Never added to the codebase; only existed in CLAUDE.md. No cleanup needed.

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

## World Lore & Campaign Canon

### The World (Established)
**World:** Araxys | **Kingdom:** Aranthos

Canonical data lives in `src/constants/world.js`. Do not over-specify — the AI DM fills in texture. These are the fixed anchors for consistency across all campaigns.

**Regions (6):**
| Region | Dominant Race | Faction Control | Tone |
|---|---|---|---|
| The Heartlands | Human | Crown | stable_anxious |
| The Thornwood | Elf | Thornbound | mysterious_beautiful |
| The Ashpeaks | Dwarf | Deep Accord | industrial_proud |
| The Lowfen | Halfling | None | friendly_hidden_depths |
| The Scorched Reach | Orc | Broken Chain | harsh_proud |
| The Tidebreak Coast | Mixed | Crimson Veil (shadow) | cosmopolitan_flexible |

**Factions (5, from `world.js`):**
- **The Crown** — established monarchic authority over the Heartlands; anxious about its grip on power
- **The Broken Chain** — orc/half-orc liberation movement rooted in the Scorched Reach; grievances are legitimate
- **The Deep Accord** — dwarf-majority mining and trade guild controlling the Ashpeaks; pragmatic, proud
- **The Thornbound** — elven collective in the Thornwood; ancient, unwelcoming to outsiders, deeply territorial
- **The Crimson Veil** — shadow network along the Tidebreak Coast; deals with everyone, loyal to none

**Spawn-point cities:** Deepwell (Lowfen), Crestmere (Tidebreak), Aldenmere (Heartlands capital), Thornwood Edge, Ember's End (Emberveil border)

### Legacy Lore (Ashwick / Firimbel — archived campaign canon)
The Ashwick/Firimbel storyline was designed for the original tutorial + Campaign 1. It remains valid world content but is no longer the active entry point.

**Ashwick** — Small village. Ortina runs the inn. Torven is a retired scribe who knows old seals and noble crests.

**Firimbel** — Large city in political unrest. Three-way power struggle: Free Peoples Assembly (democratic, good-leaning), The Sundered (orc-majority warband, legitimate grievances), Stonehelm Guild (dwarf merchant guild, neutral self-interest).

**The Locket** — Found in the Ashwick mill cellar. Bears a Firimbel noble crest. Torven directs the player to Ulthur in Firimbel. Identifies a living heir whose existence could resolve or detonate the conflict.

**Ulthur** — Keeper of the locket's secret. Not the heir. His own agenda.

**The heir** — Unnamed. Unaware of their lineage. DM generates identity dynamically, holds via sessionFlags.

---

## Campaigns

### Tutorial: "A Warden's Errand"
See Tutorial — Beat Design & Scope section above for full beat spec.

`dmBrief`:
> This is a tutorial adventure set in the village of Ashwick. The player has been asked by Ortina, the innkeeper, to investigate scratching sounds coming from the cellar of the old mill for three nights.
>
> The cellar contains two goblins. One is aggressive and will fight. The other, named Mik, will surrender if given the chance — he has young waiting for him. Mik's fate is the player's first moral choice. Play it as a throwaway moment, not a dramatic one. After the spare/kill decision, Mik exits the scene immediately — he slinks into a tunnel if spared, or is simply dead if killed. He is not part of the fight that follows.
>
> Behind a loose stone in the cellar wall is a silver locket with an unusual crest. The player may find it with a successful Perception or Investigation check. Describe it as finely made, slightly old, bearing a crest the player doesn't recognise.
>
> After the cellar is resolved, the player returns to Ortina upstairs. She rewards them with coin. If the player shows her the locket, she doesn't recognise the crest but suggests they speak with Torven — a retired scribe who lives near the market, knows old symbols and noble marks.
>
> Torven recognises the locket's crest as Firimbel nobility — old bloodline, he says, and goes quiet. He tells the player to find a man named Ulthur in Firimbel, and only Ulthur. He won't say more. Name the city clearly: Firimbel.
>
> The session ends when the player is ready to leave Ashwick. Do not rush this — let them explore the town, talk to people, linger. The world should feel lived-in. End the session when it has a natural sense of completion and forward momentum, not at a fixed message count.
>
> FLAG REQUIRED: When Mik's fate resolves, you must write `goblin_spared: true` OR `goblin_killed: true` to `state_updates.flags`. This is mandatory. Do not narrate past this moment without setting the flag.

### Campaign 1: "The Sundered Crown" *(Firimbel)*
**Tone:** Political intrigue, moral ambiguity, escalating stakes. Grounded — the conflict is about power and people, not cosmic evil.

**Setting:** Firimbel. A large city under three-way political pressure. The Free Peoples Assembly holds nominal authority but is fracturing. The Sundered are pressing from outside the city and within. The Stonehelm Guild controls the flow of money and information and is watching carefully.

**Opening hook:** The player arrives in Firimbel looking for Ulthur. Finding him is not simple — he is being watched. The city should feel tense from the first scene: patrols, whispered conversations, faction insignia on buildings and people.

**Ulthur:** Knows the locket's significance. Knows the heir's identity. Has been protecting both secrets for years. Has his own agenda — he is not purely an ally. The player must earn his trust before he shares what he knows.

**The heir:** A living person in Firimbel, unnamed in all system prompts. The DM establishes their identity dynamically early in the campaign and holds it via sessionFlags. They do not know their own lineage. The player must decide when to tell them — and who else to tell first.

**Faction dynamics:**
- Aligning with the Assembly is the "right" choice, complicated by their internal dysfunction
- The Sundered are the obvious threat but have legitimate grievances the DM should honour — not every Sundered NPC is a villain
- The Guild will negotiate with anyone, including the player, for the right price

**DM brief:**
> The player arrives in Firimbel from Ashwick, carrying a locket bearing a noble bloodline crest. They are looking for a man named Ulthur.
>
> Firimbel is in conflict. The Free Peoples Assembly — a multi-race democratic coalition — holds nominal authority but is weakening. The Sundered, an orc-majority warband with old grievances, are pressing their claim through force and political disruption. The Stonehelm Guild, a dwarf-majority merchant guild, is neutral and watching, dealing with all sides.
>
> The locket identifies a living heir to an old Firimbel noble bloodline. This heir, currently unaware of their lineage, would legitimise the Assembly's authority if their identity became known — and would be hunted by the Sundered for the same reason. The Guild would want to control the heir as leverage.
>
> Ulthur knows all of this. He has been protecting the secret for years. He is not easily found and not easily trusted. The player must navigate the city to reach him.
>
> Establish the heir's identity early (message 3–5) and store it as a sessionFlag. Never reveal it to the player until they have earned it through the campaign. Protect this secret as Ulthur would.
>
> Let the player choose their faction alignment organically — do not force it. Every faction should have NPCs with depth. The Sundered in particular have legitimate grievances; not every member is a villain.


- **Primary competitor:** Everweave (iOS, ~340K downloads, 3.7★). Solo developer. Critical failures we are solving: walls of text, broken dice math, toxic message cap monetisation, no party context, no shareable output.
- **Biggest strategic threat:** AI Dungeon "Heroes" update — structured RPG mechanics being added to 3M+ download base. Monitor their dev logs weekly. Launch before Heroes ships.
- **Our differentiators:** Structured narration blocks, visible game-state HUD, deterministic client-side dice, fair unlimited paid tier, Chronicle Card social loop, adaptive music (first in category), Claude narrative quality.
- **Naming:** "AI" in product names is a liability for premium brands. "Chronicle" is correct. Use "AI" aggressively in App Store metadata only (subtitle, keywords, description).
