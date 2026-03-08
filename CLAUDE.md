# Chronicle RPG — Project Context for Claude Code

## What This Is
A DnD-inspired mobile RPG with an AI Dungeon Master. Built in React Native + Expo SDK 55, iOS-first. Two co-founders. Early prototype stage.

## Tech Stack
- React Native + Expo SDK 55
- VS Code + Claude Code
- Navigation: @react-navigation/stack
- AI: Anthropic Claude API (Haiku 4.5 for DM responses, Sonnet 4.6 for session summaries)
- API key lives in: `src/utils/claude.js`

## Current Build State
Phase 1 complete — core game loop is working:
- **Main menu** → Campaign select → Character creation → DM conversation
- Live Claude API calls with prompt caching (90% cost reduction on system prompt)
- Structured DM responses: narration / NPC dialogue / system text each render differently
- Dice roller triggered only by DM skill checks (not manually accessible)
- Session summary + Chronicle Card (shareable) generated at session end
- 4 DM persona presets tied to campaign selection
- **Auto-save** after every DM response (1.5s debounce, expo-file-system)
- **Continue / New Game / Erase Save** on main menu

## Architecture Decisions

### AI Cost Strategy
- Use `claude-haiku-4-5-20251001` for all real-time DM responses
- Use `claude-sonnet-4-6` only for session summary generation
- Prompt caching on system prompt, persona, campaign context, character sheet — these 4 blocks are marked `cache_control: ephemeral`
- World state (HP, inventory, conditions, quest flags) lives in structured JSON (GameContext), never in AI context window
- Rolling summary system planned for Phase 2 to prevent context window growth

### Message Counting
- Count ONLY player-sent turns, not DM responses
- Free tier = 40 player turns/day
- Warning fires at turn 32 (8 remaining)
- On final turn: inject closing instruction to DM, then auto-generate Chronicle Card

### Engineered Memory Moment (Tutorial)
The tutorial ("A Warden's Errand") has a scripted plant-and-callback:
- Beat 1 (message 3): DM introduces Mik the goblin who surrenders — player chooses to spare or kill. Deliberately played as a throwaway moment.
- Beat 3 (message 16): DM callbacks Mik based on `sessionFlags.tutorial_mik_fate`. If spared: grateful goblin was spotted nearby. If killed: child goblin looking for her father.
- The callback is injected via system prompt, not reliant on context window memory.
- Tutorial title is deliberately bland ("A Warden's Errand") — goblins not mentioned — so Mik feels incidental and the callback surprises.

### DM Personas
4 archetypes in `src/constants/personas.js`:
- The Chronicler (default) — epic, neutral
- The Trickster — witty, subversive
- The Greybeard — warm, lore-heavy
- The Shadowweaver — tense, atmospheric

Each is a tone paragraph prepended to the base system prompt. Tutorial is locked to Chronicler. Persona selection shown after campaign pick (modal sheet).

### Game State (GameContext)
Key state beyond character:
- `sessionFlags` — discrete story events (e.g. `tutorial_mik_fate: "spared"`)
- `npcMemory` — named NPCs with disposition/status/location
- `questFlags` — cross-session quest state
- `APPLY_STATE_UPDATES` reducer parses DM JSON responses and applies HP/gold/item/condition changes automatically

### Save System
- Single auto-save slot: `FileSystem.documentDirectory + 'saves/autosave.json'`
- Saved fields: campaign, dmPersona, character, uiMessages, conversationHistory, sessionFlags, npcMemory, sessionMessageCount, sessionStartedAt
- Auto-save fires 1.5s after any change to `uiMessages`, `character`, `sessionFlags`, or `npcMemory` while `isSessionActive` is true (debounced in GameProvider `useEffect`)
- `LOAD_GAME` reducer action restores full state; `loadSavedGame(saveData)` is the action creator
- Save version field (`version: 1`) guards against loading incompatible old saves
- Erase Save and New Game both show confirmation dialogs before destructive action

