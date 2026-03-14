import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { saveGame, savePreferences, loadPreferences } from '../utils/storage';
import { generateRollingSummary } from '../utils/claude';

const initialState = {
  campaign: null,
  dmPersona: 'chronicler',
  character: {
    name: '',
    race: null,
    class: null,
    level: 1,
    abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    maxHP: 0,
    currentHP: 0,
    AC: 10,
    speed: 30,
    proficiencyBonus: 2,
    skills: [],
    inventory: [],
    gold: 0,
    conditions: [],
    spellSlots: {},
    portrait: null,
  },
  conversationHistory: [],
  uiMessages: [],
  sessionFlags: {},
  npcMemory: [],
  sessionMessageCount: 0,
  sessionStartedAt: null,
  isSessionActive: false,
  sessionSummary: null,
  epithet: null,

  // ── Combat state ─────────────────────────────────────────────────────────────
  // EXPLORATION | COMBAT_INIT | COMBAT_STATE | COMBAT_RESOLUTION | DOWNED
  combatState: 'EXPLORATION',
  combatTurnOrder: [],      // [{ name, isPlayer, initiative, id?, hp, maxHp, ac, conditions }]
  activeTurnIndex: 0,
  combatRound: 0,
  activeEnemies: [],        // [{ id, name, hp, maxHp, ac, attackBonus, damageDice, conditions }]
  playerHpAtCombatStart: 0,
  deathSaves: { successes: 0, failures: 0 },

  // ── Audio / art ───────────────────────────────────────────────────────────────
  currentTone: 'exploration',
  currentSceneTag: null,

  // ── World registry & rolling summary ─────────────────────────────────────────
  worldRegistry: {
    used_npc_names: [],
    used_location_names: [],
    used_quest_names: [],
    used_item_names: [],
  },
  rollingSummary: null,

  // ── Entity registry — richer per-entity data extracted after each DM call ────
  entityRegistry: {
    npcs: [],       // [{ name, race, disposition, notes }]
    locations: [],  // [{ name, notes }]
    items: [],      // [{ name }]
  },

  // ── Cross-session persistent memory — generated at Chronicle Card, injected at session start ──
  campaignMemory: null,

  // ── Aranthos world tracking — dynamic, persisted across sessions ──────────────
  worldReputations: {
    crown: 0,
    iron_compact: 0,
    thornbound: 0,
    deep_accord: 0,
    crimson_veil: 0,
    ashen_circle: 0,
    broken_chain: 0,
  },
  visitedLocations: [],   // array of location id strings
  npcDispositions: {},    // { npc_id: integer delta } added to NPC_TEMPLATES.disposition_default
  mainPlotStage: 'hidden', // 'hidden' | 'stirring' | 'fracturing' | 'breaking' | 'resolved'

  // ── User preferences ──────────────────────────────────────────────────────────
  preferences: { diceSkin: 'default', masterVolume: 80, musicVolume: 70, sfxVolume: 80 },
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_CAMPAIGN':
      return { ...state, campaign: action.payload.campaign, dmPersona: action.payload.persona };
    case 'SET_CHARACTER':
      return { ...state, character: { ...state.character, ...action.payload } };
    case 'START_SESSION':
      return {
        ...state,
        isSessionActive: true,
        sessionStartedAt: new Date().toISOString(),
        sessionMessageCount: 0,
        conversationHistory: [],
        uiMessages: [],
        sessionFlags: {},
        npcMemory: [],
        entityRegistry: { npcs: [], locations: [], items: [] },
      };
    case 'ADD_UI_MESSAGE':
      return {
        ...state,
        uiMessages: [
          ...state.uiMessages,
          {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: new Date().toISOString(),
            ...action.payload,
          },
        ],
      };
    case 'ADD_CONVERSATION_TURN':
      return {
        ...state,
        conversationHistory: [...state.conversationHistory, action.payload],
        sessionMessageCount: state.sessionMessageCount + 1,
      };
    case 'INCREMENT_MESSAGE_COUNT':
      return { ...state, sessionMessageCount: state.sessionMessageCount + 1 };
    case 'SET_SESSION_FLAG':
      return { ...state, sessionFlags: { ...state.sessionFlags, [action.payload.key]: action.payload.value } };
    case 'SET_SESSION_FLAGS':
      return { ...state, sessionFlags: { ...state.sessionFlags, ...action.payload } };
    case 'UPSERT_NPC': {
      const idx = state.npcMemory.findIndex(n => n.name === action.payload.name);
      if (idx >= 0) {
        const updated = [...state.npcMemory];
        updated[idx] = { ...updated[idx], ...action.payload };
        return { ...state, npcMemory: updated };
      }
      return { ...state, npcMemory: [...state.npcMemory, action.payload] };
    }
    case 'UPDATE_CHARACTER_HP':
      return {
        ...state,
        character: {
          ...state.character,
          currentHP: Math.max(0, Math.min(action.payload, state.character.maxHP)),
        },
      };

    // ── Combat ──────────────────────────────────────────────────────────────────
    case 'START_COMBAT':
      return {
        ...state,
        combatState: 'COMBAT_INIT',
        activeEnemies: action.payload.enemies,
        combatTurnOrder: [],
        activeTurnIndex: 0,
        combatRound: 0,
        playerHpAtCombatStart: state.character.currentHP,
        deathSaves: { successes: 0, failures: 0 },
      };

    case 'RESOLVE_INITIATIVE':
      return {
        ...state,
        combatState: 'COMBAT_STATE',
        combatTurnOrder: action.payload.turnOrder,
        activeTurnIndex: 0,
        combatRound: 1,
      };

    case 'ADVANCE_TURN': {
      const len = Math.max(1, state.combatTurnOrder.length);
      let nextIndex = (state.activeTurnIndex + 1) % len;
      let didCrossZero = nextIndex === 0;
      let safetyCounter = 0;
      // Skip dead non-player combatants; guard against infinite loop if all enemies are down
      while (
        safetyCounter < len - 1 &&
        !state.combatTurnOrder[nextIndex]?.isPlayer &&
        (state.combatTurnOrder[nextIndex]?.hp ?? 1) <= 0
      ) {
        safetyCounter++;
        const candidate = (nextIndex + 1) % len;
        if (candidate === 0 && nextIndex !== 0) didCrossZero = true;
        nextIndex = candidate;
      }
      const newRound = didCrossZero ? state.combatRound + 1 : state.combatRound;
      return { ...state, activeTurnIndex: nextIndex, combatRound: newRound };
    }

    case 'APPLY_ENEMY_DAMAGE': {
      const { enemyId, damage } = action.payload;
      const updatedEnemies = state.activeEnemies.map(e =>
        e.id === enemyId ? { ...e, hp: Math.max(0, e.hp - damage) } : e
      );
      const updatedOrder = state.combatTurnOrder.map(t => {
        const match = updatedEnemies.find(e => e.id === t.id);
        return match ? { ...t, hp: match.hp } : t;
      });
      return { ...state, activeEnemies: updatedEnemies, combatTurnOrder: updatedOrder };
    }

    case 'APPLY_PLAYER_COMBAT_DAMAGE': {
      const newHP = Math.max(0, state.character.currentHP - action.payload.damage);
      return {
        ...state,
        character: { ...state.character, currentHP: newHP },
        combatState: newHP === 0 ? 'DOWNED' : state.combatState,
        deathSaves: newHP === 0 ? { successes: 0, failures: 0 } : state.deathSaves,
      };
    }

    case 'UPDATE_DEATH_SAVE': {
      const { success, isCritical, isFumble } = action.payload;
      // Natural 20 → regain 1 HP and stabilise
      if (isCritical) {
        return {
          ...state,
          character: { ...state.character, currentHP: 1 },
          combatState: 'COMBAT_STATE',
          deathSaves: { successes: 0, failures: 0 },
        };
      }
      const failureAdd = isFumble ? 2 : success ? 0 : 1;
      const successAdd = !isFumble && success ? 1 : 0;
      const newSuccesses = state.deathSaves.successes + successAdd;
      const newFailures = state.deathSaves.failures + failureAdd;
      // 3 successes → stabilise at 0 HP
      if (newSuccesses >= 3) {
        return {
          ...state,
          combatState: 'COMBAT_STATE',
          deathSaves: { successes: 3, failures: newFailures },
        };
      }
      return { ...state, deathSaves: { successes: newSuccesses, failures: newFailures } };
    }

    case 'END_COMBAT':
      return { ...state, combatState: 'COMBAT_RESOLUTION' };

    case 'RESET_COMBAT':
      return {
        ...state,
        combatState: 'EXPLORATION',
        combatTurnOrder: [],
        activeTurnIndex: 0,
        combatRound: 0,
        activeEnemies: [],
        playerHpAtCombatStart: 0,
        deathSaves: { successes: 0, failures: 0 },
      };

    // ── Audio / art ──────────────────────────────────────────────────────────────
    case 'SET_TONE':
      return { ...state, currentTone: action.payload };

    case 'SET_SCENE_TAG':
      return { ...state, currentSceneTag: action.payload };

    // ── World registry & rolling summary ─────────────────────────────────────────
    case 'UPDATE_WORLD_REGISTRY': {
      const reg = state.worldRegistry;
      const upd = action.payload;
      return {
        ...state,
        worldRegistry: {
          used_npc_names: [...new Set([...reg.used_npc_names, ...(upd.used_npc_names || [])])],
          used_location_names: [...new Set([...reg.used_location_names, ...(upd.used_location_names || [])])],
          used_quest_names: [...new Set([...reg.used_quest_names, ...(upd.used_quest_names || [])])],
          used_item_names: [...new Set([...reg.used_item_names, ...(upd.used_item_names || [])])],
        },
      };
    }

    case 'SET_ROLLING_SUMMARY':
      return { ...state, rollingSummary: action.payload };

    case 'UPDATE_ENTITY_REGISTRY': {
      const { npcs = [], locations = [], items = [] } = action.payload;
      const upsert = (arr, incoming) => {
        const result = [...arr];
        for (const entry of incoming) {
          const idx = result.findIndex(x => x.name === entry.name);
          if (idx >= 0) result[idx] = { ...result[idx], ...entry };
          else result.push(entry);
        }
        return result;
      };
      return {
        ...state,
        entityRegistry: {
          npcs: upsert(state.entityRegistry.npcs, npcs),
          locations: upsert(state.entityRegistry.locations, locations),
          items: upsert(state.entityRegistry.items, items),
        },
      };
    }

    case 'SET_CAMPAIGN_MEMORY':
      return { ...state, campaignMemory: action.payload };

    // ── Aranthos world tracking ───────────────────────────────────────────────
    case 'UPDATE_WORLD_REPUTATION': {
      const { faction, delta } = action.payload;
      if (!(faction in state.worldReputations)) return state;
      return {
        ...state,
        worldReputations: {
          ...state.worldReputations,
          [faction]: Math.max(-5, Math.min(5, state.worldReputations[faction] + delta)),
        },
      };
    }

    case 'VISIT_LOCATION': {
      if (state.visitedLocations.includes(action.payload)) return state;
      return { ...state, visitedLocations: [...state.visitedLocations, action.payload] };
    }

    case 'UPDATE_NPC_DISPOSITION': {
      const { npcId, delta } = action.payload;
      const current = state.npcDispositions[npcId] || 0;
      return {
        ...state,
        npcDispositions: { ...state.npcDispositions, [npcId]: current + delta },
      };
    }

    case 'SET_PLOT_STAGE':
      return { ...state, mainPlotStage: action.payload };

    case 'SET_DICE_SKIN':
      return { ...state, preferences: { ...state.preferences, diceSkin: action.payload } };

    case 'SET_PREFERENCES':
      return { ...state, preferences: { ...state.preferences, ...action.payload } };

    case 'ADD_TO_INVENTORY':
      return {
        ...state,
        character: { ...state.character, inventory: [...state.character.inventory, action.payload] },
      };
    case 'SET_SESSION_SUMMARY':
      return {
        ...state,
        sessionSummary: action.payload.summary,
        epithet: action.payload.epithet,
        ...(action.payload.campaignMemory != null ? { campaignMemory: action.payload.campaignMemory } : {}),
      };
    case 'END_SESSION':
      return { ...state, isSessionActive: false };
    case 'RESET_GAME':
      return initialState;
    // Restore a full saved game state (e.g. from "Continue" on main menu)
    // Preserve in-memory preferences — they are saved/loaded separately and must
    // not be overwritten by the game save (which predates the preferences field).
    case 'LOAD_GAME':
      return { ...initialState, ...action.payload, isSessionActive: true, preferences: state.preferences };
    default:
      return state;
  }
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // ── Load persisted preferences on mount ────────────────────────────────────
  useEffect(() => {
    loadPreferences().then(saved => {
      if (saved) dispatch({ type: 'SET_PREFERENCES', payload: saved });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist preferences immediately whenever they change ───────────────────
  useEffect(() => {
    savePreferences(state.preferences);
  }, [state.preferences]);

  // ── Auto-save whenever the conversation progresses ─────────────────────────
  // We debounce slightly so rapid dispatches don't hammer the filesystem.
  const autoSaveTimer = useRef(null);
  useEffect(() => {
    if (!state.isSessionActive || state.uiMessages.length === 0) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveGame(state);
    }, 1500);
    return () => clearTimeout(autoSaveTimer.current);
  }, [state.uiMessages, state.character, state.sessionFlags, state.npcMemory]);

  // ── Rolling summary — fires every 15 player turns (25 for tutorial first trigger) ──
  useEffect(() => {
    const count = state.sessionMessageCount;
    if (!state.isSessionActive || count === 0 || !state.campaign || !state.character?.name) return;
    const isTutorial = state.campaign.tutorial_beats?.length > 0;
    const firstTrigger = isTutorial ? 25 : 15;
    const isFirstTrigger = count === firstTrigger;
    const isRecurringTrigger = count > firstTrigger && (count - firstTrigger) % 15 === 0;
    if (!isFirstTrigger && !isRecurringTrigger) return;

    generateRollingSummary({
      character: state.character,
      campaign: state.campaign,
      messages: state.uiMessages,
      sessionFlags: state.sessionFlags,
      existingSummary: state.rollingSummary,
    }).then(summary => {
      if (summary) dispatch({ type: 'SET_ROLLING_SUMMARY', payload: summary });
    }).catch(() => {});
  }, [state.sessionMessageCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action creators ────────────────────────────────────────────────────────
  const setCampaign = (campaign, persona) =>
    dispatch({ type: 'SET_CAMPAIGN', payload: { campaign, persona } });
  const setCharacter = (updates) => dispatch({ type: 'SET_CHARACTER', payload: updates });
  const startSession = () => dispatch({ type: 'START_SESSION' });
  const addUIMessage = (message) => dispatch({ type: 'ADD_UI_MESSAGE', payload: message });
  const addConversationTurn = (turn) => dispatch({ type: 'ADD_CONVERSATION_TURN', payload: turn });
  const setSessionFlag = (key, value = true) =>
    dispatch({ type: 'SET_SESSION_FLAG', payload: { key, value } });
  const setSessionFlags = (flags) => dispatch({ type: 'SET_SESSION_FLAGS', payload: flags });
  const upsertNPC = (npc) => dispatch({ type: 'UPSERT_NPC', payload: npc });
  const updateHP = (newHP) => dispatch({ type: 'UPDATE_CHARACTER_HP', payload: newHP });
  const addToInventory = (item) => dispatch({ type: 'ADD_TO_INVENTORY', payload: item });
  const setSessionSummary = (summary, epithet, campaignMemory = null) =>
    dispatch({ type: 'SET_SESSION_SUMMARY', payload: { summary, epithet, campaignMemory } });
  const updateEntityRegistry = (updates) =>
    dispatch({ type: 'UPDATE_ENTITY_REGISTRY', payload: updates });
  const setCampaignMemory = (memory) =>
    dispatch({ type: 'SET_CAMPAIGN_MEMORY', payload: memory });
  const setDiceSkin = (skin) => dispatch({ type: 'SET_DICE_SKIN', payload: skin });
  const setPreferences = (updates) => dispatch({ type: 'SET_PREFERENCES', payload: updates });
  const endSession = () => dispatch({ type: 'END_SESSION' });
  const resetGame = () => dispatch({ type: 'RESET_GAME' });

  /** Flush state to disk immediately (bypasses the debounce). Use before reset/exit. */
  const saveNow = () => saveGame(state);

  /** Restore a save from disk into the running context (called from MainMenu). */
  const loadSavedGame = (saveData) => dispatch({ type: 'LOAD_GAME', payload: saveData });

  // ── Combat action creators ───────────────────────────────────────────────────
  const initCombat = (enemies) =>
    dispatch({ type: 'START_COMBAT', payload: { enemies } });
  const resolveInitiative = (turnOrder) =>
    dispatch({ type: 'RESOLVE_INITIATIVE', payload: { turnOrder } });
  const advanceTurn = () => dispatch({ type: 'ADVANCE_TURN' });
  const applyEnemyDamage = (enemyId, damage) =>
    dispatch({ type: 'APPLY_ENEMY_DAMAGE', payload: { enemyId, damage } });
  const applyPlayerCombatDamage = (damage) =>
    dispatch({ type: 'APPLY_PLAYER_COMBAT_DAMAGE', payload: { damage } });
  const updateDeathSave = (result) =>
    dispatch({ type: 'UPDATE_DEATH_SAVE', payload: result });
  const endCombat = () => dispatch({ type: 'END_COMBAT' });
  const resetCombat = () => dispatch({ type: 'RESET_COMBAT' });

  // ── Audio / art ───────────────────────────────────────────────────────────────
  const setTone = (tone) => dispatch({ type: 'SET_TONE', payload: tone });
  const setSceneTag = (tag) => dispatch({ type: 'SET_SCENE_TAG', payload: tag });

  // ── World registry & rolling summary ─────────────────────────────────────────
  const updateWorldRegistry = (updates) =>
    dispatch({ type: 'UPDATE_WORLD_REGISTRY', payload: updates });
  const setRollingSummary = (summary) =>
    dispatch({ type: 'SET_ROLLING_SUMMARY', payload: summary });

  // ── Aranthos world tracking ───────────────────────────────────────────────────
  const updateWorldReputation = (faction, delta) =>
    dispatch({ type: 'UPDATE_WORLD_REPUTATION', payload: { faction, delta } });
  const visitLocation = (locationId) =>
    dispatch({ type: 'VISIT_LOCATION', payload: locationId });
  const updateNpcDisposition = (npcId, delta) =>
    dispatch({ type: 'UPDATE_NPC_DISPOSITION', payload: { npcId, delta } });
  const setPlotStage = (stage) =>
    dispatch({ type: 'SET_PLOT_STAGE', payload: stage });

  return (
    <GameContext.Provider
      value={{
        ...state,
        setCampaign,
        setCharacter,
        startSession,
        addUIMessage,
        addConversationTurn,
        setSessionFlag,
        setSessionFlags,
        upsertNPC,
        updateHP,
        addToInventory,
        setSessionSummary,
        endSession,
        resetGame,
        saveNow,
        loadSavedGame,
        // Combat
        initCombat,
        resolveInitiative,
        advanceTurn,
        applyEnemyDamage,
        applyPlayerCombatDamage,
        updateDeathSave,
        endCombat,
        resetCombat,
        // Audio / art
        setTone,
        setSceneTag,
        // World registry & summary
        updateWorldRegistry,
        setRollingSummary,
        // Entity registry & campaign memory
        updateEntityRegistry,
        setCampaignMemory,
        // Aranthos world tracking
        updateWorldReputation,
        visitLocation,
        updateNpcDisposition,
        setPlotStage,
        // Preferences
        setDiceSkin,
        setPreferences,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
};
