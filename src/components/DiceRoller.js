// src/components/DiceRoller.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { roll as rollDie, getModifierString as formatMod, getAbilityModifier as getAbilityMod } from '../utils/dice';

// ─── Die shape configs ────────────────────────────────────────────────────────
const DIE_CONFIG = {
  4:   { color: '#9B6B9E', label: 'd4',   shape: 'triangle' },
  6:   { color: '#6B8EC9', label: 'd6',   shape: 'square'   },
  8:   { color: '#6BB89E', label: 'd8',   shape: 'diamond'  },
  10:  { color: '#C9986B', label: 'd10',  shape: 'diamond'  },
  12:  { color: '#C96B8E', label: 'd12',  shape: 'pentagon' },
  20:  { color: '#C9A84C', label: 'd20',  shape: 'triangle' },
  100: { color: '#8EA0C9', label: 'd100', shape: 'circle'   },
};

// ─── Pseudo-3D Die Visual ─────────────────────────────────────────────────────
function Die3D({ sides, rolling, result }) {
  const cfg = DIE_CONFIG[sides] || DIE_CONFIG[20];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const wobbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (rolling) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.18, duration: 110, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 0.9,  duration: 110, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1.1,  duration: 90,  useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1,    duration: 90,  useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(wobbleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
            Animated.timing(wobbleAnim, { toValue: -1,   duration: 80, useNativeDriver: true }),
            Animated.timing(wobbleAnim, { toValue: 0.5,  duration: 60, useNativeDriver: true }),
            Animated.timing(wobbleAnim, { toValue: -0.5, duration: 60, useNativeDriver: true }),
            Animated.timing(wobbleAnim, { toValue: 0,    duration: 60, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      scaleAnim.stopAnimation();
      wobbleAnim.stopAnimation();
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.25, tension: 200, friction: 4, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1,    tension: 100, friction: 8, useNativeDriver: true }),
      ]).start();
      Animated.spring(wobbleAnim, { toValue: 0, tension: 150, friction: 6, useNativeDriver: true }).start();
    }
  }, [rolling]);

  const rotate = wobbleAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-20deg', '20deg'] });
  const S = 130;

  return (
    <Animated.View style={[styles.dieWrapper, { transform: [{ scale: scaleAnim }, { rotate }] }]}>
      <DieFace shape={cfg.shape} size={S} color={cfg.color} />
      {/* Number overlay */}
      <View style={styles.dieNumberOverlay}>
        <Text style={[styles.dieNumber, { color: rolling ? cfg.color + 'AA' : '#FFFFFF' }]}>
          {rolling ? '?' : (result ?? '?')}
        </Text>
        <Text style={[styles.dieSidesLabel, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </Animated.View>
  );
}

function DieFace({ shape, size: S, color }) {
  const bg = color + '28';
  const shadow = { shadowColor: color, shadowOpacity: 0.65, shadowRadius: 18, elevation: 12 };

  if (shape === 'triangle') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', width: S, height: S }}>
        {/* Back face shadow triangle */}
        <View style={[{
          position: 'absolute',
          width: 0, height: 0,
          borderLeftWidth: S * 0.56, borderRightWidth: S * 0.56,
          borderBottomWidth: S * 0.97,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderBottomColor: color + '18',
          top: 6,
        }]} />
        {/* Main face */}
        <View style={[{
          width: 0, height: 0,
          borderLeftWidth: S * 0.54, borderRightWidth: S * 0.54,
          borderBottomWidth: S * 0.93,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderBottomColor: bg,
        }, shadow]} />
        {/* Border triangle using nested approach */}
        <View style={{
          position: 'absolute',
          width: 0, height: 0,
          borderLeftWidth: S * 0.52, borderRightWidth: S * 0.52,
          borderBottomWidth: S * 0.9,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderBottomColor: color + '66',
          top: 8,
        }} />
        {/* Inner highlight */}
        <View style={{
          position: 'absolute',
          width: 0, height: 0,
          borderLeftWidth: S * 0.32, borderRightWidth: S * 0.32,
          borderBottomWidth: S * 0.55,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderBottomColor: color + '22',
          top: S * 0.3,
        }} />
      </View>
    );
  }

  if (shape === 'diamond') {
    return (
      <View style={[{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }, shadow]}>
        <View style={{ width: S * 0.7, height: S * 0.7, backgroundColor: bg, borderWidth: 2.5, borderColor: color + '88', transform: [{ rotate: '45deg' }], borderRadius: 4 }} />
        <View style={{ position: 'absolute', width: S * 0.44, height: S * 0.44, backgroundColor: color + '22', transform: [{ rotate: '45deg' }], borderRadius: 3 }} />
      </View>
    );
  }

  if (shape === 'pentagon') {
    return (
      <View style={[{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }, shadow]}>
        <View style={{ width: S * 0.7, height: S * 0.7, backgroundColor: bg, borderWidth: 2.5, borderColor: color + '88', borderRadius: 14, transform: [{ rotate: '18deg' }] }} />
        <View style={{ position: 'absolute', width: S * 0.7, height: S * 0.7, borderWidth: 2, borderColor: color + '44', borderRadius: 14, transform: [{ rotate: '54deg' }] }} />
        <View style={{ position: 'absolute', width: S * 0.42, height: S * 0.42, backgroundColor: color + '22', borderRadius: 10, transform: [{ rotate: '36deg' }] }} />
      </View>
    );
  }

  if (shape === 'circle') {
    return (
      <View style={[{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }, shadow]}>
        <View style={{ width: S * 0.78, height: S * 0.78, backgroundColor: bg, borderWidth: 2.5, borderColor: color + '88', borderRadius: S * 0.39 }} />
        <View style={{ position: 'absolute', width: S * 0.5, height: S * 0.5, backgroundColor: color + '22', borderRadius: S * 0.25 }} />
        <View style={{ position: 'absolute', width: S * 0.25, height: S * 0.25, backgroundColor: color + '33', borderRadius: S * 0.125 }} />
      </View>
    );
  }

  // Square (d6)
  return (
    <View style={[{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }, shadow]}>
      <View style={{ width: S * 0.72, height: S * 0.72, backgroundColor: bg, borderWidth: 2.5, borderColor: color + '88', borderRadius: 12 }} />
      {/* 3D bevel effect */}
      <View style={{ position: 'absolute', width: S * 0.65, height: S * 0.65, borderTopWidth: 2, borderLeftWidth: 2, borderColor: color + '44', borderRadius: 10 }} />
      <View style={{ position: 'absolute', width: S * 0.4, height: S * 0.4, backgroundColor: color + '18', borderRadius: 6 }} />
    </View>
  );
}