### Navigation Flow
`MainMenu` → `CampaignSelect` → `CharacterCreation` → `DMConversation`
- Continue: `MainMenu` → `DMConversation` (after dispatching `LOAD_GAME`)
- `initialRouteName` is `"MainMenu"` in App.js

### DM Response Format
The DM always returns structured JSON:
```json
{
  "narration": "...",
  "npc_dialogue": { "name": "...", "text": "..." },
  "system_text": "...",
  "suggested_actions": ["...", "...", "..."],
  "state_updates": { "hp_change": null, "gold_change": null, "add_items": null, "add_conditions": null, "remove_conditions": null, "session_flags": null, "npc_memory": null },
  "requires_roll": { "skill": "Perception", "dc": 15, "ability": "WIS" }
}
```

### Chronicle Card (Shareable)
Generated at session end via separate Sonnet API call. Prompt instructs:
- Third person narration
- 3-5 sentences, lead with most dramatic moment
- End on unresolved hook
- Generate a 1-3 word archaic epithet from player behavior (e.g. "The Merciful", "The Relentless")
- Card shown with character portrait, stats, epithet badge, native share sheet

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
    │   ├── campaigns.js            ← Campaign definitions + tutorial beat scripts
    │   └── personas.js             ← 4 DM persona presets with system prompt tone
    ├── context/
    │   └── GameContext.js          ← Full game state, reducer, action creators
    ├── utils/
    │   ├── dice.js                 ← All DnD 5e math (point buy, modifiers, checks)
    │   ├── claude.js               ← All API calls (DM, summary, dispatch, random seed)
    │   └── storage.js              ← Save/load via expo-file-system (autosave.json in documentDirectory)
    ├── components/
    │   ├── DMMessage.js            ← Renders narration/NPC/system text with accent bars
    │   ├── DiceRoller.js           ← Pseudo-3D die, forced roll, peek mode
    │   └── ChronicleCard.js        ← Shareable session summary card
    └── screens/
        ├── MainMenuScreen.js           ← Title screen; Continue/New Game/Erase Save; shows save card
        ├── CampaignSelectScreen.js     ← Campaign grid + persona selector modal
        ├── CharacterCreationScreen.js  ← 4-step wizard (Race → Class → Stats → Name)
        └── DMConversationScreen.js     ← Main game screen
```

## Known Issues Fixed
- `@react-navigation/stack` must be explicitly installed (`npm install @react-navigation/stack`)
- Strings containing apostrophes must use double quotes as wrapper in JS
- `messages`, `sessionFlags`, `npcMemory` must have `= []` / `= {}` defaults in context destructure to prevent undefined spread crash on first render
- `getHpColor` should be inlined in DMConversationScreen rather than imported from dice.js

## Phase Roadmap
- **Phase 1** ✅ — Main menu + save system, campaign select, character creation, DM conversation, dice, Chronicle Card
- **Phase 2** — Character sheet overlay, inventory UI, real DnD mechanics in-play (spell slots, conditions), rolling summary system for context management, DM's Dispatch (daily push notification hook)
- **Phase 3** — Multiplayer, world map, campaign framework, economy/subscriptions

## Legal
- DnD mechanics are not copyrightable — safe to use
- Avoid: Mind Flayer, Beholder, Tiefling (WotC-coined names), Forgotten Realms, spell names like "Bigby's Hand"
- Safe: d20 system mechanics, Fighter/Wizard/Rogue/Cleric/Ranger/Paladin archetypes, Elf/Dwarf/Halfling names
- Market as "tabletop RPG tradition" not "D&D"

## Competitive Context
Main competitor: Everweave (iOS). Their critical failures we're solving:
- Walls of text → our structured narration/NPC/system blocks
- No party context visible → our HUD
- No suggested actions → our vertical action chip list
- Dice roll bugs → our client-side roll system
- 30 message free tier → our 40 player-turn tier
- No shareable output → our Chronicle Card
