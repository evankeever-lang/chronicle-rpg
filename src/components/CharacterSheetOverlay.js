import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGame } from '../context/GameContext';
import { getAbilityModifier } from '../utils/dice';
import { ALL_SKILLS, SKILL_DISPLAY_NAMES, SKILL_TO_STAT } from '../constants/backgrounds';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

const TABS = ['Stats', 'Skills', 'Spells', 'Notes'];

const STAT_GROUPS = [
  { label: 'STR', skills: ['athletics'] },
  { label: 'DEX', skills: ['acrobatics', 'sleightOfHand', 'stealth'] },
  { label: 'INT', skills: ['arcana', 'history', 'investigation', 'nature', 'religion'] },
  { label: 'WIS', skills: ['animalHandling', 'insight', 'medicine', 'perception', 'survival'] },
  { label: 'CHA', skills: ['deception', 'intimidation', 'performance', 'persuasion'] },
];

const CONDITION_ICONS = {
  Poisoned: '🟣', Frightened: '😨', Stunned: '⚡', Prone: '💤',
  Blinded: '🚫', Charmed: '💜', Paralyzed: '🔒', Burning: '🔥',
};

function ProfDot({ level }) {
  // level: 0 = none, 1 = proficient, 2 = expertise
  if (level === 2) {
    return (
      <View style={styles.profDotWrap}>
        <View style={[styles.profDot, styles.profDotFull]} />
        <View style={[styles.profDot, styles.profDotFull, { marginLeft: 2 }]} />
      </View>
    );
  }
  return (
    <View style={styles.profDotWrap}>
      <View style={[styles.profDot, level === 1 ? styles.profDotFull : styles.profDotEmpty]} />
    </View>
  );
}

