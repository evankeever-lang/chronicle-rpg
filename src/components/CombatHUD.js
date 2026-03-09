// src/components/CombatHUD.js
// Shown during COMBAT_INIT, COMBAT_STATE, and DOWNED states.
// Hidden during EXPLORATION and COMBAT_RESOLUTION.

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

// ─── Turn order token ─────────────────────────────────────────────────────────
function TurnToken({ combatant, isActive }) {
  const defeated = !combatant.isPlayer && combatant.hp <= 0;
  return (
    <View style={[
      styles.turnToken,
      isActive && styles.turnTokenActive,
      defeated && styles.turnTokenDefeated,
    ]}>
      <Text style={[styles.tokenName, isActive && styles.tokenNameActive]} numberOfLines={1}>
        {combatant.isPlayer ? 'You' : combatant.name.split(' ')[0]}
      </Text>
      <Text style={[styles.tokenInit, isActive && styles.tokenInitActive]}>
        {combatant.initiative}
      </Text>
    </View>
  );
}

// ─── Enemy HP bar row ─────────────────────────────────────────────────────────
function EnemyRow({ enemy }) {
  const pct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
  const barColor = pct > 0.5 ? COLORS.danger : pct > 0.25 ? COLORS.warning : COLORS.hpLow;
  const defeated = enemy.hp <= 0;

  return (
    <View style={[styles.enemyRow, defeated && styles.enemyRowDefeated]}>
      <View style={styles.enemyInfo}>
        <View style={styles.enemyLabelRow}>
          <Text style={[styles.enemyName, defeated && styles.enemyNameDefeated]} numberOfLines={1}>
            {enemy.name}
          </Text>
          {defeated ? (
            <Text style={styles.defeatedLabel}>Defeated</Text>
          ) : (
            <Text style={styles.enemyHpLabel}>{enemy.hp}/{enemy.maxHp}</Text>
          )}
        </View>
        {!defeated && (
          <View style={styles.hpBarBg}>
            <View style={[styles.hpBarFill, { width: `${Math.max(0, pct * 100)}%`, backgroundColor: barColor }]} />
          </View>
        )}
        {enemy.conditions?.length > 0 && (
          <View style={styles.conditionRow}>
            {enemy.conditions.map((c, i) => (
              <View key={i} style={styles.conditionChip}>
                <Text style={styles.conditionText}>{c}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Text style={styles.enemyAc}>AC {enemy.ac}</Text>
    </View>
  );
}

// ─── Enemy zone (battlefield view, shown during COMBAT_STATE) ─────────────────
const ENEMY_SHAPE_PALETTE = [
  { color: '#C96B6B' },
  { color: '#6B8EC9' },
  { color: '#6BB89E' },
  { color: '#C9A84C' },
];

export function EnemyZone({ activeEnemies, isAttacking = false, onSelectEnemy }) {
  if (!activeEnemies || activeEnemies.length === 0) return null;
  return (
    <View style={zoneStyles.container}>
      {activeEnemies.map((enemy, idx) => {
        const palette = ENEMY_SHAPE_PALETTE[idx % ENEMY_SHAPE_PALETTE.length];
        const defeated = enemy.hp <= 0;
        const selectable = isAttacking && !defeated;
        const pct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
        const barColor = pct > 0.5 ? COLORS.danger : pct > 0.25 ? COLORS.warning : COLORS.hpLow;
        const CardWrapper = selectable ? TouchableOpacity : View;
        return (
          <CardWrapper
            key={enemy.id}
            style={[zoneStyles.enemyCard, defeated && zoneStyles.defeated]}
            onPress={selectable ? () => onSelectEnemy(enemy) : undefined}
            activeOpacity={0.7}
          >
            <View style={[
              zoneStyles.enemyShape,
              { borderColor: selectable ? '#FF6B6B' : palette.color, backgroundColor: palette.color + '22' },
              selectable && zoneStyles.enemyShapeSelectable,
            ]} />
            <Text
              style={[zoneStyles.enemyName, defeated && zoneStyles.enemyNameDefeated]}
              numberOfLines={1}
            >
              {enemy.name}
            </Text>
            {!defeated ? (
              <>
                <Text style={zoneStyles.hpText}>{enemy.hp}/{enemy.maxHp}</Text>
                <View style={zoneStyles.hpBarBg}>
                  <View style={[zoneStyles.hpBarFill, { width: `${Math.max(0, pct * 100)}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={zoneStyles.acText}>AC {enemy.ac}</Text>
                {selectable && <Text style={zoneStyles.tapHint}>Tap to attack</Text>}
              </>
            ) : (
              <Text style={zoneStyles.defeatedLabel}>Defeated</Text>
            )}
            {enemy.conditions?.length > 0 && (
              <View style={zoneStyles.conditionRow}>
                {enemy.conditions.map((c, ci) => (
                  <View key={ci} style={zoneStyles.conditionChip}>
                    <Text style={zoneStyles.conditionText}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
          </CardWrapper>
        );
      })}
    </View>
  );
}

const zoneStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    minHeight: 160,
  },
  enemyCard: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
  },
  defeated: {
    opacity: 0.3,
  },
  enemyShape: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    marginBottom: SPACING.xs,
  },
  enemyName: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  enemyNameDefeated: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  hpText: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  hpBarBg: {
    width: 72,
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 2,
  },
  hpBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  acText: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  enemyShapeSelectable: {
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  tapHint: {
    color: '#FF6B6B',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  defeatedLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    marginTop: 3,
  },
  conditionChip: {
    backgroundColor: COLORS.accentDanger + '22',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  conditionText: {
    color: COLORS.hpLow,
    fontSize: 8,
    fontWeight: '700',
  },
});

// ─── Combat log strip (last N system messages) ─────────────────────────────────
export function CombatLogStrip({ messages }) {
  if (!messages || messages.length === 0) return null;
  const lines = messages.slice(-3);
  return (
    <View style={logStyles.container}>
      {lines.map((m, i) => (
        <Text key={m.id || i} style={logStyles.line} numberOfLines={1}>
          {m.content.system_text}
        </Text>
      ))}
    </View>
  );
}

const logStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceElevated,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: 2,
  },
  line: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
});

// ─── Main HUD ─────────────────────────────────────────────────────────────────
export default function CombatHUD({
  combatState,
  combatTurnOrder,
  activeTurnIndex,
  combatRound,
  playerConditions,
}) {
  // Stay visible through COMBAT_RESOLUTION so HUD persists while outro narration renders.
  // Only unmount when RESET_COMBAT returns to EXPLORATION.
  const visible = combatState !== 'EXPLORATION';

  if (!visible) return null;

  const activeCombatant = combatTurnOrder[activeTurnIndex];
  const isPlayerTurn = activeCombatant?.isPlayer;
  const isDowned = combatState === 'DOWNED';

  const turnLabel = isDowned
    ? 'You are unconscious'
    : combatState === 'COMBAT_INIT'
    ? 'Rolling initiative…'
    : isPlayerTurn
    ? 'Your turn'
    : `${activeCombatant?.name ?? '…'}'s turn`;

  const dotColor = isDowned
    ? COLORS.hpLow
    : isPlayerTurn
    ? COLORS.success
    : COLORS.danger;

  return (
    <View style={styles.hud}>
      {/* Round + active-turn indicator */}
      <View style={styles.topRow}>
        <Text style={styles.roundLabel}>
          {combatState === 'COMBAT_INIT' ? 'Combat' : `Round ${combatRound}`}
        </Text>
        <View style={styles.turnIndicator}>
          <View style={[styles.turnDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.turnLabel, isDowned && styles.turnLabelDowned]}>
            {turnLabel}
          </Text>
        </View>
      </View>

      {/* Initiative order strip */}
      {combatTurnOrder.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stripScroll}
          contentContainerStyle={styles.stripContent}
        >
          {combatTurnOrder.map((c, idx) => (
            <TurnToken
              key={c.id || `${c.name}_${idx}`}
              combatant={c}
              isActive={idx === activeTurnIndex && !isDowned}
            />
          ))}
        </ScrollView>
      )}


      {/* Player conditions */}
      {playerConditions?.length > 0 && (
        <View style={styles.playerConditions}>
          <Text style={styles.playerConditionLabel}>You: </Text>
          {playerConditions.map((c, i) => (
            <View key={i} style={[styles.conditionChip, styles.conditionChipPlayer]}>
              <Text style={[styles.conditionText, styles.conditionTextPlayer]}>{c}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentDanger + '44',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  roundLabel: {
    color: COLORS.accentDanger,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: FONTS.serif,
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  turnDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  turnLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  turnLabelDowned: {
    color: COLORS.hpLow,
    fontWeight: '700',
  },

  // Initiative strip
  stripScroll: {
    marginBottom: SPACING.xs,
  },
  stripContent: {
    gap: SPACING.xs,
    paddingRight: SPACING.sm,
  },
  turnToken: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  turnTokenActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
  },
  turnTokenDefeated: {
    opacity: 0.3,
  },
  tokenName: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tokenNameActive: {
    color: COLORS.primary,
  },
  tokenInit: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  tokenInitActive: {
    color: COLORS.primaryLight,
  },

  // Enemy HP rows
  enemyList: {
    gap: 5,
    marginBottom: 2,
  },
  enemyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  enemyRowDefeated: {
    opacity: 0.4,
  },
  enemyInfo: {
    flex: 1,
  },
  enemyLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  enemyName: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    flex: 1,
  },
  enemyNameDefeated: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  enemyHpLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
  },
  defeatedLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: 'italic',
  },
  hpBarBg: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  hpBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  enemyAc: {
    color: COLORS.textMuted,
    fontSize: 10,
    minWidth: 34,
    textAlign: 'right',
  },

  // Conditions
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 2,
  },
  playerConditions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  playerConditionLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  conditionChip: {
    backgroundColor: COLORS.accentDanger + '22',
    borderWidth: 1,
    borderColor: COLORS.accentDanger + '55',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  conditionChipPlayer: {
    backgroundColor: COLORS.warning + '22',
    borderColor: COLORS.warning + '55',
  },
  conditionText: {
    color: COLORS.hpLow,
    fontSize: 9,
    fontWeight: '700',
  },
  conditionTextPlayer: {
    color: COLORS.warning,
  },
});
