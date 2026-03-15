// src/screens/DMConversationScreen.js
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Modal, StatusBar, Animated, Keyboard, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGame } from '../context/GameContext';
import { callDM, generateSessionSummary } from '../utils/claude';
import DMMessage from '../components/DMMessage';
import DiceRoller from '../components/DiceRoller';
import ChronicleCard from '../components/ChronicleCard';
import CombatHUD, { EnemyZone, CombatLogStrip } from '../components/CombatHUD';
import SettingsModal from '../components/SettingsModal';
import {
  rollInitiative, initializeEnemies, resolveAttack, rollDamage,
  rollDeathSave, buildCombatSummary, formatPlayerAttack, formatEnemyTurn, getPlayerCombatProfile,
} from '../utils/combat';
import { getAbilityModifier, roll } from '../utils/dice';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';
import { stopMenuMusic } from '../utils/menuMusic';
import GameplayMusicManager from '../components/GameplayMusicManager';
import SfxManager from '../components/SfxManager';
import { playSfx } from '../utils/sfx';

const PERSONA_TYPING = {
  chronicler: 'Inscribing the record…',
  trickster: 'Spinning a twist…',
  greybeard: 'Consulting the old tomes…',
  shadowweaver: 'Something stirs in the dark…',
};

const getHpColor = (current, max) => {
  const pct = max > 0 ? current / max : 1;
  if (pct <= 0.25) return COLORS.hpLow;
  if (pct <= 0.5) return COLORS.hp;
  return COLORS.success;
};

const formatMod = (mod) => (mod >= 0 ? `+${mod}` : `${mod}`);

