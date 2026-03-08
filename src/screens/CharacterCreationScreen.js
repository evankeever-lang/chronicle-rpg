import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RACES, getRaceById } from '../constants/races';
import { CLASSES, getClassById } from '../constants/classes';
import { useGame } from '../context/GameContext';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  getAbilityModifier, getModifierString, getProficiencyBonus,
  calculateMaxHP, getPointBuyCost, getTotalPointsSpent,
} from '../utils/dice';

const STEPS = ['Race', 'Class', 'Stats', 'Name'];
const POINT_BUY_TOTAL = 27;
const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_LABELS = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };

const BASE_SCORES = { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 };

export default function CharacterCreationScreen({ navigation }) {
  const { setCharacter, character, campaign } = useGame();

  const [step, setStep] = useState(0);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [baseScores, setBaseScores] = useState({ ...BASE_SCORES });
  const [characterName, setCharacterName] = useState('');

  const race = getRaceById(selectedRaceId);
  const cls = getClassById(selectedClassId);

  // Apply racial bonuses to base scores
  const finalScores = race
    ? ABILITY_KEYS.reduce((acc, k) => ({ ...acc, [k]: baseScores[k] + (race.statBonuses[k] || 0) }), {})
    : { ...baseScores };

  const pointsSpent = getTotalPointsSpent(baseScores);
  const pointsRemaining = POINT_BUY_TOTAL - pointsSpent;

  const canAdvance = () => {
    if (step === 0) return !!selectedRaceId;
    if (step === 1) return !!selectedClassId;
    if (step === 2) return pointsRemaining === 0;
    if (step === 3) return characterName.trim().length >= 2;
    return false;
  };

  const adjustScore = (key, delta) => {
    const current = baseScores[key];
    const next = current + delta;
    if (next < 8 || next > 15) return;
    const newScores = { ...baseScores, [key]: next };
    if (getTotalPointsSpent(newScores) > POINT_BUY_TOTAL) return;
    setBaseScores(newScores);
  };

  const handleFinish = () => {
    const profBonus = getProficiencyBonus(1);
    const maxHP = calculateMaxHP(cls.hitDie, 1, finalScores.CON);
    const AC = 10 + getAbilityModifier(finalScores.DEX);

    setCharacter({
      name: characterName.trim(),
      race: { name: race.name, emoji: race.emoji },
      class: { name: cls.name, emoji: cls.emoji },
      level: 1,
      abilityScores: finalScores,
      maxHP,
      currentHP: maxHP,
      AC,
      speed: race.speed,
      proficiencyBonus: profBonus,
      proficientSkills: cls.skillChoices?.options?.slice(0, cls.skillChoices.count) || [],
      inventory: [...(cls.startingEquipment || [])],
      gold: 10,
      conditions: [],
    });

    navigation.navigate('DMConversation');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.background, '#110E08']} style={StyleSheet.absoluteFill} />

      {/* Progress bar */}
      <View style={styles.progressBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              i < step && styles.progressDotDone,
              i === step && styles.progressDotActive,
            ]}>
              <Text style={[styles.progressDotText, i <= step && styles.progressDotTextActive]}>
                {i < step ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[styles.progressLabel, i === step && styles.progressLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 0 && (
          <StepRace selectedId={selectedRaceId} onSelect={setSelectedRaceId} />
        )}
        {step === 1 && (
          <StepClass selectedId={selectedClassId} onSelect={setSelectedClassId} />
        )}
        {step === 2 && (
          <StepStats
            baseScores={baseScores}
            finalScores={finalScores}
            race={race}
            pointsRemaining={pointsRemaining}
            onAdjust={adjustScore}
          />
        )}
        {step === 3 && (
          <StepName
            name={characterName}
            onChange={setCharacterName}
            character={{ race, cls, finalScores }}
          />
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navRow}>
        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, !canAdvance() && styles.nextButtonDisabled]}
          onPress={() => step < 3 ? setStep(s => s + 1) : handleFinish()}
          disabled={!canAdvance()}
        >
          <Text style={styles.nextText}>{step === 3 ? 'Begin Adventure' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Step: Race ────────────────────────────────────────────────────────────────
function StepRace({ selectedId, onSelect }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Your Race</Text>
      <Text style={styles.stepSub}>Your heritage shapes your natural abilities.</Text>
      {RACES.map(race => (
        <TouchableOpacity
          key={race.id}
          style={[styles.optionCard, selectedId === race.id && styles.optionCardSelected]}
          onPress={() => onSelect(race.id)}
        >
          <View style={styles.optionHeader}>
            <Text style={styles.optionEmoji}>{race.emoji}</Text>
            <View style={styles.optionHeaderText}>
              <Text style={styles.optionName}>{race.name}</Text>
              <Text style={styles.optionTagline}>{race.tagline}</Text>
            </View>
          </View>
          {selectedId === race.id && (
            <View style={styles.optionExpanded}>
              <Text style={styles.optionLore}>{race.lore}</Text>
              <View style={styles.bonusRow}>
                {Object.entries(race.statBonuses).map(([k, v]) => (
                  <View key={k} style={styles.bonusPill}>
                    <Text style={styles.bonusText}>{k} {v > 0 ? `+${v}` : v}</Text>
                  </View>
                ))}
              </View>
              {race.traits.map(t => (
                <View key={t.name} style={styles.traitRow}>
                  <Text style={styles.traitName}>{t.name}: </Text>
                  <Text style={styles.traitDesc}>{t.description}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Step: Class ───────────────────────────────────────────────────────────────
function StepClass({ selectedId, onSelect }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Your Class</Text>
      <Text style={styles.stepSub}>Your calling defines how you face danger.</Text>
      {CLASSES.map(cls => (
        <TouchableOpacity
          key={cls.id}
          style={[styles.optionCard, selectedId === cls.id && styles.optionCardSelected]}
          onPress={() => onSelect(cls.id)}
        >
          <View style={styles.optionHeader}>
            <Text style={styles.optionEmoji}>{cls.emoji}</Text>
            <View style={styles.optionHeaderText}>
              <Text style={styles.optionName}>{cls.name}</Text>
              <Text style={styles.optionTagline}>{cls.tagline}</Text>
            </View>
            <View style={styles.hitDiePill}>
              <Text style={styles.hitDieText}>d{cls.hitDie}</Text>
            </View>
          </View>
          {selectedId === cls.id && (
            <View style={styles.optionExpanded}>
              <Text style={styles.optionLore}>{cls.description}</Text>
              <Text style={styles.subSectionLabel}>Level 1 Abilities</Text>
              {cls.level1Abilities.map(a => (
                <View key={a.name} style={styles.traitRow}>
                  <Text style={styles.traitName}>{a.name}: </Text>
                  <Text style={styles.traitDesc}>{a.description}</Text>
                </View>
              ))}
              <Text style={styles.subSectionLabel}>Saving Throws</Text>
              <Text style={styles.optionMeta}>{cls.savingThrows.join(' & ')}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Step: Stats ───────────────────────────────────────────────────────────────
function StepStats({ baseScores, finalScores, race, pointsRemaining, onAdjust }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Ability Scores</Text>
      <Text style={styles.stepSub}>Distribute your {POINT_BUY_TOTAL} points. All scores must be spent.</Text>

      <View style={styles.pointsRemaining}>
        <Text style={styles.pointsRemainingText}>
          {pointsRemaining} {pointsRemaining === 1 ? 'point' : 'points'} remaining
        </Text>
      </View>

      {ABILITY_KEYS.map(key => {
        const base = baseScores[key];
        const final = finalScores[key];
        const bonus = race?.statBonuses?.[key] || 0;
        const mod = getAbilityModifier(final);
        return (
          <View key={key} style={styles.statRow}>
            <View style={styles.statLabel}>
              <Text style={styles.statKey}>{key}</Text>
              <Text style={styles.statName}>{ABILITY_LABELS[key]}</Text>
            </View>
            <View style={styles.statControls}>
              <TouchableOpacity
                style={[styles.statBtn, base <= 8 && styles.statBtnDisabled]}
                onPress={() => onAdjust(key, -1)}
                disabled={base <= 8}
              >
                <Text style={styles.statBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.statScore}>
                <Text style={styles.statScoreText}>{final}</Text>
                {bonus > 0 && <Text style={styles.statBonus}>({base}+{bonus})</Text>}
              </View>
              <TouchableOpacity
                style={[styles.statBtn, (base >= 15 || pointsRemaining <= 0) && styles.statBtnDisabled]}
                onPress={() => onAdjust(key, 1)}
                disabled={base >= 15 || pointsRemaining <= 0}
              >
                <Text style={styles.statBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statMod}>
              <Text style={[styles.statModText, base === 8 ? styles.statModNeutral : (mod >= 0 ? styles.statModPos : styles.statModNeg)]}>
                {getModifierString(mod)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Step: Name ────────────────────────────────────────────────────────────────
function StepName({ name, onChange, character }) {
  const { race, cls, finalScores } = character;
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Name Your Character</Text>
      <Text style={styles.stepSub}>Choose a name that fits your legend.</Text>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{name || '???'}</Text>
        <Text style={styles.summaryInfo}>
          {race?.name || '—'} {cls?.name || '—'} · Level 1
        </Text>
        <View style={styles.summaryStats}>
          {Object.entries(finalScores).map(([k, v]) => (
            <View key={k} style={styles.summaryStatItem}>
              <Text style={styles.summaryStatKey}>{k}</Text>
              <Text style={styles.summaryStatVal}>{v}</Text>
              <Text style={styles.summaryStatMod}>{getModifierString(getAbilityModifier(v))}</Text>
            </View>
          ))}
        </View>
      </View>

      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={onChange}
        placeholder="Enter a name..."
        placeholderTextColor={COLORS.textMuted}
        maxLength={24}
        autoFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  stepContainer: { paddingTop: SPACING.lg },
  stepTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.xxl,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  stepSub: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },

  // Progress bar
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  progressStep: { alignItems: 'center', gap: 4 },
  progressDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaint },
  progressDotDone: { borderColor: COLORS.success, backgroundColor: COLORS.success },
  progressDotText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontWeight: '700' },
  progressDotTextActive: { color: COLORS.primary },
  progressLabel: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted },
  progressLabelActive: { color: COLORS.primary },

  // Option cards
  optionCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  optionCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceElevated },
  optionHeader: { flexDirection: 'row', alignItems: 'center' },
  optionEmoji: { fontSize: 24, marginRight: SPACING.sm },
  optionHeaderText: { flex: 1 },
  optionName: { fontFamily: FONTS.serif, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, fontWeight: '700' },
  optionTagline: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  optionExpanded: { marginTop: SPACING.md, borderTopWidth: 1, borderColor: COLORS.border, paddingTop: SPACING.md },
  optionLore: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.md },
  optionMeta: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary },

  bonusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  bonusPill: { backgroundColor: COLORS.primaryFaint, borderWidth: 1, borderColor: COLORS.primaryDark, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  bonusText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.primary, fontWeight: '700' },

  traitRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  traitName: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '700' },
  traitDesc: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1 },
  subSectionLabel: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.sm, marginBottom: 4 },

  hitDiePill: { backgroundColor: COLORS.surfaceHighlight, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  hitDieText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textSystem, fontWeight: '700' },

  // Stats
  pointsRemaining: { backgroundColor: COLORS.primaryFaint, borderWidth: 1, borderColor: COLORS.primaryDark, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center', marginBottom: SPACING.md },
  pointsRemainingText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '700' },
  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  statLabel: { flex: 1 },
  statKey: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, fontWeight: '700' },
  statName: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted },
  statControls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statBtn: { width: 32, height: 32, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceElevated },
  statBtnDisabled: { opacity: 0.3 },
  statBtnText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, lineHeight: 22 },
  statScore: { alignItems: 'center', minWidth: 44 },
  statScoreText: { fontFamily: FONTS.serif, fontSize: FONT_SIZES.xl, color: COLORS.textPrimary, fontWeight: '700' },
  statBonus: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.primary },
  statMod: { minWidth: 32, alignItems: 'flex-end' },
  statModText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, fontWeight: '700' },
  statModPos: { color: COLORS.success },
  statModNeg: { color: COLORS.danger },
  statModNeutral: { color: COLORS.textMuted },

  // Name
  summaryCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.lg },
  summaryTitle: { fontFamily: FONTS.serif, fontSize: FONT_SIZES.xxl, color: COLORS.primary, fontWeight: '700', marginBottom: 4 },
  summaryInfo: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.md },
  summaryStats: { flexDirection: 'row', gap: SPACING.sm },
  summaryStatItem: { alignItems: 'center' },
  summaryStatKey: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontWeight: '700' },
  summaryStatVal: { fontFamily: FONTS.serif, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, fontWeight: '700' },
  summaryStatMod: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  nameInput: {
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: RADIUS.lg, padding: SPACING.md, fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.xl, color: COLORS.textPrimary, textAlign: 'center',
  },

  // Nav buttons
  navRow: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    padding: SPACING.md, borderTopWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, gap: SPACING.md,
  },
  backButton: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  backText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  nextButton: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center' },
  nextButtonDisabled: { opacity: 0.4 },
  nextText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.lg, color: COLORS.black, fontWeight: '800' },
});