// ─── Main DiceRoller Component ────────────────────────────────────────────────
export default function DiceRoller({
  visible,
  onRollComplete,
  requiredRoll,     // { skill, dc, ability } — set for skill checks
  character,
  isPeeking,        // whether the user has minimised to peek at DM text
  onPeekToggle,     // toggle peek mode
  rollContext,        // plain label for combat rolls ("Roll for Initiative", "Attack Roll", etc.)
  requiredSides,      // override die sides (e.g. 8 for d8 damage roll); defaults to requiredRoll?.sides or 20
  hasAdvantage = false,    // show Advantage button (only when a condition/ability grants it)
  hasDisadvantage = false, // show Disadvantage button (only when a condition/ability grants it)
}) {
  const [result, setResult] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);

  const resultAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Animate sheet in/out
  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: visible ? 1 : 0,
      tension: 60, friction: 12, useNativeDriver: true,
    }).start();
  }, [visible]);

  // Reset when shown or when rollContext changes (e.g. attack → damage phase)
  useEffect(() => {
    if (visible) {
      setResult(null);
      setAdvantage(false);
      setDisadvantage(false);
      resultAnim.setValue(0);
    }
  }, [visible, rollContext]);

  const sides = requiredSides || requiredRoll?.sides || 20;

  const getModifier = useCallback(() => {
    if (!character || !requiredRoll) return 0;
    const abilityScore = character.abilityScores?.[requiredRoll.ability] || 10;
    const baseMod = getAbilityMod(abilityScore);
    const isProficient = character.proficientSkills?.includes(requiredRoll.skill);
    return baseMod + (isProficient ? (character.proficiencyBonus || 2) : 0);
  }, [character, requiredRoll]);

  const performRoll = useCallback(() => {
    if (isRolling) return;
    setIsRolling(true);
    setResult(null);
    resultAnim.setValue(0);

    setTimeout(() => {
      let die1, die2, finalDie;

      if (advantage && !disadvantage) {
        die1 = rollDie(sides); die2 = rollDie(sides);
        finalDie = Math.max(die1, die2);
      } else if (disadvantage && !advantage) {
        die1 = rollDie(sides); die2 = rollDie(sides);
        finalDie = Math.min(die1, die2);
      } else {
        finalDie = rollDie(sides);
        die1 = finalDie; die2 = null;
      }

      const modifier = getModifier();
      const total = finalDie + modifier;
      const dc = requiredRoll?.dc;
      const success = dc != null ? total >= dc : null;
      const isCrit = sides === 20 && finalDie === 20;
      const isFumble = sides === 20 && finalDie === 1;

      const rollResult = { die: finalDie, die1, die2, modifier, total, dc, success, isCrit, isFumble, sides };
      setResult(rollResult);
      setIsRolling(false);

      Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    }, 700);
  }, [isRolling, sides, advantage, disadvantage, requiredRoll, getModifier]);

  const handleConfirm = useCallback(() => {
    if (result) onRollComplete?.(result);
    setResult(null);
  }, [result, onRollComplete]);

  const getResultColor = () => {
    if (!result) return COLORS.textPrimary;
    if (result.isCrit) return COLORS.diceCrit;
    if (result.isFumble) return COLORS.diceFumble;
    if (result.success === true) return COLORS.success;
    if (result.success === false) return COLORS.hpLow;
    return COLORS.primaryLight;
  };

  const getResultBadge = () => {
    if (!result) return null;
    if (result.isCrit) return { label: 'CRITICAL HIT', color: COLORS.diceCrit };
    if (result.isFumble) return { label: 'CRITICAL FAIL', color: COLORS.diceFumble };
    if (result.success === true) return { label: 'SUCCESS', color: COLORS.success };
    if (result.success === false) return { label: 'FAILURE', color: COLORS.hpLow };
    return null;
  };

  const slideY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const badge = getResultBadge();
  const mod = getModifier();

  if (!visible) return null;

  // ── Peek mode: thin bar so player can read DM text ─────────────────────────
  if (isPeeking) {
    return (
      <Animated.View style={[styles.peekBar, { transform: [{ translateY: slideY }] }]}>
        <TouchableOpacity style={styles.peekBarInner} onPress={onPeekToggle}>
          <Text style={styles.peekBarText}>
            🎲 {requiredRoll ? `${requiredRoll.skill} Check · DC ${requiredRoll.dc}` : (rollContext || 'Roll')} — tap to roll
          </Text>
          <Text style={styles.peekArrow}>↑</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    // Backdrop is NOT tappable — player must roll
    <View style={styles.backdrop}>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>

        {/* Handle */}
        <View style={styles.handle} />

        {/* Peek button — collapse to see DM text */}
        <TouchableOpacity style={styles.peekButton} onPress={onPeekToggle}>
          <Text style={styles.peekButtonText}>Read prompt ↓</Text>
        </TouchableOpacity>

        {/* Header — context label for combat rolls */}
        {rollContext && !requiredRoll && (
          <View style={styles.header}>
            <Text style={styles.checkType}>{rollContext}</Text>
          </View>
        )}

        {/* Header — skill check info */}
        {requiredRoll && (
          <View style={styles.header}>
            <Text style={styles.checkType}>{requiredRoll.skill} Check</Text>
            <View style={styles.headerMeta}>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>DC</Text>
                <Text style={styles.metaValue}>{requiredRoll.dc}</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaLabel}>{requiredRoll.ability}</Text>
                <Text style={styles.metaValue}>{formatMod(mod)}</Text>
              </View>
              {character?.proficientSkills?.includes(requiredRoll.skill) && (
                <View style={[styles.metaPill, styles.profPill]}>
                  <Text style={[styles.metaLabel, { color: COLORS.success }]}>Proficient</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 3D Die */}
        <View style={styles.dieContainer}>
          <Die3D sides={sides} rolling={isRolling} result={result?.die} />
        </View>

        {/* Advantage / Disadvantage — only shown when a condition or ability grants one */}
        {(hasAdvantage || hasDisadvantage) && (
          <View style={styles.advRow}>
            {hasAdvantage && (
              <TouchableOpacity
                style={[styles.advBtn, advantage && styles.advBtnGreen]}
                onPress={() => { setAdvantage(a => !a); setDisadvantage(false); setResult(null); }}
              >
                <Text style={[styles.advText, advantage && { color: COLORS.success }]}>Advantage</Text>
              </TouchableOpacity>
            )}
            {hasDisadvantage && (
              <TouchableOpacity
                style={[styles.advBtn, disadvantage && styles.advBtnRed]}
                onPress={() => { setDisadvantage(d => !d); setAdvantage(false); setResult(null); }}
              >
                <Text style={[styles.advText, disadvantage && { color: COLORS.diceFumble }]}>Disadvantage</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Result area */}
        {result && (
          <Animated.View style={[styles.resultArea, { opacity: resultAnim, transform: [{ scale: resultAnim }] }]}>
            {result.die2 != null && (
              <Text style={styles.rollPairText}>Rolled {result.die1} & {result.die2} → kept {result.die}</Text>
            )}
            <Text style={[styles.totalText, { color: getResultColor() }]}>
              {result.die}{mod !== 0 ? ` ${formatMod(mod)} = ${result.total}` : ''}
            </Text>
            {badge && (
              <View style={[styles.badgePill, { borderColor: badge.color, backgroundColor: badge.color + '22' }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            )}
            {result.dc != null && (
              <Text style={styles.dcText}>vs DC {result.dc}</Text>
            )}
          </Animated.View>
        )}

        {/* CTA */}
        <View style={styles.ctaRow}>
          {!result ? (
            <TouchableOpacity style={styles.rollBtn} onPress={performRoll} disabled={isRolling}>
              <Text style={styles.rollBtnText}>{isRolling ? 'Rolling...' : `Roll ${DIE_CONFIG[sides]?.label || 'd20'}`}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm & Continue →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reroll option */}
        {result && (
          <TouchableOpacity style={styles.rerollBtn} onPress={performRoll} disabled={isRolling}>
            <Text style={styles.rerollText}>Reroll</Text>
          </TouchableOpacity>
        )}

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 40, paddingHorizontal: SPACING.lg,
    borderTopWidth: 1, borderColor: COLORS.border,
  },

  peekButton: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  peekButtonText: { color: COLORS.textSecondary, fontSize: 12 },

  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: SPACING.sm, marginBottom: SPACING.md },

  header: { alignItems: 'center', marginBottom: SPACING.md },
  checkType: { color: COLORS.primary, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  headerMeta: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs, flexWrap: 'wrap', justifyContent: 'center' },
  metaPill: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', gap: 4, alignItems: 'center' },
  profPill: { borderWidth: 1, borderColor: COLORS.success + '55' },
  metaLabel: { color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },

  dieContainer: { alignItems: 'center', justifyContent: 'center', height: 170, marginVertical: SPACING.sm },

  dieWrapper: { alignItems: 'center', justifyContent: 'center', width: 140, height: 140 },
  dieNumberOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center', top: 0, bottom: 0, left: 0, right: 0 },
  dieNumber: { fontSize: 44, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  dieSidesLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: -4 },

  advRow: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', marginBottom: SPACING.md },
  advBtn: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border },
  advBtnGreen: { borderColor: COLORS.success, backgroundColor: COLORS.success + '22' },
  advBtnRed: { borderColor: COLORS.diceFumble, backgroundColor: COLORS.diceFumble + '22' },
  advText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  resultArea: { alignItems: 'center', marginBottom: SPACING.md },
  rollPairText: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 2 },
  totalText: { fontSize: 56, fontWeight: '900', lineHeight: 64 },
  badgePill: { borderWidth: 1.5, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 5, marginTop: SPACING.xs },
  badgeText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  dcText: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },

  ctaRow: { marginBottom: SPACING.xs },
  rollBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' },
  rollBtnText: { color: COLORS.background, fontSize: 17, fontWeight: '800' },
  confirmBtn: { backgroundColor: COLORS.success + '33', borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.success },
  confirmBtnText: { color: COLORS.success, fontSize: 17, fontWeight: '700' },
  rerollBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  rerollText: { color: COLORS.textMuted, fontSize: 13 },

  // Peek bar
  peekBar: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  peekBarInner: { backgroundColor: COLORS.surface, borderTopWidth: 1, borderColor: COLORS.primary + '66', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: 14 },
  peekBarText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  peekArrow: { color: COLORS.primary, fontSize: 16 },
});