export default function DMConversationScreen({ navigation }) {
  const game = useGame();
  const {
    character,
    campaign: selectedCampaign,
    dmPersona: selectedPersona,
    uiMessages: messages = [],
    sessionFlags = {},
    npcMemory = [],
    sessionSummary,
    epithet,
    addUIMessage: addMessage,
    setSessionFlags,
    upsertNPC,
    updateHP,
    addToInventory,
    setCharacter,
    setSessionSummary,
    resetGame: resetSession,
    saveNow,
    // Combat
    combatState,
    combatTurnOrder,
    activeTurnIndex,
    activeEnemies,
    combatRound,
    playerHpAtCombatStart,
    deathSaves,
    initCombat,
    resolveInitiative,
    advanceTurn,
    applyEnemyDamage,
    applyPlayerCombatDamage,
    updateDeathSave,
    endCombat,
    resetCombat,
    updateCombatantConditions,
    // Audio / art
    setTone,
    setSceneTag,
    // World registry & campaign memory
    worldRegistry,
    campaignMemory,
    // Mechanic coverage
    seenMechanics,
    markMechanicSeen,
    // Preferences
    preferences,
  } = game;

  const [isLoading, setLoading] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [charSheetVisible, setCharSheetVisible] = useState(false);

  // ── Stop menu music when session starts ───────────────────────────────────────
  useEffect(() => { stopMenuMusic({ fade: true }); }, []);

  // ── Save & Exit ───────────────────────────────────────────────────────────────
  // Flag lets our own button bypass the beforeRemove confirmation.
  const isExitingIntentionally = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isExitingIntentionally.current) return; // allow programmatic exit
      e.preventDefault();
      Alert.alert(
        'Leave Adventure?',
        'Your progress is auto-saved. You can continue later from the main menu.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Save & Exit',
            onPress: async () => {
              await saveNow();
              isExitingIntentionally.current = true;
              resetSession();
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation]);

  const handleSaveAndExit = () => {
    Alert.alert(
      'Leave Adventure?',
      'Your progress is saved. You can continue later from the main menu.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Save & Exit',
          onPress: async () => {
            await saveNow();
            isExitingIntentionally.current = true;
            resetSession();
            navigation.navigate('MainMenu');
          },
        },
      ]
    );
  };

  // Apply structured state updates from DM JSON response
  const applyStateUpdates = (updates) => {
    if (!updates) return;
    if (updates.hp_change && character?.currentHP != null) {
      const newHP = character.currentHP + updates.hp_change;
      // First combat protection: player cannot die during their first encounter
      const isFirstCombat = !seenMechanics.has('combat');
      updateHP(isFirstCombat ? Math.max(1, newHP) : newHP);
    }
    if (updates.gold_change && character?.gold != null) {
      setCharacter({ gold: character.gold + updates.gold_change });
    }
    if (updates.add_items?.length) {
      updates.add_items.forEach(item => addToInventory(item));
    }
    if (updates.conditions_applied?.length) {
      setCharacter({ conditions: [...new Set([...(character?.conditions || []), ...updates.conditions_applied])] });
      updateCombatantConditions({ targetId: 'player', conditionsApplied: updates.conditions_applied, conditionsRemoved: [] });
    }
    if (updates.conditions_removed?.length) {
      setCharacter({
        conditions: (character?.conditions || []).filter(c => !updates.conditions_removed.includes(c)),
      });
      updateCombatantConditions({ targetId: 'player', conditionsApplied: [], conditionsRemoved: updates.conditions_removed });
    }
    if (updates.session_flags) setSessionFlags(updates.session_flags);
    if (updates.npc_memory?.length) updates.npc_memory.forEach(npc => upsertNPC(npc));
  };

  // ── Combat handlers ──────────────────────────────────────────────────────────

  const handleCombatStart = (dmResponse) => {
    const rawEnemies = dmResponse.enemies || dmResponse.state_updates?.enemies || [];
    const enemyList = rawEnemies.length > 0 ? rawEnemies : [{ name: 'Enemy', hp: 10, maxHp: 10, ac: 12, attackBonus: 3, damageDice: '1d6', initiativeMod: 0 }];
    const enemies = initializeEnemies(enemyList);
    initCombat(enemies); // → COMBAT_INIT state

    // Show combat announcement — dice roller auto-opens as bottom sheet
    addMessage({
      id: `combat_start_${Date.now()}`,
      role: 'assistant',
      content: { system_text: '⚔️ Combat begins! Roll for initiative.' },
      personaName: selectedPersona?.name,
      personaEmoji: selectedPersona?.emoji,
      timestamp: Date.now(),
    });
    setPendingCombatRoll({ type: 'initiative', enemies });
    setWaitingForInitiative(false);
    setDiceVisible(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleInitiativeRoll = (rollResult, enemies) => {
    const playerDexMod = getAbilityModifier(character?.abilityScores?.DEX || 10);
    const allCombatants = [
      {
        id: 'player',
        name: character?.name || 'You',
        isPlayer: true,
        initiative: rollResult.die + playerDexMod,
        hp: character?.currentHP ?? 0,
        maxHp: character?.maxHP ?? 0,
        ac: character?.AC ?? 10,
        conditions: character?.conditions || [],
        _tie: Math.random(),
      },
      ...enemies.map(e => ({
        ...e,
        isPlayer: false,
        initiative: roll(20) + (e.initiativeMod || 0),
        _tie: Math.random(),
      })),
    ]
      .sort((a, b) => b.initiative !== a.initiative ? b.initiative - a.initiative : b._tie - a._tie)
      .map(({ _tie, ...rest }) => rest);

    resolveInitiative(allCombatants); // → COMBAT_STATE

    const orderStr = allCombatants.map(t => `${t.isPlayer ? 'You' : t.name} (${t.initiative})`).join(' → ');
    addMessage({
      id: `combat_init_${Date.now()}`,
      role: 'assistant',
      content: { system_text: `Initiative — ${orderStr}` },
      personaName: selectedPersona?.name,
      personaEmoji: selectedPersona?.emoji,
      timestamp: Date.now(),
    });
  };

  // Phase 1: d20 attack roll — determines hit/miss/crit, then opens damage roller on hit
  const handleAttackPhase1 = (rollResult, targetEnemy) => {
    const profile = getPlayerCombatProfile(character);
    const dieRoll = rollResult.die;
    const isCrit = dieRoll === 20;
    const isFumble = dieRoll === 1;
    const total = dieRoll + profile.attackBonus;
    const hit = isCrit || (!isFumble && total >= targetEnemy.ac);

    if (!hit) {
      // Miss — close roller, log, end player turn
      setDiceVisible(false);
      const missText = isFumble
        ? `Fumble! Miss on ${targetEnemy.name}. (Roll: 1)`
        : `Missed ${targetEnemy.name}. (Roll: ${dieRoll}+${profile.attackBonus}=${total} vs AC ${targetEnemy.ac})`;
      addMessage({
        id: `player_attack_${Date.now()}`,
        role: 'assistant',
        content: { system_text: missText },
        personaName: selectedPersona?.name,
        personaEmoji: selectedPersona?.emoji,
        timestamp: Date.now(),
      });
      setCombatPanelMode(null);
      advanceTurn();
      return;
    }

    // Hit — show hit message then open damage roller
    if (isCrit) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const hitText = isCrit
      ? `CRITICAL HIT on ${targetEnemy.name}! (Roll: 20) Now roll damage — dice are doubled!`
      : `Hit! (Roll: ${dieRoll}+${profile.attackBonus}=${total} vs AC ${targetEnemy.ac}) Now roll damage.`;
    addMessage({
      id: `player_attack_hit_${Date.now()}`,
      role: 'assistant',
      content: { system_text: hitText },
      personaName: selectedPersona?.name,
      personaEmoji: selectedPersona?.emoji,
      timestamp: Date.now(),
    });

    // Parse weapon die sides for damage roller (e.g. '1d6' → 6)
    const diceMatch = profile.damageDice.match(/d(\d+)/i);
    const damageSides = diceMatch ? parseInt(diceMatch[1], 10) : 6;

    // Transition to phase 2: damage roll
    setPendingCombatRoll({
      type: 'damage',
      targetEnemy,
      attackResult: { isCrit, isFumble: false, roll: dieRoll, total, attackBonus: profile.attackBonus },
      damageSides,
      damageMod: profile.damageMod,
      damageDice: profile.damageDice,
    });
    // diceVisible stays true — DiceRoller re-renders with new context + sides
  };

  // Phase 2: weapon damage roll — applies damage after a confirmed hit
  const handleAttackPhase2 = async (rollResult, targetEnemy, attackResult, damageMod, damageDice, isCrit) => {
    // Critical hit doubles the die result (simplest 5e-equivalent for single-die weapons)
    const rawDamage = isCrit ? rollResult.die * 2 : rollResult.die;
    const damage = Math.max(1, rawDamage + damageMod);

    const newEnemyHp = Math.max(0, targetEnemy.hp - damage);
    applyEnemyDamage(targetEnemy.id, damage);
    const updatedEnemies = activeEnemies.map(e =>
      e.id === targetEnemy.id ? { ...e, hp: newEnemyHp } : e
    );

    const damageText = isCrit
      ? `CRITICAL HIT deals ${damage} damage to ${targetEnemy.name}! (${rollResult.die}×2${damageMod !== 0 ? `${damageMod >= 0 ? '+' : ''}${damageMod}` : ''}) [${targetEnemy.name}: ${newEnemyHp}/${targetEnemy.maxHp} HP]`
      : `You deal ${damage} damage to ${targetEnemy.name}. (Roll: ${rollResult.die}${damageMod !== 0 ? `${damageMod >= 0 ? '+' : ''}${damageMod}` : ''}) [${targetEnemy.name}: ${newEnemyHp}/${targetEnemy.maxHp} HP]`;

    addMessage({
      id: `player_damage_${Date.now()}`,
      role: 'assistant',
      content: { system_text: damageText },
      personaName: selectedPersona?.name,
      personaEmoji: selectedPersona?.emoji,
      timestamp: Date.now(),
    });

    setCombatPanelMode(null);
    advanceTurn();
    if (updatedEnemies.every(e => e.hp <= 0)) {
      await checkCombatEnd(updatedEnemies);
    }
  };

  const resolveEnemyTurn = () => {
    const activeCombatant = combatTurnOrder[activeTurnIndex];
    if (!activeCombatant || activeCombatant.isPlayer) return;

    const enemy = activeEnemies.find(e => e.id === activeCombatant.id || e.name === activeCombatant.name);
    if (!enemy || enemy.hp <= 0) {
      advanceTurn();
      return;
    }

    const attackResult = resolveAttack(enemy.attackBonus, character?.AC || 10);
    let damage = 0;
    let playerHpAfter = character?.currentHP || 0;

    if (attackResult.hit) {
      const dmgResult = rollDamage(enemy.damageDice, attackResult.isCrit);
      damage = dmgResult.total;
      playerHpAfter = Math.max(0, (character?.currentHP || 0) - damage);
      applyPlayerCombatDamage(damage);
      if (playerHpAfter === 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const logText = attackResult.isCrit
      ? `${enemy.name} lands a CRITICAL HIT for ${damage} damage! [Your HP: ${playerHpAfter}/${character?.maxHP}]`
      : attackResult.hit
      ? `${enemy.name} strikes you for ${damage} damage. (Roll: ${attackResult.roll}+${enemy.attackBonus}=${attackResult.total} vs AC ${character?.AC}) [Your HP: ${playerHpAfter}/${character?.maxHP}]`
      : `${enemy.name} swings at you but misses. (Roll: ${attackResult.roll}+${enemy.attackBonus}=${attackResult.total} vs AC ${character?.AC})`;

    addMessage({
      id: `enemy_turn_${Date.now()}`,
      role: 'assistant',
      content: { system_text: logText },
      personaName: selectedPersona?.name,
      personaEmoji: selectedPersona?.emoji,
      timestamp: Date.now(),
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceTurn();
  };

  const handleEnemyAction = (enemyAction) => {
    if (!enemyAction?.name) return;

    const enemy = activeEnemies.find(e => e.name === enemyAction.name) || {
      name: enemyAction.name,
      attackBonus: 3,
      damageDice: '1d6',
    };

    const attackResult = resolveAttack(enemy.attackBonus, character?.AC || 10);
    let damage = 0;
    let playerHpAfter = character?.currentHP || 0;

    if (attackResult.hit) {
      const dmgResult = rollDamage(enemy.damageDice, attackResult.isCrit);
      damage = dmgResult.total;
      playerHpAfter = Math.max(0, (character?.currentHP || 0) - damage);
      applyPlayerCombatDamage(damage);
      if (playerHpAfter === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    advanceTurn();

    const resultText = formatEnemyTurn({
      enemyName: enemy.name,
      attackResult,
      damage,
      playerAC: character?.AC || 10,
      playerHpAfter,
    });
    addMessage({
      id: `enemy_turn_${Date.now()}`,
      role: 'assistant',
      content: { system_text: resultText },
      personaName: selectedPersona?.name,
      personaEmoji: selectedPersona?.emoji,
      timestamp: Date.now(),
    });
  };

  // Reset combat panel when leaving COMBAT_STATE
  useEffect(() => {
    if (combatState !== 'COMBAT_STATE') {
      setCombatPanelMode(null);
      setCustomCombatText('');
    }
  }, [combatState]);

  const hasSpells = Object.values(character?.spellSlots || {}).some(slots => slots > 0);

  const handleCombatAttack = (targetEnemy) => {
    setCombatPanelMode(null);
    setPendingCombatRoll({ type: 'attack', targetEnemy });
    setDiceVisible(true);
  };

  // Called with locally-updated enemy list. Makes exactly 1 API call for the outro.
  const checkCombatEnd = async (updatedEnemies, force = false, outcome = null) => {
    if (!force && !updatedEnemies.every(e => e.hp <= 0)) return;

    endCombat(); // → COMBAT_RESOLUTION (hides action panel)

    // Client-generated banner — persists in local state so it survives resetCombat()
    const outcomeLabel = outcome || (updatedEnemies.every(e => e.hp <= 0) ? 'Victory' : 'Combat Ended');
    const bannerText = `⚔️ COMBAT ENDED — ${outcomeLabel}`;
    addMessage({
      id: `combat_end_${Date.now()}`,
      role: 'assistant',
      content: { system_text: bannerText },
      personaName: selectedPersona?.name,
      personaEmoji: selectedPersona?.emoji,
      timestamp: Date.now(),
    });
    setCombatEndBanner(bannerText);

    const summary = buildCombatSummary({
      enemies: updatedEnemies,
      rounds: combatRound,
      playerHpStart: playerHpAtCombatStart,
      playerHpEnd: character?.currentHP ?? 0,
    });

    setLoading(true);
    try {
      const apiMessages = getDMApiMessages();
      apiMessages.push({ role: 'user', content: `[Combat resolved] ${summary} Narrate the outcome and aftermath briefly.` });
      const dmResponse = await callDM({
        messages: apiMessages,
        character, campaign: selectedCampaign, persona: selectedPersona,
        messageCount: playerTurnCount.current, sessionFlags,
        worldRegistry, campaignMemory,
      });
      addMessage({
        id: `dm_${Date.now()}`, role: 'assistant', content: dmResponse,
        personaName: selectedPersona?.name || 'The Chronicler',
        personaEmoji: selectedPersona?.emoji || '📜', timestamp: Date.now(),
      });
      if (dmResponse.tone) setTone(dmResponse.tone);
      if (dmResponse.scene_tag) setSceneTag(dmResponse.scene_tag);
    } catch (_) {
      addMessage({
        id: `err_${Date.now()}`, role: 'assistant',
        content: { narration: 'The dust settles after the battle.' },
        personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
      resetCombat(); // → EXPLORATION
    }
  };

  const [inputText, setInputText] = useState('');
  const [diceVisible, setDiceVisible] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const [chronicleVisible, setChronicleVisible] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [lootCard, setLootCard] = useState(null);
  const [combatPanelMode, setCombatPanelMode] = useState(null); // null | 'attack'
  const [customCombatText, setCustomCombatText] = useState('');
  const [pendingCombatRoll, setPendingCombatRoll] = useState(null); // null | { type: 'initiative', enemies } | { type: 'attack', targetEnemy }
  const [waitingForInitiative, setWaitingForInitiative] = useState(false);
  const [combatEndBanner, setCombatEndBanner] = useState(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Monetisation not yet implemented — always false until RevenueCat/IAP is wired
  const isAtLimit = false;

  // ── Player-turn counter — used for mechanic nudge thresholds ─────────────────
  const turnCount = useRef(0);
  // One-shot directive injected on the first round narration call after first combat starts
  const firstCombatDirective = useRef(null);

  const scrollRef = useRef(null);
  const typingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (messages.length === 0) sendOpeningMessage();
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.stopAnimation();
      typingAnim.setValue(0);
    }
  }, [isLoading]);

  const triggerChronicle = async () => {
    setIsGeneratingSummary(true);
    try {
      const { summary, epithet } = await generateSessionSummary({
        character, campaign: selectedCampaign, sessionFlags, npcMemory, messages,
      });
      setSessionSummary(summary, epithet);
    } catch (_) {}
    setIsGeneratingSummary(false);
    setChronicleVisible(true);
  };

  const getDMApiMessages = () =>
    (messages || [])
      .filter(m => m.displayText !== null || m.role === 'assistant')
      .map(m => ({
        role: m.role,
        content: m.role === 'user'
          ? (m.displayText || m.content)
          : JSON.stringify(m.content),
      }));

  const sendOpeningMessage = async () => {
    setLoading(true);
    try {
      const openingMsg = {
        id: 'opening', role: 'user',
        content: 'Begin the adventure. Set the scene and draw me into the world.',
        displayText: null, timestamp: Date.now(),
      };
      addMessage(openingMsg);

      const dmResponse = await callDM({
        messages: [{ role: 'user', content: openingMsg.content }],
        character, campaign: selectedCampaign, persona: selectedPersona,
        sessionFlags, worldRegistry, campaignMemory,
      });

      addMessage({
        id: `dm_${Date.now()}`, role: 'assistant', content: dmResponse,
        personaName: selectedPersona?.name || 'The Chronicler',
        personaEmoji: selectedPersona?.emoji || '📜', timestamp: Date.now(),
      });
      if (dmResponse.state_updates) applyStateUpdates(dmResponse.state_updates);
      if (dmResponse.tone) setTone(dmResponse.tone);
      if (dmResponse.scene_tag) setSceneTag(dmResponse.scene_tag);
      if (dmResponse.requires_roll) {
        if (!seenMechanics.has('skill_check')) markMechanicSeen('skill_check');
        setPendingRoll(dmResponse.requires_roll);
        setDiceVisible(true);
      }
      if (dmResponse.combat_start) { playSfx('combat_start'); handleCombatStart(dmResponse); }
      if (dmResponse.combat_end) checkCombatEnd(activeEnemies, true);
    } catch (err) {
      addMessage({ id: `err_${Date.now()}`, role: 'assistant', content: { narration: 'The chronicler pauses... (Connection issue — try again.)' }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  };

  // Returns a directive for the DM if a key mechanic hasn't been seen yet,
  // or consumes the first-combat one-shot directive if set.
  const getMechanicNudge = () => {
    if (firstCombatDirective.current) {
      const directive = firstCombatDirective.current;
      firstCombatDirective.current = null;
      return directive;
    }
    if (!seenMechanics.has('skill_check') && turnCount.current >= 3)
      return 'Note: weave in a Perception or Investigation skill check naturally this turn.';
    if (seenMechanics.has('skill_check') && !seenMechanics.has('combat') && turnCount.current >= 6)
      return 'Note: introduce a threatening situation that leads to combat this turn.';
    if (seenMechanics.has('combat') && !seenMechanics.has('inventory') && turnCount.current >= 12)
      return 'Note: include a reward, loot drop, or item that prompts the player to use their inventory.';
    return null;
  };

  // isCombatInternal: true when called programmatically (combat summary), doesn't count as player turn
  const sendMessage = useCallback(async (text, isCombatInternal = false) => {
    if (!text.trim() || isLoading) return;

    if (!isCombatInternal) turnCount.current += 1;
    if (combatEndBanner) setCombatEndBanner(null);

    const userMsg = {
      id: `user_${Date.now()}`, role: 'user',
      content: text.trim(), displayText: text.trim(), timestamp: Date.now(),
    };
    addMessage(userMsg);
    setInputText('');
    Keyboard.dismiss();
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const apiMessages = getDMApiMessages();
      apiMessages.push({ role: 'user', content: text.trim() });

      const dmResponse = await callDM({
        messages: apiMessages,
        character, campaign: selectedCampaign, persona: selectedPersona,
        sessionFlags, mechanicNudge: getMechanicNudge(),
        worldRegistry, campaignMemory,
      });

      addMessage({
        id: `dm_${Date.now()}`, role: 'assistant', content: dmResponse,
        personaName: selectedPersona?.name || 'The Chronicler',
        personaEmoji: selectedPersona?.emoji || '📜', timestamp: Date.now(),
      });

      if (dmResponse.state_updates) {
        applyStateUpdates(dmResponse.state_updates);
        if (dmResponse.state_updates.add_items?.length) {
          setLootCard({ items: dmResponse.state_updates.add_items, gold: dmResponse.state_updates.gold_change });
          if (!seenMechanics.has('inventory')) markMechanicSeen('inventory');
        }
      }

      // ── Audio / art ──────────────────────────────────────────────────────────
      if (dmResponse.tone) setTone(dmResponse.tone);
      if (dmResponse.scene_tag) setSceneTag(dmResponse.scene_tag);

      // ── Mechanic seen tracking ────────────────────────────────────────────────
      if (dmResponse.requires_roll && !seenMechanics.has('skill_check')) {
        markMechanicSeen('skill_check');
      }

      // ── Combat state transitions ──────────────────────────────────────────────
      if (dmResponse.combat_start) {
        playSfx('combat_start');
        if (!seenMechanics.has('combat')) {
          firstCombatDirective.current = "IMPORTANT: This is the player's first combat. Make the enemy weak — low HP, low AC. The fight should feel satisfying, not threatening.";
          markMechanicSeen('combat');
        }
        handleCombatStart(dmResponse);
      }
      if (dmResponse.combat_end) {
        checkCombatEnd(activeEnemies, true);
      }
      if (dmResponse.enemy_action && combatState === 'COMBAT_STATE') {
        handleEnemyAction(dmResponse.enemy_action);
      }

      if (dmResponse.requires_roll) {
        setPendingRoll(dmResponse.requires_roll);
        setDiceVisible(true);
      }

      if (dmResponse.system_text?.toLowerCase().includes('critical')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

    } catch (err) {
      addMessage({ id: `err_${Date.now()}`, role: 'assistant', content: { narration: 'The chronicler stumbles... (Something went wrong. Try again.)' }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  }, [isLoading, messages, character, selectedCampaign, selectedPersona, sessionFlags,
      seenMechanics, markMechanicSeen, addMessage, setLoading, applyStateUpdates,
      combatState, activeEnemies, combatRound, playerHpAtCombatStart,
      handleCombatStart, handleEnemyAction, resetCombat, setTone, setSceneTag]);

  const handleRollComplete = useCallback((rollResult) => {
    setIsPeeking(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Route combat rolls — no API call, handled client-side
    if (pendingCombatRoll?.type === 'initiative') {
      setDiceVisible(false);
      handleInitiativeRoll(rollResult, pendingCombatRoll.enemies);
      setPendingCombatRoll(null);
      return;
    }
    if (pendingCombatRoll?.type === 'attack') {
      // Do NOT close the roller here — handleAttackPhase1 decides:
      //   miss → closes roller itself; hit → keeps roller open for damage phase
      const { targetEnemy } = pendingCombatRoll;
      setPendingCombatRoll(null); // phase1 will re-set to 'damage' on hit
      handleAttackPhase1(rollResult, targetEnemy);
      return;
    }
    if (pendingCombatRoll?.type === 'damage') {
      setDiceVisible(false);
      const { targetEnemy, attackResult, damageMod, damageDice } = pendingCombatRoll;
      const isCrit = attackResult?.isCrit ?? false;
      setPendingCombatRoll(null);
      handleAttackPhase2(rollResult, targetEnemy, attackResult, damageMod ?? 0, damageDice, isCrit);
      return;
    }

    // Regular skill check → close roller and send to DM
    setDiceVisible(false);
    const mod = rollResult.modifier || 0;
    const rollText = pendingRoll
      ? `I rolled a ${rollResult.die} for my ${pendingRoll.skill} check. With my modifier of ${mod >= 0 ? '+' + mod : mod}, my total is ${rollResult.total}.${rollResult.isCrit ? ' Natural 20!' : rollResult.isFumble ? ' Natural 1.' : ''} ${rollResult.success !== null ? (rollResult.success ? 'I succeeded.' : 'I failed.') : ''}`
      : `I rolled a ${rollResult.die} on the d${rollResult.sides}.`;
    setPendingRoll(null);
    sendMessage(rollText);
  }, [pendingRoll, pendingCombatRoll, sendMessage, handleInitiativeRoll, handleAttackPhase1, handleAttackPhase2]);

  const handleQuickAction = (action) => sendMessage(action);

  const lastDMMessage = [...(messages || [])].reverse().find(m => m.role === 'assistant');
  const lastPlayerMessage = [...(messages || [])].reverse().find(m => m.role === 'user' && m.displayText)?.displayText || null;
  const suggestedActions = lastDMMessage?.content?.suggested_actions || [];
  // Last N system_text messages for the combat log strip
  const combatSystemMessages = (messages || [])
    .filter(m => m.role === 'assistant' && m.content?.system_text)
    .slice(-5);

  const activeCombatant = combatTurnOrder[activeTurnIndex];
  const isPlayerTurn = activeCombatant?.isPlayer === true;

  // Derive advantage/disadvantage for dice roller from active conditions
  const playerCombatant = combatTurnOrder.find(c => c.isPlayer);
  const activeConditions = [
    ...(playerCombatant?.conditions || []),
    ...(character?.conditions || []),
  ];
  // Check target enemy conditions — Stunned/Prone grant attacker advantage
  const targetEnemyCombatant = pendingCombatRoll?.targetEnemy
    ? combatTurnOrder.find(c => c.id === pendingCombatRoll.targetEnemy.id || c.name === pendingCombatRoll.targetEnemy.name)
    : null;
  const targetConditions = targetEnemyCombatant?.conditions || [];
  const rollHasAdvantage =
    activeConditions.some(c => ['Advantage', 'Blessed', 'Helped', 'Reckless Attack'].includes(c)) ||
    targetConditions.some(c => ['Stunned', 'Prone', 'Paralyzed', 'Unconscious'].includes(c));
  const rollHasDisadvantage =
    activeConditions.some(c => ['Disadvantage', 'Poisoned', 'Frightened', 'Prone', 'Exhaustion', 'Restrained'].includes(c));

  const hpColor = getHpColor(character?.currentHP ?? 1, character?.maxHP ?? 1);
  const hpPct = character?.maxHP > 0 ? (character.currentHP ?? 0) / character.maxHP : 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Audio managers — render null, handle gameplay music and SFX */}
      <GameplayMusicManager />
      <SfxManager />

      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.background, '#080614']} style={StyleSheet.absoluteFill} />

      {/* ── HUD ── */}
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <TouchableOpacity style={styles.hudExitBtn} onPress={handleSaveAndExit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.hudExitText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hudPortrait} onPress={() => setCharSheetVisible(true)}>
            <Text style={styles.hudPortraitEmoji}>{character?.race?.emoji || '⚔️'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.hudName} numberOfLines={1}>{character?.name}</Text>
            <Text style={styles.hudSub} numberOfLines={1}>{character?.race?.name} {character?.class?.name} · Lv {character?.level}</Text>
          </View>
        </View>
        <View style={styles.hudRight}>
          <TouchableOpacity style={styles.hudSettingsBtn} onPress={() => setSettingsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.hudSettingsText}>⚙</Text>
          </TouchableOpacity>
          <Text style={[styles.hudHp, { color: hpColor }]}>{character?.currentHP}/{character?.maxHP} HP</Text>
          <View style={styles.hpBarBg}>
            <View style={[styles.hpBarFill, { width: `${hpPct * 100}%`, backgroundColor: hpColor }]} />
          </View>
          <Text style={styles.hudAc}>AC {character?.AC}</Text>
        </View>
      </View>

      {/* ── Combat HUD ── */}
      <CombatHUD
        combatState={combatState}
        combatTurnOrder={combatTurnOrder}
        activeTurnIndex={activeTurnIndex}
        combatRound={combatRound}
        playerConditions={character?.conditions}
      />

      {/* ── Focused story view ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* ── Battlefield layout (COMBAT_STATE only) ── */}
        {combatState === 'COMBAT_STATE' ? (
          <View style={styles.combatBattlefield}>
            <EnemyZone
              activeEnemies={activeEnemies}
              isAttacking={combatPanelMode === 'attack'}
              onSelectEnemy={(enemy) => {
                handleCombatAttack(enemy);
                setCombatPanelMode(null);
              }}
            />
            <CombatLogStrip messages={combatSystemMessages} />
            {lastDMMessage?.content?.narration && (
              <View style={styles.combatNarrationBlock}>
                <DMMessage message={lastDMMessage} />
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Current DM response — scrollable if long */}
            <ScrollView
              style={styles.storyArea}
              contentContainerStyle={styles.storyContent}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="interactive"
            >
              {/* Campaign bar */}
              <View style={styles.campaignBar}>
                <Text style={styles.campaignBarTitle}>
                  {selectedCampaign?.emoji}  {selectedCampaign?.title}
                </Text>
                <TouchableOpacity onPress={() => setHistoryVisible(true)} style={styles.historyBtn}>
                  <Text style={styles.historyBtnText}>History</Text>
                </TouchableOpacity>
              </View>

              {/* Player's last visible action — hidden when combat end banner is showing */}
              {lastPlayerMessage && !combatEndBanner && (
                <View style={styles.playerEcho}>
                  <Text style={styles.playerEchoLabel}>You</Text>
                  <Text style={styles.playerEchoText} numberOfLines={2}>{lastPlayerMessage}</Text>
                </View>
              )}

              {/* Loading / current DM response */}
              {isLoading ? (
                <Animated.View style={[styles.typingRow, { opacity: typingAnim }]}>
                  <Text style={styles.typingEmoji}>{selectedPersona?.emoji || '📜'}</Text>
                  <View style={styles.typingBubble}>
                    <Text style={styles.typingLabel}>
                      {PERSONA_TYPING[selectedPersona?.id] || 'The tale unfolds…'}
                    </Text>
                  </View>
                </Animated.View>
              ) : lastDMMessage ? (
                <>
                  {combatEndBanner && (
                    <DMMessage message={{ id: 'combat_end_banner', role: 'assistant', content: { system_text: combatEndBanner } }} />
                  )}
                  <DMMessage message={lastDMMessage} />
                </>
              ) : null}

              {isAtLimit && !isGeneratingSummary && !chronicleVisible && (
                <View style={styles.sessionEndNote}>
                  <Text style={styles.sessionEndText}>Session complete — your Chronicle is being written…</Text>
                </View>
              )}
            </ScrollView>

            {/* ── Suggested actions (hidden during COMBAT_STATE) ── */}
            {suggestedActions.length > 0 && !isLoading && !isAtLimit && !diceVisible && (
              <View style={styles.actionsContainer}>
                {suggestedActions.map((action, i) => (
                  <TouchableOpacity key={i} style={styles.actionChip} onPress={() => handleQuickAction(action)}>
                    <Text style={styles.actionChipText}>{action}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

{/* ── Death save UI (replaces input bar when DOWNED) ── */}
        {combatState === 'DOWNED' && (
          <View style={styles.deathSaveBar}>
            <View style={styles.deathSavePips}>
              <Text style={styles.deathSaveLabel}>Successes</Text>
              <View style={styles.pipRow}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[styles.pip, i < deathSaves.successes && styles.pipSuccess]} />
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.deathSaveBtn, isLoading && styles.sendBtnDisabled]}
              onPress={() => {
                if (isLoading) return;
                const result = rollDeathSave();
                updateDeathSave(result);
                const outcomeText = result.isCritical
                  ? 'Natural 20 — you claw back to 1 HP!'
                  : result.isFumble
                  ? 'Natural 1 — two failures!'
                  : result.success
                  ? 'Success.'
                  : 'Failure.';
                addMessage({
                  id: `death_save_${Date.now()}`,
                  role: 'assistant',
                  content: { system_text: `Death save: ${result.roll} — ${outcomeText}` },
                  personaName: selectedPersona?.name,
                  personaEmoji: selectedPersona?.emoji,
                  timestamp: Date.now(),
                });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }}
              disabled={isLoading}
            >
              <Text style={styles.deathSaveBtnText}>Roll Death Save (d20)</Text>
            </TouchableOpacity>
            <View style={styles.deathSavePips}>
              <Text style={styles.deathSaveLabel}>Failures</Text>
              <View style={styles.pipRow}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[styles.pip, i < deathSaves.failures && styles.pipFailure]} />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Combat Action Panel (replaces freeform input during COMBAT_STATE) ── */}
        {combatState === 'COMBAT_STATE' && !diceVisible && !isAtLimit && (
          <View style={styles.combatPanel}>
            {!isPlayerTurn ? (
              // Enemy turn: tap to auto-resolve (no API call)
              <TouchableOpacity
                style={styles.enemyTurnBtn}
                onPress={resolveEnemyTurn}
                disabled={isLoading}
              >
                <Text style={styles.enemyTurnBtnText}>
                  Resolve {activeCombatant?.name}'s turn →
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                {combatPanelMode === 'attack' && (
                  <View style={styles.attackModeBar}>
                    <Text style={styles.attackModeLabel}>↑ Tap a target above</Text>
                    <TouchableOpacity onPress={() => setCombatPanelMode(null)}>
                      <Text style={styles.attackModeCancel}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.combatPanelRow}>
                  <TouchableOpacity
                    style={[styles.combatActionBtn, combatPanelMode === 'attack' && styles.combatActionBtnActive]}
                    onPress={() => setCombatPanelMode(combatPanelMode === 'attack' ? null : 'attack')}
                    disabled={isLoading}
                  >
                    <Text style={styles.combatActionIcon}>⚔️</Text>
                    <Text style={styles.combatActionLabel}>Attack</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.combatActionBtn} onPress={() => {
                    addMessage({ id: `combat_${Date.now()}`, role: 'assistant', content: { system_text: `${character?.name || 'You'} dashes — movement doubled this turn.` }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
                    advanceTurn();
                  }} disabled={isLoading}>
                    <Text style={styles.combatActionIcon}>🏃</Text>
                    <Text style={styles.combatActionLabel}>Dash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.combatActionBtn} onPress={() => {
                    addMessage({ id: `combat_${Date.now()}`, role: 'assistant', content: { system_text: `${character?.name || 'You'} takes the Dodge action — attackers have disadvantage until next turn.` }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
                    advanceTurn();
                  }} disabled={isLoading}>
                    <Text style={styles.combatActionIcon}>🛡️</Text>
                    <Text style={styles.combatActionLabel}>Dodge</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.combatActionBtn} onPress={() => {
                    addMessage({ id: `combat_${Date.now()}`, role: 'assistant', content: { system_text: `${character?.name || 'You'} uses Help — an ally gains advantage on their next roll.` }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
                    advanceTurn();
                  }} disabled={isLoading}>
                    <Text style={styles.combatActionIcon}>🙋</Text>
                    <Text style={styles.combatActionLabel}>Help</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.combatPanelRow}>
                  <TouchableOpacity style={styles.combatActionBtnSecondary} onPress={() => {
                    addMessage({ id: `combat_${Date.now()}`, role: 'assistant', content: { system_text: `${character?.name || 'You'} uses an item.` }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
                    advanceTurn();
                  }} disabled={isLoading}>
                    <Text style={styles.combatActionIcon}>🧪</Text>
                    <Text style={[styles.combatActionLabel, styles.combatActionLabelSecondary]}>Use Item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.combatActionBtnSecondary, !hasSpells && styles.combatActionBtnDisabled]}
                    onPress={() => {
                      addMessage({ id: `combat_${Date.now()}`, role: 'assistant', content: { system_text: `${character?.name || 'You'} casts a spell.` }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
                      advanceTurn();
                    }}
                    disabled={isLoading || !hasSpells}
                  >
                    <Text style={styles.combatActionIcon}>📜</Text>
                    <Text style={[styles.combatActionLabel, styles.combatActionLabelSecondary, !hasSpells && styles.combatActionLabelDisabled]}>Spells</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.combatActionBtnSecondary} onPress={() => {
                    addMessage({ id: `combat_${Date.now()}`, role: 'assistant', content: { system_text: `${character?.name || 'You'} taunts the enemy with a battle cry.` }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
                    advanceTurn();
                  }} disabled={isLoading}>
                    <Text style={styles.combatActionIcon}>💬</Text>
                    <Text style={[styles.combatActionLabel, styles.combatActionLabelSecondary]}>Taunt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.combatActionBtnSecondary}
                    onPress={() => Alert.alert('Flee?', 'Attempt to disengage and flee combat?', [
                      { text: 'Stay', style: 'cancel' },
                      { text: 'Flee', onPress: () => {
                        checkCombatEnd(activeEnemies, true, 'You Fled');
                      }},
                    ])}
                    disabled={isLoading}
                  >
                    <Text style={styles.combatActionIcon}>🚪</Text>
                    <Text style={[styles.combatActionLabel, styles.combatActionLabelSecondary]}>Flee</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Input bar ── */}
        {!diceVisible && !isAtLimit && combatState !== 'DOWNED' && combatState !== 'COMBAT_STATE' && combatState !== 'COMBAT_INIT' && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder={combatState === 'COMBAT_STATE' ? 'Describe your attack or action…' : 'What do you do?'}
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage(inputText)}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
            >
              <Text style={styles.sendBtnText}>→</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── History modal ── */}
      <Modal visible={historyVisible} animationType="slide" transparent onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.historyBackdrop}>
          <View style={styles.historySheet}>
            <View style={styles.historyHandle} />
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Adventure Log</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.historyClose}>
                <Text style={styles.historyCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.historyScroll}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              {messages
                .filter(m => m.displayText !== null || m.role === 'assistant')
                .map(m => <DMMessage key={m.id} message={m} />)
              }
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Dice Roller (rendered as absolute overlay, not modal) ── */}
      {diceVisible && (
        <DiceRoller
          visible={diceVisible}
          onRollComplete={handleRollComplete}
          requiredRoll={pendingCombatRoll ? null : pendingRoll}
          character={character}
          isPeeking={isPeeking}
          onPeekToggle={() => setIsPeeking(p => !p)}
          rollContext={
            pendingCombatRoll?.type === 'initiative' ? 'Roll for Initiative'
            : pendingCombatRoll?.type === 'attack' ? 'Attack Roll'
            : pendingCombatRoll?.type === 'damage' ? `Damage Roll — ${pendingCombatRoll?.targetEnemy?.name}`
            : pendingRoll?.skill ? `${pendingRoll.skill} Check`
            : null
          }
          requiredSides={
            pendingCombatRoll?.type === 'damage' ? pendingCombatRoll?.damageSides
            : pendingCombatRoll?.type ? 20
            : undefined
          }
          hasAdvantage={rollHasAdvantage}
          hasDisadvantage={rollHasDisadvantage}
          selectedSkin={preferences?.diceSkin || 'default'}
        />
      )}

      {/* ── Loot card ── */}
      {lootCard && (
        <Modal transparent animationType="fade" visible={!!lootCard} onRequestClose={() => setLootCard(null)}>
          <TouchableOpacity style={styles.lootOverlay} onPress={() => setLootCard(null)} activeOpacity={1}>
            <View style={styles.lootCard}>
              <Text style={styles.lootTitle}>⚔ Loot Found</Text>
              {lootCard.items?.map((item, i) => (
                <Text key={i} style={styles.lootItem}>• {item}</Text>
              ))}
              {lootCard.gold > 0 && <Text style={styles.lootGold}>+ {lootCard.gold} gold pieces</Text>}
              <Text style={styles.lootDismiss}>Tap to continue</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Character Sheet ── */}
      <Modal visible={charSheetVisible} animationType="slide" transparent onRequestClose={() => setCharSheetVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.charSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName}>{character?.name}</Text>
                <Text style={styles.sheetMeta}>{character?.race?.name} {character?.class?.name} · Level {character?.level}</Text>
              </View>
              <TouchableOpacity onPress={() => setCharSheetVisible(false)} style={styles.sheetDoneBtn}>
                <Text style={styles.sheetDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              {/* Vitals */}
              <View style={styles.sheetVitals}>
                {[
                  { label: 'HP', value: `${character?.currentHP}/${character?.maxHP}`, color: hpColor },
                  { label: 'AC', value: character?.AC, color: COLORS.textSystem },
                  { label: 'Speed', value: `${character?.speed}ft`, color: COLORS.textSecondary },
                  { label: 'Prof', value: `+${character?.proficiencyBonus}`, color: COLORS.primary },
                ].map(({ label, value, color }) => (
                  <View key={label} style={styles.vitalCell}>
                    <Text style={[styles.vitalValue, { color }]}>{value}</Text>
                    <Text style={styles.vitalLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              {/* Ability scores */}
              <Text style={styles.sheetSection}>Ability Scores</Text>
              <View style={styles.abilityGrid}>
                {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(key => {
                  const score = character?.abilityScores?.[key] || 10;
                  const mod = Math.floor((score - 10) / 2);
                  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                  return (
                    <View key={key} style={styles.abilityCell}>
                      <Text style={[styles.abilityCellMod, { color: mod >= 0 ? COLORS.success : COLORS.hpLow }]}>{modStr}</Text>
                      <Text style={styles.abilityCellScore}>{score}</Text>
                      <Text style={styles.abilityCellKey}>{key}</Text>
                    </View>
                  );
                })}
              </View>
              {/* Proficient skills */}
              {character?.proficientSkills?.length > 0 && (
                <>
                  <Text style={styles.sheetSection}>Proficiencies</Text>
                  <View style={styles.skillsWrap}>
                    {character.proficientSkills.map((s, i) => (
                      <View key={i} style={styles.skillTag}>
                        <Text style={styles.skillTagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {/* Equipment */}
              {character?.inventory?.length > 0 && (
                <>
                  <Text style={styles.sheetSection}>Equipment</Text>
                  {character.inventory.map((item, i) => (
                    <Text key={i} style={styles.sheetListItem}>• {item}</Text>
                  ))}
                </>
              )}
              {character?.gold > 0 && (
                <Text style={styles.sheetGold}>{character.gold} gold pieces</Text>
              )}
              {/* Conditions */}
              {character?.conditions?.length > 0 && (
                <>
                  <Text style={styles.sheetSection}>Conditions</Text>
                  {character.conditions.map((c, i) => (
                    <Text key={i} style={[styles.sheetListItem, { color: COLORS.danger }]}>⚠ {c}</Text>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Chronicle Card ── */}
      {chronicleVisible && (
        <Modal transparent animationType="slide" visible={chronicleVisible} onRequestClose={() => setChronicleVisible(false)}>
          <ChronicleCard
            summary={sessionSummary || 'Your adventure continues to unfold…'}
            epithet={epithet}
            character={character}
            campaign={selectedCampaign}
            persona={selectedPersona}
            onClose={() => setChronicleVisible(false)}
            onNewGame={() => { setChronicleVisible(false); resetSession(); navigation.navigate('CampaignSelect'); }}
          />
        </Modal>
      )}

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  hud: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm, backgroundColor: COLORS.surface + 'CC' },
  hudLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  hudExitBtn: { paddingRight: 2 },
  hudExitText: { color: COLORS.textMuted, fontSize: 20, lineHeight: 24 },
  hudPortrait: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primaryDark },
  hudPortraitEmoji: { fontSize: 18 },
  hudName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  hudSub: { color: COLORS.textMuted, fontSize: 10 },
  hudRight: { alignItems: 'flex-end' },
  hudSettingsBtn: { alignSelf: 'flex-end', marginBottom: 2 },
  hudSettingsText: { fontSize: 14, color: COLORS.textMuted },
  hudHp: { fontSize: 12, fontWeight: '700' },
  hpBarBg: { width: 80, height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginTop: 2, marginBottom: 2, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 2 },
  hudAc: { color: COLORS.textMuted, fontSize: 10 },

  warnBar: { backgroundColor: COLORS.warning + '33', paddingVertical: 6, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.warning + '55' },
  warnText: { color: COLORS.warning, fontSize: 12, textAlign: 'center' },

  // ── Story area (focused single-response) ───────────────────────────────────
  storyArea: { flex: 1 },
  storyContent: { padding: SPACING.md, paddingBottom: SPACING.xxl, flexGrow: 1 },

  campaignBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  campaignBarTitle: { fontFamily: 'Georgia', fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', flex: 1 },
  historyBtn: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },
  historyBtnText: { fontSize: 12, color: COLORS.textMuted, textDecorationLine: 'underline' },

  playerEcho: { marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  playerEchoLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  playerEchoText: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 20 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingTop: SPACING.sm },
  typingEmoji: { fontSize: 20 },
  typingBubble: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  typingLabel: { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic' },

  sessionEndNote: { alignItems: 'center', paddingTop: SPACING.xl },
  sessionEndText: { color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic' },

  // ── Suggested actions ───────────────────────────────────────────────────────
  actionsContainer: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md, gap: 6 },
  actionChip: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  actionChipText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, fontWeight: '400' },

  // ── Death save bar ───────────────────────────────────────────────────────────
  deathSaveBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.sm, paddingHorizontal: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.danger + '88', backgroundColor: COLORS.surface + 'EE', gap: SPACING.sm },
  deathSavePips: { alignItems: 'center', gap: 4 },
  deathSaveLabel: { color: COLORS.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
  pipRow: { flexDirection: 'row', gap: 4 },
  pip: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  pipSuccess: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  pipFailure: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  deathSaveBtn: { flex: 1, backgroundColor: COLORS.danger + 'DD', borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.danger },
  deathSaveBtnText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '800', letterSpacing: 0.3 },

  // ── Input bar ───────────────────────────────────────────────────────────────
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.xs, padding: SPACING.sm, paddingHorizontal: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  input: { flex: 1, backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, color: COLORS.textPrimary, fontSize: 15, paddingHorizontal: SPACING.sm, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText: { color: COLORS.background, fontSize: 18, fontWeight: '800' },

  // ── History modal ────────────────────────────────────────────────────────────
  historyBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  historySheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, borderTopWidth: 1, borderColor: COLORS.border, maxHeight: '88%' },
  historyHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  historyTitle: { fontFamily: 'Georgia', fontSize: 18, color: COLORS.textPrimary, fontWeight: '700' },
  historyClose: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },
  historyCloseText: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
  historyScroll: { padding: SPACING.md, paddingBottom: SPACING.xl },

  // ── Character Sheet ──────────────────────────────────────────────────────────
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  charSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, borderTopWidth: 1, borderColor: COLORS.border, maxHeight: '90%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sheetName: { fontFamily: 'Georgia', fontSize: FONT_SIZES.xl, color: COLORS.textPrimary, fontWeight: '700' },
  sheetMeta: { fontFamily: 'System', fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  sheetDoneBtn: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },
  sheetDoneText: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
  sheetScroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  sheetVitals: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  vitalCell: { alignItems: 'center' },
  vitalValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Georgia' },
  vitalLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  sheetSection: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginBottom: SPACING.sm, marginTop: SPACING.md },
  abilityGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  abilityCell: { alignItems: 'center', backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: 4, flex: 1, marginHorizontal: 2, borderWidth: 1, borderColor: COLORS.border },
  abilityCellMod: { fontSize: 18, fontWeight: '900', fontFamily: 'Georgia' },
  abilityCellScore: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  abilityCellKey: { fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1 },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  skillTag: { backgroundColor: COLORS.primaryFaint, borderWidth: 1, borderColor: COLORS.primaryDark, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  skillTagText: { fontSize: FONT_SIZES.xs, color: COLORS.primary, fontWeight: '600' },
  sheetListItem: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: 4 },
  sheetGold: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontStyle: 'italic', marginTop: SPACING.xs, marginBottom: SPACING.sm },

  // ── Combat Action Panel ─────────────────────────────────────────────────────
  combatPanel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.accentDanger + '44',
    backgroundColor: COLORS.surface,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  enemyTurnBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.accentDanger + '66',
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  enemyTurnBtnText: {
    color: COLORS.accentDanger,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  attackModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  attackModeLabel: {
    color: COLORS.accentDanger,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  attackModeCancel: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  combatActionBtnActive: {
    borderColor: COLORS.accentDanger,
    backgroundColor: COLORS.accentDanger + '22',
  },
  combatPanelRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  combatActionBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    gap: 3,
  },
  combatActionBtnSecondary: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    gap: 2,
  },
  combatActionBtnDisabled: {
    opacity: 0.35,
  },
  combatActionIcon: {
    fontSize: 20,
  },
  combatActionLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  combatActionLabelSecondary: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  combatActionLabelDisabled: {
    opacity: 0.5,
  },
  combatCustomBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  combatCustomText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textDecorationLine: 'underline',
  },

  // ── Loot ────────────────────────────────────────────────────────────────────
  lootOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  lootCard: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
  lootTitle: { color: COLORS.primary, fontSize: 20, fontWeight: '800', marginBottom: SPACING.sm },
  lootItem: { color: COLORS.textPrimary, fontSize: 15, marginBottom: SPACING.xs },
  lootGold: { color: COLORS.primaryLight, fontSize: 14, marginTop: SPACING.xs },
  lootDismiss: { color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.md, fontStyle: 'italic' },

  // ── Combat battlefield layout ─────────────────────────────────────────────────
  combatBattlefield: {
    flex: 1,
    flexDirection: 'column',
  },
  combatNarrationBlock: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
});