export default function CharacterSheetOverlay({ visible, onClose }) {
  const {
    character,
    xp = 0,
    xpToNext = 300,
    pendingLevelUp = false,
    sessionNotes = '',
    setSessionNotes,
    restoreSpellSlots,
    restoreHPFull,
    updateHP,
  } = useGame();

  const [activeTab, setActiveTab] = useState('Stats');

  const hp = character?.currentHP ?? 0;
  const maxHp = character?.maxHP ?? 1;
  const hpPct = Math.min(1, Math.max(0, hp / maxHp));
  const hpColor = hpPct <= 0.25 ? COLORS.hpLow : hpPct <= 0.5 ? COLORS.hp : COLORS.success;

  const profBonus = character?.proficiencyBonus ?? 2;
  const skills = character?.skills || {};
  const abilityScores = character?.abilityScores || {};
  const spellSlots = character?.spellSlots || { current: {}, max: {} };
  const isSpellcaster = character?.class?.spellcaster ?? false;

  const handleShortRest = () => {
    // Short rest: restore some HP via HD (simplified: restore 1d6+CON per HD used)
    const conMod = getAbilityModifier(abilityScores.CON || 10);
    const hitDie = character?.hitDie || 8;
    const roll = Math.ceil(Math.random() * hitDie) + conMod;
    const restored = Math.max(1, roll);
    const newHP = Math.min(maxHp, hp + restored);
    updateHP(newHP);
    restoreSpellSlots('short');
    Alert.alert('Short Rest', `You rest briefly and recover ${newHP - hp} HP.`);
  };

  const handleLongRest = () => {
    Alert.alert(
      'Long Rest',
      'You take a full rest. All HP and spell slots restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rest',
          onPress: () => {
            restoreHPFull();
            restoreSpellSlots('long');
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.charName}>{character?.name}</Text>
              <Text style={styles.charMeta}>
                {character?.race?.name} {character?.class?.name} · Level {character?.level}
                {character?.background?.name ? ` · ${character.background.name}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* XP bar */}
          <View style={styles.xpRow}>
            <View style={styles.xpBarBg}>
              <View style={[styles.xpBarFill, { width: `${Math.min(1, xp / xpToNext) * 100}%` }]} />
            </View>
            <Text style={styles.xpText}>
              {xp} / {xpToNext} XP{pendingLevelUp ? ' — Level Up!' : ''}
            </Text>
          </View>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {activeTab === 'Stats' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
              {/* HP bar */}
              <View style={styles.hpSection}>
                <View style={styles.hpLabelRow}>
                  <Text style={styles.hpLabel}>HP</Text>
                  <Text style={[styles.hpValue, { color: hpColor }]}>{hp} / {maxHp}</Text>
                </View>
                <View style={styles.hpBarBg}>
                  <View style={[styles.hpBarFill, { width: `${hpPct * 100}%`, backgroundColor: hpColor }]} />
                </View>
              </View>

              {/* Vitals row */}
              <View style={styles.vitalsRow}>
                {[
                  { label: 'AC', value: character?.AC ?? '—' },
                  { label: 'Speed', value: `${character?.speed ?? 30}ft` },
                  { label: 'Prof', value: `+${profBonus}` },
                  { label: 'Gold', value: `${character?.gold ?? 0}gp` },
                ].map(({ label, value }) => (
                  <View key={label} style={styles.vitalCell}>
                    <Text style={styles.vitalValue}>{value}</Text>
                    <Text style={styles.vitalLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Ability scores */}
              <Text style={styles.sectionLabel}>ABILITY SCORES</Text>
              <View style={styles.abilityGrid}>
                {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(key => {
                  const score = abilityScores[key] || 10;
                  const mod = getAbilityModifier(score);
                  return (
                    <View key={key} style={styles.abilityCell}>
                      <Text style={[styles.abilityMod, { color: mod >= 0 ? COLORS.success : COLORS.danger }]}>
                        {mod >= 0 ? `+${mod}` : `${mod}`}
                      </Text>
                      <Text style={styles.abilityScore}>{score}</Text>
                      <Text style={styles.abilityKey}>{key}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Conditions */}
              {(character?.conditions?.length > 0) && (
                <>
                  <Text style={styles.sectionLabel}>CONDITIONS</Text>
                  <View style={styles.conditionsRow}>
                    {character.conditions.map((c, i) => (
                      <View key={i} style={styles.conditionChip}>
                        <Text style={styles.conditionText}>
                          {CONDITION_ICONS[c] || '⚠'} {c}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Rest buttons */}
              <Text style={styles.sectionLabel}>REST</Text>
              <View style={styles.restRow}>
                <TouchableOpacity style={styles.restBtn} onPress={handleShortRest}>
                  <Text style={styles.restBtnText}>Short Rest</Text>
                  <Text style={styles.restBtnSub}>Recover some HP</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.restBtn, styles.restBtnLong]} onPress={handleLongRest}>
                  <Text style={styles.restBtnText}>Long Rest</Text>
                  <Text style={styles.restBtnSub}>Full restore</Text>
                </TouchableOpacity>
              </View>

              {/* Level Up button */}
              {pendingLevelUp && (
                <TouchableOpacity style={styles.levelUpBtn} onPress={onClose}>
                  <Text style={styles.levelUpBtnText}>⬆ Level Up Available!</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: SPACING.xxl }} />
            </ScrollView>
          )}

          {activeTab === 'Skills' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
              {STAT_GROUPS.map(group => (
                <View key={group.label} style={styles.skillGroup}>
                  <Text style={styles.skillGroupLabel}>{group.label}</Text>
                  {group.skills.map(sk => {
                    const statKey = SKILL_TO_STAT[sk];
                    const statScore = abilityScores[statKey] || 10;
                    const statMod = getAbilityModifier(statScore);
                    const profLevel = skills[sk] || 0;
                    const bonus = profLevel === 2
                      ? statMod + profBonus * 2
                      : profLevel === 1
                        ? statMod + profBonus
                        : statMod;
                    const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
                    return (
                      <View key={sk} style={styles.skillRow}>
                        <ProfDot level={profLevel} />
                        <Text style={[
                          styles.skillName,
                          profLevel > 0 && styles.skillNameProficient,
                        ]}>
                          {SKILL_DISPLAY_NAMES[sk]}
                        </Text>
                        <Text style={[
                          styles.skillBonus,
                          { color: bonus >= 0 ? COLORS.success : COLORS.danger },
                        ]}>
                          {bonusStr}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: SPACING.xxl }} />
            </ScrollView>
          )}

          {activeTab === 'Spells' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
              {!isSpellcaster ? (
                <Text style={styles.emptyText}>
                  {character?.class?.name || 'Your class'} does not use spell slots.
                </Text>
              ) : (
                <>
                  <Text style={styles.sectionLabel}>SPELL SLOTS</Text>
                  {[1, 2, 3, 4, 5].map(level => {
                    const maxSlots = spellSlots.max?.[level] || 0;
                    const curSlots = spellSlots.current?.[level] || 0;
                    if (maxSlots === 0) return null;
                    return (
                      <View key={level} style={styles.slotRow}>
                        <Text style={styles.slotLevel}>Level {level}</Text>
                        <View style={styles.slotPips}>
                          {Array.from({ length: maxSlots }).map((_, i) => (
                            <View
                              key={i}
                              style={[styles.slotPip, i < curSlots ? styles.slotPipFull : styles.slotPipEmpty]}
                            />
                          ))}
                        </View>
                        <Text style={styles.slotCount}>{curSlots}/{maxSlots}</Text>
                      </View>
                    );
                  })}

                  {character?.spellcastingAbility && (
                    <Text style={styles.spellAbilityNote}>
                      Spellcasting ability: {character.spellcastingAbility}
                    </Text>
                  )}

                  <Text style={styles.sectionLabel}>KNOWN SPELLS</Text>
                  {(character?.knownSpells?.length > 0) ? (
                    character.knownSpells.map((spell, i) => (
                      <Text key={i} style={styles.spellItem}>• {typeof spell === 'string' ? spell : spell.name}</Text>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No spells recorded yet. Ask your DM about spells during play.</Text>
                  )}
                </>
              )}
              <View style={{ height: SPACING.xxl }} />
            </ScrollView>
          )}

          {activeTab === 'Notes' && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesHint}>Your private session notes — persisted across saves.</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                placeholder="Write anything — quest leads, NPC names, items to remember…"
                placeholderTextColor={COLORS.textMuted}
                value={sessionNotes}
                onChangeText={setSessionNotes}
                textAlignVertical="top"
              />
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '92%',
    paddingTop: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
  },
  charName: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  charMeta: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  doneBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primaryFaint,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  doneBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  xpRow: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  xpBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#C9A84C',
    borderRadius: 2,
  },
  xpText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  sectionLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  // Stats tab
  hpSection: {
    marginBottom: SPACING.md,
  },
  hpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  hpLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hpValue: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  hpBarBg: {
    height: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  hpBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  vitalCell: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  vitalValue: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  vitalLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  abilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  abilityCell: {
    width: '30%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  abilityMod: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  abilityScore: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  abilityKey: {
    fontFamily: FONTS.sansSerif,
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  conditionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  conditionChip: {
    backgroundColor: '#1A0808',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  conditionText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.danger,
    fontWeight: '600',
  },
  restRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  restBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  restBtnLong: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
  },
  restBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  restBtnSub: {
    fontFamily: FONTS.sansSerif,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  levelUpBtn: {
    backgroundColor: '#1A140A',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  levelUpBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: '#C9A84C',
    fontWeight: '700',
  },
  // Skills tab
  skillGroup: {
    marginBottom: SPACING.md,
  },
  skillGroupLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceElevated,
    gap: SPACING.sm,
  },
  profDotWrap: {
    flexDirection: 'row',
    width: 20,
    alignItems: 'center',
  },
  profDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  profDotFull: {
    backgroundColor: COLORS.primary,
  },
  profDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skillName: {
    flex: 1,
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  skillNameProficient: {
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  skillBonus: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    width: 30,
    textAlign: 'right',
  },
  // Spells tab
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceElevated,
    gap: SPACING.sm,
  },
  slotLevel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    width: 60,
  },
  slotPips: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  slotPip: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  slotPipFull: {
    backgroundColor: COLORS.primary,
  },
  slotPipEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  slotCount: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    width: 30,
    textAlign: 'right',
  },
  spellAbilityNote: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
    textTransform: 'capitalize',
  },
  spellItem: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingVertical: 4,
  },
  emptyText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: SPACING.md,
  },
  // Notes tab
  notesContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  notesHint: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
  notesInput: {
    flex: 1,
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    minHeight: 300,
    lineHeight: 22,
  },
});
