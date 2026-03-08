// src/screens/DMConversationScreen.js
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, Modal, StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGame } from '../context/GameContext';
import { callDM, generateSessionSummary } from '../utils/claude';
import { markTutorialCompleted } from '../utils/progress';
import { getTutorialBeatInjection } from '../constants/campaigns';
import DMMessage from '../components/DMMessage';
import DiceRoller from '../components/DiceRoller';
import ChronicleCard from '../components/ChronicleCard';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

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
  } = game;

  const [isLoading, setLoading] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  // Apply structured state updates from DM JSON response
  const applyStateUpdates = (updates) => {
    if (!updates) return;
    if (updates.hp_change && character?.currentHP != null) {
      updateHP(character.currentHP + updates.hp_change);
    }
    if (updates.gold_change && character?.gold != null) {
      setCharacter({ gold: character.gold + updates.gold_change });
    }
    if (updates.add_items?.length) {
      updates.add_items.forEach(item => addToInventory(item));
    }
    if (updates.add_conditions?.length) {
      setCharacter({ conditions: [...(character?.conditions || []), ...updates.add_conditions] });
    }
    if (updates.remove_conditions?.length) {
      setCharacter({ conditions: (character?.conditions || []).filter(c => !updates.remove_conditions.includes(c)) });
    }
    if (updates.session_flags) setSessionFlags(updates.session_flags);
    if (updates.npc_memory?.length) updates.npc_memory.forEach(npc => upsertNPC(npc));
  };

  const [inputText, setInputText] = useState('');
  const [diceVisible, setDiceVisible] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const [chronicleVisible, setChronicleVisible] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [lootCard, setLootCard] = useState(null);

  // ── Player-turn message counter (only counts what player sends) ─────────────
  const playerTurnCount = useRef(0);
  const FREE_PLAYER_TURNS = 40;
  const WARN_AT = FREE_PLAYER_TURNS - 8; // warn at 32

  const isAtLimit = playerTurnCount.current >= FREE_PLAYER_TURNS;
  const isNearLimit = playerTurnCount.current >= WARN_AT && !isAtLimit;
  const turnsLeft = FREE_PLAYER_TURNS - playerTurnCount.current;

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

  // Auto-trigger Chronicle when limit is hit (after DM responds)
  const pendingLimitChronicle = useRef(false);
  useEffect(() => {
    if (pendingLimitChronicle.current && !isLoading) {
      pendingLimitChronicle.current = false;
      triggerChronicle();
    }
  }, [isLoading]);

  const triggerChronicle = async () => {
    setIsGeneratingSummary(true);
    try {
      const { summary, epithet } = await generateSessionSummary({
        character, campaign: selectedCampaign, sessionFlags, npcMemory, messages,
      });
      setSessionSummary(summary, epithet);
      if (selectedCampaign?.isTutorial) {
        await markTutorialCompleted();
      }
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

      const beatInstruction = selectedCampaign?.isTutorial
        ? getTutorialBeatInjection(1, sessionFlags) : null;

      const dmResponse = await callDM({
        messages: [{ role: 'user', content: openingMsg.content }],
        character, campaign: selectedCampaign, persona: selectedPersona,
        messageCount: 1, sessionFlags, tutorialBeatInstruction: beatInstruction,
      });

      addMessage({
        id: `dm_${Date.now()}`, role: 'assistant', content: dmResponse,
        personaName: selectedPersona?.name || 'The Chronicler',
        personaEmoji: selectedPersona?.emoji || '📜', timestamp: Date.now(),
      });
      if (dmResponse.state_updates) applyStateUpdates(dmResponse.state_updates);
      if (dmResponse.requires_roll) {
        setPendingRoll(dmResponse.requires_roll);
        setDiceVisible(true);
      }
    } catch (err) {
      addMessage({ id: `err_${Date.now()}`, role: 'assistant', content: { narration: 'The chronicler pauses... (Connection issue — try again.)' }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading || isAtLimit) return;

    playerTurnCount.current += 1;
    const hitLimit = playerTurnCount.current >= FREE_PLAYER_TURNS;

    const userMsg = {
      id: `user_${Date.now()}`, role: 'user',
      content: text.trim(), displayText: text.trim(), timestamp: Date.now(),
    };
    addMessage(userMsg);
    setInputText('');
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const apiMessages = getDMApiMessages();
      apiMessages.push({ role: 'user', content: text.trim() });

      const beatInstruction = selectedCampaign?.isTutorial
        ? getTutorialBeatInjection(playerTurnCount.current, sessionFlags) : null;

      // If we just hit the limit, ask DM to wrap up
      const limitInstruction = hitLimit
        ? 'This is the final message of the session. Bring the current scene to a satisfying close — resolve the immediate action, give a sense of what lies ahead, and end on an evocative final line. Keep it under 150 words.'
        : null;

      const dmResponse = await callDM({
        messages: apiMessages,
        character, campaign: selectedCampaign, persona: selectedPersona,
        messageCount: playerTurnCount.current, sessionFlags,
        tutorialBeatInstruction: beatInstruction || limitInstruction,
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
        }
      }

      if (dmResponse.requires_roll && !hitLimit) {
        setPendingRoll(dmResponse.requires_roll);
        setDiceVisible(true);
      }

      if (hitLimit) {
        pendingLimitChronicle.current = true;
      }

      if (dmResponse.system_text?.toLowerCase().includes('critical')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

    } catch (err) {
      addMessage({ id: `err_${Date.now()}`, role: 'assistant', content: { narration: 'The chronicler stumbles... (Something went wrong. Try again.)' }, personaName: selectedPersona?.name, personaEmoji: selectedPersona?.emoji, timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  }, [isLoading, isAtLimit, messages, character, selectedCampaign, selectedPersona, sessionFlags, addMessage, setLoading, applyStateUpdates]);

  const handleRollComplete = useCallback((rollResult) => {
    setDiceVisible(false);
    setIsPeeking(false);
    const mod = rollResult.modifier || 0;
    const rollText = pendingRoll
      ? `I rolled a ${rollResult.die} for my ${pendingRoll.skill} check. With my modifier of ${mod >= 0 ? '+' + mod : mod}, my total is ${rollResult.total}.${rollResult.isCrit ? ' Natural 20!' : rollResult.isFumble ? ' Natural 1.' : ''} ${rollResult.success !== null ? (rollResult.success ? 'I succeeded.' : 'I failed.') : ''}`
      : `I rolled a ${rollResult.die} on the d${rollResult.sides}.`;
    setPendingRoll(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    sendMessage(rollText);
  }, [pendingRoll, sendMessage]);

  const handleQuickAction = (action) => sendMessage(action);

  const lastDMMessage = [...(messages || [])].reverse().find(m => m.role === 'assistant');
  const lastPlayerMessage = [...(messages || [])].reverse().find(m => m.role === 'user' && m.displayText)?.displayText || null;
  const suggestedActions = lastDMMessage?.content?.suggested_actions || [];

  const hpColor = getHpColor(character?.currentHP ?? 1, character?.maxHP ?? 1);
  const hpPct = character?.maxHP > 0 ? (character.currentHP ?? 0) / character.maxHP : 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.background, '#080614']} style={StyleSheet.absoluteFill} />

      {/* ── HUD ── */}
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <View style={styles.hudPortrait}>
            <Text style={styles.hudPortraitEmoji}>{character?.race?.emoji || '⚔️'}</Text>
          </View>
          <View>
            <Text style={styles.hudName}>{character?.name}</Text>
            <Text style={styles.hudSub}>{character?.race?.name} {character?.class?.name} · Lv {character?.level}</Text>
          </View>
        </View>
        <View style={styles.hudRight}>
          <Text style={[styles.hudHp, { color: hpColor }]}>{character?.currentHP}/{character?.maxHP} HP</Text>
          <View style={styles.hpBarBg}>
            <View style={[styles.hpBarFill, { width: `${hpPct * 100}%`, backgroundColor: hpColor }]} />
          </View>
          <Text style={styles.hudAc}>AC {character?.AC}</Text>
        </View>
      </View>

      {/* ── Turn counter warning ── */}
      {isNearLimit && (
        <View style={styles.warnBar}>
          <Text style={styles.warnText}>⚠ {turnsLeft} turns remaining this session</Text>
        </View>
      )}

      {/* ── Focused story view ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
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

          {/* Player's last visible action */}
          {lastPlayerMessage && (
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
            <DMMessage message={lastDMMessage} />
          ) : null}

          {isAtLimit && !isGeneratingSummary && !chronicleVisible && (
            <View style={styles.sessionEndNote}>
              <Text style={styles.sessionEndText}>Session complete — your Chronicle is being written…</Text>
            </View>
          )}
        </ScrollView>

        {/* ── Suggested actions ── */}
        {suggestedActions.length > 0 && !isLoading && !isAtLimit && !diceVisible && (
          <View style={styles.actionsContainer}>
            {suggestedActions.map((action, i) => (
              <TouchableOpacity key={i} style={styles.actionChip} onPress={() => handleQuickAction(action)}>
                <Text style={styles.actionChipText}>{action}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Input bar ── */}
        {!diceVisible && !isAtLimit && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="What do you do?"
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
          requiredRoll={pendingRoll}
          character={character}
          isPeeking={isPeeking}
          onPeekToggle={() => setIsPeeking(p => !p)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  hud: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm, backgroundColor: COLORS.surface + 'CC' },
  hudLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  hudPortrait: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primaryDark },
  hudPortraitEmoji: { fontSize: 18 },
  hudName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  hudSub: { color: COLORS.textMuted, fontSize: 10 },
  hudRight: { alignItems: 'flex-end' },
  hudHp: { fontSize: 12, fontWeight: '700' },
  hpBarBg: { width: 80, height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginTop: 2, marginBottom: 2, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 2 },
  hudAc: { color: COLORS.textMuted, fontSize: 10 },

  warnBar: { backgroundColor: COLORS.warning + '33', paddingVertical: 6, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.warning + '55' },
  warnText: { color: COLORS.warning, fontSize: 12, textAlign: 'center' },

  // ── Story area (focused single-response) ───────────────────────────────────
  storyArea: { flex: 1 },
  storyContent: { padding: SPACING.md, paddingBottom: SPACING.lg, flexGrow: 1 },

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
  actionChipText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },

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

  // ── Loot ────────────────────────────────────────────────────────────────────
  lootOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  lootCard: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
  lootTitle: { color: COLORS.primary, fontSize: 20, fontWeight: '800', marginBottom: SPACING.sm },
  lootItem: { color: COLORS.textPrimary, fontSize: 15, marginBottom: SPACING.xs },
  lootGold: { color: COLORS.primaryLight, fontSize: 14, marginTop: SPACING.xs },
  lootDismiss: { color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.md, fontStyle: 'italic' },
});
