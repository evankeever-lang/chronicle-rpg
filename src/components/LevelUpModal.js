import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useGame } from '../context/GameContext';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';
import { FULL_CASTER_SLOTS, HALF_CASTER_SLOTS } from '../constants/classes';

const SCREENS = ['announce', 'hp', 'features', 'done'];

function StatUpButton({ label, value, onChange, disabled }) {
  return (
    <View style={styles.statUpRow}>
      <Text style={styles.statUpLabel}>{label}</Text>
      <View style={styles.statUpControls}>
        <TouchableOpacity
          style={[styles.statUpBtn, disabled && styles.statUpBtnDisabled]}
          onPress={() => onChange(-1)}
          disabled={disabled || value <= 8}
        >
          <Text style={styles.statUpBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.statUpValue}>{value}</Text>
        <TouchableOpacity
          style={[styles.statUpBtn, disabled && styles.statUpBtnDisabled]}
          onPress={() => onChange(+1)}
          disabled={disabled || value >= 20}
        >
          <Text style={styles.statUpBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LevelUpModal({ visible, onClose }) {
  const {
    character,
    xpToNext,
    levelUp,
  } = useGame();

  const [screen, setScreen] = useState(0); // index into SCREENS
  const [hpRoll, setHpRoll] = useState(null);
  // ASI: 2 points to distribute (simplified flat +2 or +1/+1)
  const [asiDeltas, setAsiDeltas] = useState({ STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 });
  const [asiPoints, setAsiPoints] = useState(2);

  const currentLevel = character?.level ?? 1;
  const newLevel = currentLevel + 1;
  const hitDie = character?.hitDie ?? 8;
  const conMod = Math.floor(((character?.abilityScores?.CON ?? 10) - 10) / 2);
  const newProfBonus = Math.ceil(newLevel / 4) + 1;

  // Determine new spell slots at the new level
  const classData = character?.class;
  let newSpellSlots = null;
  if (classData?.spellcaster) {
    const table = classData.halfCaster ? HALF_CASTER_SLOTS : FULL_CASTER_SLOTS;
    const slots = table[newLevel];
    if (slots) {
      newSpellSlots = { current: { ...slots }, max: { ...slots } };
    }
  }

  const classFeatures = classData?.classFeaturesByLevel?.[newLevel] || [];

  const rollHP = () => {
    const roll = Math.ceil(Math.random() * hitDie);
    setHpRoll(roll);
  };

  const handleAsiChange = (stat, delta) => {
    if (delta > 0 && asiPoints <= 0) return;
    if (delta < 0 && asiDeltas[stat] <= 0) return;
    const newScore = (character?.abilityScores?.[stat] ?? 10) + asiDeltas[stat] + delta;
    if (newScore > 20 || newScore < 8) return;
    setAsiDeltas(prev => ({ ...prev, [stat]: prev[stat] + delta }));
    setAsiPoints(prev => prev - delta);
  };

  const handleFinish = () => {
    const hpIncrease = Math.max(1, (hpRoll ?? Math.ceil(hitDie / 2)) + conMod);

    // Build updated ability scores with ASI
    const newAbilityScores = { ...character?.abilityScores };
    for (const [stat, delta] of Object.entries(asiDeltas)) {
      if (delta !== 0) newAbilityScores[stat] = (newAbilityScores[stat] || 10) + delta;
    }

    levelUp({
      newLevel,
      hpIncrease,
      newSpellSlots,
      newXpToNext: xpToNext, // GameContext already bumped xpToNext threshold if needed
    });

    // Reset local state for next time
    setScreen(0);
    setHpRoll(null);
    setAsiDeltas({ STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 });
    setAsiPoints(2);
    onClose();
  };

  const handleClose = () => {
    setScreen(0);
    setHpRoll(null);
    setAsiDeltas({ STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 });
    setAsiPoints(2);
    onClose();
  };

  const currentScreen = SCREENS[screen];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Announce screen */}
          {currentScreen === 'announce' && (
            <View style={styles.announceContainer}>
              <Text style={styles.announceGlow}>✦</Text>
              <Text style={styles.announceTitle}>Level Up!</Text>
              <Text style={styles.announceLevel}>Level {currentLevel} → {newLevel}</Text>
              <Text style={styles.announceSub}>
                {character?.name}, {character?.race?.name} {character?.class?.name}
              </Text>
              {newProfBonus > (Math.ceil(currentLevel / 4) + 1) && (
                <View style={styles.featureChip}>
                  <Text style={styles.featureChipText}>Proficiency Bonus +{newProfBonus}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.nextBtn} onPress={() => setScreen(1)}>
                <Text style={styles.nextBtnText}>Roll for HP →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* HP roll screen */}
          {currentScreen === 'hp' && (
            <View style={styles.announceContainer}>
              <Text style={styles.screenTitle}>Hit Points</Text>
              <Text style={styles.screenSub}>Roll your d{hitDie} and add your CON modifier ({conMod >= 0 ? `+${conMod}` : conMod})</Text>
              {hpRoll === null ? (
                <TouchableOpacity style={styles.rollBtn} onPress={rollHP}>
                  <Text style={styles.rollBtnText}>Roll d{hitDie}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.hpResultBox}>
                    <Text style={styles.hpResultDie}>{hpRoll}</Text>
                    <Text style={styles.hpResultPlus}>{conMod >= 0 ? `+${conMod}` : conMod}</Text>
                    <Text style={styles.hpResultEquals}>=</Text>
                    <Text style={styles.hpResultTotal}>+{Math.max(1, hpRoll + conMod)} HP</Text>
                  </View>
                  <TouchableOpacity style={styles.nextBtn} onPress={() => setScreen(2)}>
                    <Text style={styles.nextBtnText}>
                      {classFeatures.length > 0 ? 'Class Features →' : 'Ability Scores →'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={rollHP} style={styles.rerollBtn}>
                <Text style={styles.rerollBtnText}>Reroll</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Features screen */}
          {currentScreen === 'features' && (
            <ScrollView contentContainerStyle={styles.featuresContainer}>
              <Text style={styles.screenTitle}>New at Level {newLevel}</Text>
              {classFeatures.length > 0 ? (
                classFeatures.map((f, i) => (
                  <View key={i} style={styles.featureCard}>
                    <Text style={styles.featureCardTitle}>{f.name}</Text>
                    {!!f.description && (
                      <Text style={styles.featureCardDesc}>{f.description}</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noFeaturesText}>No major class features at this level.</Text>
              )}
              {newSpellSlots && (
                <View style={styles.featureCard}>
                  <Text style={styles.featureCardTitle}>Spell Slots Updated</Text>
                  <Text style={styles.featureCardDesc}>Your spell slots have been upgraded to Level {newLevel} totals.</Text>
                </View>
              )}

              <Text style={[styles.screenTitle, { marginTop: SPACING.lg }]}>Ability Score</Text>
              <Text style={styles.screenSub}>Distribute 2 points across any stats (max 20 each)</Text>
              <View style={styles.asiRemaining}>
                <Text style={styles.asiRemainingText}>{asiPoints} point{asiPoints !== 1 ? 's' : ''} remaining</Text>
              </View>
              {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
                <StatUpButton
                  key={stat}
                  label={`${stat}  ${(character?.abilityScores?.[stat] ?? 10) + asiDeltas[stat]}`}
                  value={asiDeltas[stat]}
                  onChange={(d) => handleAsiChange(stat, d)}
                  disabled={false}
                />
              ))}

              <TouchableOpacity style={styles.nextBtn} onPress={() => setScreen(3)}>
                <Text style={styles.nextBtnText}>Confirm →</Text>
              </TouchableOpacity>
              <View style={{ height: SPACING.xxl }} />
            </ScrollView>
          )}

          {/* Done screen */}
          {currentScreen === 'done' && (
            <View style={styles.announceContainer}>
              <Text style={styles.announceGlow}>⚔</Text>
              <Text style={styles.announceTitle}>Ready for Battle</Text>
              <Text style={styles.announceSub}>Level {newLevel} {character?.class?.name}</Text>
              <TouchableOpacity style={styles.nextBtn} onPress={handleFinish}>
                <Text style={styles.nextBtnText}>Continue Adventure</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '85%',
    paddingTop: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  announceContainer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.lg,
  },
  announceGlow: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  announceTitle: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    color: '#C9A84C',
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  announceLevel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  announceSub: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  featureChip: {
    backgroundColor: '#1A1A0A',
    borderWidth: 1,
    borderColor: '#C9A84C',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.md,
  },
  featureChipText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: '#C9A84C',
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.md,
    width: '100%',
  },
  nextBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: '#fff',
    fontWeight: '700',
  },
  screenTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  screenSub: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  rollBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  rollBtnText: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: '700',
  },
  hpResultBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  hpResultDie: {
    fontFamily: FONTS.serif,
    fontSize: 48,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  hpResultPlus: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textMuted,
  },
  hpResultEquals: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textMuted,
  },
  hpResultTotal: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.xl,
    color: COLORS.success,
    fontWeight: '700',
  },
  rerollBtn: {
    marginTop: SPACING.sm,
  },
  rerollBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
  featuresContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  featureCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  featureCardTitle: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureCardDesc: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  noFeaturesText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  asiRemaining: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primaryFaint,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  asiRemainingText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  statUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceElevated,
  },
  statUpLabel: {
    flex: 1,
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  statUpControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statUpBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statUpBtnDisabled: {
    opacity: 0.3,
  },
  statUpBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  statUpValue: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
});
