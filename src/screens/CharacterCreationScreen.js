import React, { useState, useRef, useEffect, useCallback } from 'react';
import SettingsModal from '../components/SettingsModal';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, SafeAreaView, Image, Animated, PanResponder,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RACES, getRaceById } from '../constants/races';
import { CLASSES, getClassById } from '../constants/classes';
import { useGame } from '../context/GameContext';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  getAbilityModifier, getModifierString, getProficiencyBonus,
  calculateMaxHP, getTotalPointsSpent,
} from '../utils/dice';
import { RaceArt, ClassArt } from '../assets';

const STEPS = ['Race', 'Class', 'Stats', 'Name'];
const POINT_BUY_TOTAL = 27;
const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_LABELS = {
  STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
  INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};
const BASE_SCORES = { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 };

const RECOMMENDED_STATS = {
  fighter: { STR: 15, DEX: 13, CON: 14, INT: 9,  WIS: 11, CHA: 10 },
  wizard:  { STR: 8,  DEX: 13, CON: 12, INT: 15, WIS: 14, CHA: 10 },
  rogue:   { STR: 8,  DEX: 15, CON: 14, INT: 13, WIS: 10, CHA: 12 },
  cleric:  { STR: 13, DEX: 11, CON: 14, INT: 9,  WIS: 15, CHA: 10 },
  ranger:  { STR: 11, DEX: 15, CON: 13, INT: 10, WIS: 14, CHA: 9  },
  paladin: { STR: 15, DEX: 11, CON: 13, INT: 9,  WIS: 10, CHA: 14 },
};

const ABILITY_DESCRIPTIONS = {
  STR: 'Melee attacks, carrying capacity, and Strength checks',
  DEX: 'Ranged attacks, initiative, AC without armor, and Dexterity checks',
  CON: 'Determines your HP and concentration saves',
  INT: 'Powers wizard spells and Intelligence-based skill checks',
  WIS: 'Powers cleric/ranger spells and Perception/Insight checks',
  CHA: 'Powers paladin spells and social interaction checks',
};

const ABILITY_RATIONALE = {
  'fighter.STR': 'Primary attack stat',
  'fighter.CON': 'Maximizes your HP',
  'fighter.DEX': 'Boosts AC and initiative',
  'wizard.INT':  'Spell power and save DC',
  'wizard.WIS':  'Insight and concentration saves',
  'wizard.DEX':  'AC without armor',
  'rogue.DEX':   'Attack, AC, and stealth',
  'rogue.CON':   'Survivability for a light-armored class',
  'rogue.INT':   "Investigation and Thieves' Tools",
  'cleric.WIS':  'Spell power and save DC',
  'cleric.CON':  'Maximizes your HP',
  'cleric.STR':  'Melee attacks with mace',
  'ranger.DEX':  'Ranged attacks and AC',
  'ranger.WIS':  'Spell power and Perception',
  'ranger.CON':  'Survivability in the wild',
  'paladin.STR': 'Primary melee attack stat',
  'paladin.CHA': 'Spell power and Divine Sense',
  'paladin.CON': 'Maximizes your HP',
};

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - SPACING.lg * 2;
const CARD_H = 480;
const SWIPE_THRESHOLD = 60;
const SWIPE_VEL = 0.4;

// ── Swipe Card Deck ────────────────────────────────────────────────────────────
function SwipeCardDeck({ items, artMap, selectedId, onSelect }) {
  const initIdx = selectedId
    ? Math.max(0, items.findIndex(i => i.id === selectedId))
    : 0;

  const [displayIdx, setDisplayIdx] = useState(initIdx);
  const idxRef = useRef(initIdx);

  const translateX = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const isFlippedRef = useRef(false);

  // Auto-select currently visible card
  useEffect(() => {
    onSelect(items[displayIdx].id);
  }, [displayIdx]);

  // Reset flip when card changes
  useEffect(() => {
    flipAnim.setValue(0);
    isFlippedRef.current = false;
  }, [displayIdx]);

  const navigateCard = useCallback((newIdx) => {
    if (newIdx < 0 || newIdx >= items.length) {
      // Bounce back — at edge
      Animated.spring(translateX, {
        toValue: 0, useNativeDriver: false, tension: 200, friction: 15,
      }).start();
      return;
    }
    const goingForward = newIdx > idxRef.current;
    const exitVal = goingForward ? -SCREEN_W : SCREEN_W;
    const enterVal = goingForward ? SCREEN_W : -SCREEN_W;

    Animated.timing(translateX, {
      toValue: exitVal, duration: 200, useNativeDriver: false,
    }).start(() => {
      translateX.setValue(enterVal);
      idxRef.current = newIdx;
      setDisplayIdx(newIdx);
      Animated.spring(translateX, {
        toValue: 0, useNativeDriver: false, tension: 80, friction: 11,
      }).start();
    });
  }, [items.length]);

  const navigateRef = useRef(navigateCard);
  navigateRef.current = navigateCard;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => translateX.stopAnimation(),
    onPanResponderMove: (_, g) => translateX.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (g.dx < -SWIPE_THRESHOLD || g.vx < -SWIPE_VEL) {
        navigateRef.current(idxRef.current + 1);
      } else if (g.dx > SWIPE_THRESHOLD || g.vx > SWIPE_VEL) {
        navigateRef.current(idxRef.current - 1);
      } else {
        Animated.spring(translateX, {
          toValue: 0, useNativeDriver: false, tension: 200, friction: 15,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, {
        toValue: 0, useNativeDriver: false, tension: 200, friction: 15,
      }).start();
    },
  })).current;

  const handleFlip = () => {
    const toValue = isFlippedRef.current ? 0 : 1;
    isFlippedRef.current = !isFlippedRef.current;
    Animated.spring(flipAnim, {
      toValue, useNativeDriver: true, tension: 55, friction: 7,
    }).start();
  };

  // Front rotates from 0→180, back from -180→0 (avoids mirrored text)
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '180deg'],
  });
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1], outputRange: ['-180deg', '0deg'],
  });
  // Hide each face once it's past 90°
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0.45, 0.55], outputRange: [1, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0.45, 0.55], outputRange: [0, 1],
  });

  const item = items[displayIdx];
  const art = artMap[item.id];
  const isRace = 'lore' in item;

  return (
    <View style={deckStyles.wrapper}>
      {/* ── Card ─────────────────────────────────────────── */}
      <View style={deckStyles.cardArea} {...panResponder.panHandlers}>
        <Animated.View style={[deckStyles.cardOuter, { transform: [{ translateX }] }]}>
          {/* FRONT FACE */}
          <Animated.View
            style={[
              deckStyles.face,
              {
                opacity: frontOpacity,
                transform: [{ perspective: 1200 }, { rotateY: frontRotateY }],
              },
            ]}
            pointerEvents="auto"
          >
            <TouchableOpacity
              style={deckStyles.faceTouch}
              onPress={handleFlip}
              activeOpacity={0.95}
            >
              {art ? (
                <Image source={art} style={deckStyles.artImage} resizeMode="cover" />
              ) : (
                <View style={[deckStyles.artImage, deckStyles.artPlaceholder]}>
                  <Text style={deckStyles.placeholderEmoji}>{item.emoji}</Text>
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(13,11,7,0.97)']}
                style={deckStyles.frontGradient}
              >
                <Text style={deckStyles.cardName}>{item.name}</Text>
                <Text style={deckStyles.cardTagline}>{item.tagline}</Text>
                <View style={deckStyles.tapHintRow}>
                  <Text style={deckStyles.tapHint}>Tap to learn more</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* BACK FACE */}
          <Animated.View
            style={[
              deckStyles.face,
              deckStyles.backFace,
              {
                opacity: backOpacity,
                transform: [{ perspective: 1200 }, { rotateY: backRotateY }],
              },
            ]}
            pointerEvents="auto"
          >
            {/* Back header */}
            <View style={deckStyles.backHeader}>
              <Text style={deckStyles.backEmoji}>{item.emoji}</Text>
              <Text style={deckStyles.backName}>{item.name}</Text>
              {!isRace && (
                <View style={deckStyles.hitDiePill}>
                  <Text style={deckStyles.hitDieText}>d{item.hitDie}</Text>
                </View>
              )}
            </View>

            {/* Scrollable back content */}
            <ScrollView
              style={deckStyles.backScroll}
              contentContainerStyle={deckStyles.backScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={deckStyles.loreText}>
                {isRace ? item.lore : item.description}
              </Text>

              {/* Stat bonuses — races only */}
              {isRace && (
                <View style={deckStyles.bonusRow}>
                  {Object.entries(item.statBonuses).map(([k, v]) => (
                    <View key={k} style={deckStyles.bonusPill}>
                      <Text style={deckStyles.bonusText}>{k} {v > 0 ? `+${v}` : v}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={deckStyles.sectionLabel}>
                {isRace ? 'Racial Traits' : 'Level 1 Abilities'}
              </Text>
              {(isRace ? item.traits : item.level1Abilities).map(t => (
                <View key={t.name} style={deckStyles.traitRow}>
                  <Text style={deckStyles.traitName}>{t.name}</Text>
                  <Text style={deckStyles.traitDesc}>{t.description}</Text>
                </View>
              ))}

              {!isRace && (
                <>
                  <Text style={deckStyles.sectionLabel}>Saving Throws</Text>
                  <Text style={deckStyles.saveText}>{item.savingThrows.join(' & ')}</Text>
                </>
              )}
            </ScrollView>

            {/* Flip back */}
            <TouchableOpacity style={deckStyles.flipBackBtn} onPress={handleFlip}>
              <Text style={deckStyles.flipBackText}>↩  Show art</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>

      {/* ── Navigation dots ──────────────────────────────── */}
      <View style={deckStyles.dotsRow}>
        <TouchableOpacity
          style={[deckStyles.arrowBtn, displayIdx === 0 && deckStyles.arrowBtnDisabled]}
          onPress={() => navigateRef.current(displayIdx - 1)}
          disabled={displayIdx === 0}
        >
          <Text style={deckStyles.arrowText}>‹</Text>
        </TouchableOpacity>

        <View style={deckStyles.dots}>
          {items.map((_, i) => (
            <TouchableOpacity
              key={i}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={() => navigateRef.current(i)}
            >
              <View style={[deckStyles.dot, i === displayIdx && deckStyles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[deckStyles.arrowBtn, displayIdx === items.length - 1 && deckStyles.arrowBtnDisabled]}
          onPress={() => navigateRef.current(displayIdx + 1)}
          disabled={displayIdx === items.length - 1}
        >
          <Text style={deckStyles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function CharacterCreationScreen({ navigation }) {
  const { setCharacter } = useGame();

  const [step, setStep] = useState(0);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [baseScores, setBaseScores] = useState({ ...BASE_SCORES });
  const [characterName, setCharacterName] = useState('');
  const [useCustomStats, setUseCustomStats] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const race = getRaceById(selectedRaceId);
  const cls = getClassById(selectedClassId);

  const finalScores = race
    ? ABILITY_KEYS.reduce((acc, k) => ({ ...acc, [k]: baseScores[k] + (race.statBonuses[k] || 0) }), {})
    : { ...baseScores };

  const pointsSpent = getTotalPointsSpent(baseScores);
  const pointsRemaining = POINT_BUY_TOTAL - pointsSpent;

  useEffect(() => {
    if (step === 2 && selectedClassId) {
      const recommended = RECOMMENDED_STATS[selectedClassId];
      if (recommended) {
        setBaseScores({ ...recommended });
        setUseCustomStats(false);
      }
    }
  }, [step]);

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

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarBack} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.topBarBackText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.topBarSettings} onPress={() => setSettingsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.topBarSettingsText}>⚙</Text>
        </TouchableOpacity>
      </View>

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

      <ScrollView
        contentContainerStyle={styles.scroll}
        scrollEnabled={step >= 2}
        keyboardShouldPersistTaps="handled"
      >
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
            cls={cls}
            pointsRemaining={pointsRemaining}
            onAdjust={adjustScore}
            useCustomStats={useCustomStats}
            onToggleCustom={() => setUseCustomStats(v => !v)}
            onUseRecommended={() => {
              const recommended = RECOMMENDED_STATS[selectedClassId];
              if (recommended) setBaseScores({ ...recommended });
              setUseCustomStats(false);
            }}
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
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

// ── Step: Race ─────────────────────────────────────────────────────────────────
function StepRace({ selectedId, onSelect }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Your Race</Text>
      <Text style={styles.stepSub}>Your heritage shapes your natural abilities.</Text>
      <SwipeCardDeck
        items={RACES}
        artMap={RaceArt}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </View>
  );
}

// ── Step: Class ────────────────────────────────────────────────────────────────
function StepClass({ selectedId, onSelect }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Your Class</Text>
      <Text style={styles.stepSub}>Your calling defines how you face danger.</Text>
      <SwipeCardDeck
        items={CLASSES}
        artMap={ClassArt}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </View>
  );
}

// ── Step: Stats ────────────────────────────────────────────────────────────────
function StepStats({ baseScores, finalScores, race, cls, pointsRemaining, onAdjust, useCustomStats, onToggleCustom, onUseRecommended }) {
  const classId = cls?.id;
  const className = cls?.name || 'your class';

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Ability Scores</Text>

      {!useCustomStats ? (
        <>
          <Text style={styles.stepSub}>
            This build is optimised for {className}. Your highest scores go where they matter most.
          </Text>

          <View style={styles.recHeader}>
            <Text style={styles.recHeaderTitle}>Recommended for {className}</Text>
            <Text style={styles.recHeaderSub}>Tap Customize below to adjust any score manually.</Text>
          </View>

          {ABILITY_KEYS.map(key => {
            const base = baseScores[key];
            const final = finalScores[key];
            const bonus = race?.statBonuses?.[key] || 0;
            const mod = getAbilityModifier(final);
            const rationale = classId ? ABILITY_RATIONALE[`${classId}.${key}`] : null;
            return (
              <View key={key} style={[styles.statRow, styles.statRowTop]}>
                <View style={styles.statLabel}>
                  <Text style={styles.statKey}>{key}</Text>
                  <Text style={styles.statName}>{ABILITY_LABELS[key]}</Text>
                  <Text style={styles.statDesc}>{ABILITY_DESCRIPTIONS[key]}</Text>
                </View>
                <View style={styles.statRecRight}>
                  {rationale ? <Text style={styles.statRationale}>{rationale}</Text> : null}
                  <View style={styles.statRecScoreRow}>
                    <Text style={styles.statScoreText}>{final}</Text>
                    {bonus > 0 && <Text style={styles.statBonus}>({base}+{bonus})</Text>}
                    <Text style={[
                      styles.statModText,
                      mod > 0 ? styles.statModPos : mod < 0 ? styles.statModNeg : styles.statModNeutral,
                    ]}>
                      {getModifierString(mod)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.toggleModeBtn} onPress={onToggleCustom}>
            <Text style={styles.toggleModeBtnText}>Customize</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
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
              <View key={key} style={[styles.statRow, styles.statRowTop]}>
                <View style={styles.statLabel}>
                  <Text style={styles.statKey}>{key}</Text>
                  <Text style={styles.statName}>{ABILITY_LABELS[key]}</Text>
                  <Text style={styles.statDesc}>{ABILITY_DESCRIPTIONS[key]}</Text>
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
                  <Text style={[
                    styles.statModText,
                    base === 8 ? styles.statModNeutral : (mod >= 0 ? styles.statModPos : styles.statModNeg),
                  ]}>
                    {getModifierString(mod)}
                  </Text>
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.toggleModeBtn} onPress={onUseRecommended}>
            <Text style={styles.toggleModeBtnText}>Use Recommended</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ── Step: Name ─────────────────────────────────────────────────────────────────
function StepName({ name, onChange, character }) {
  const { race, cls, finalScores } = character;
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Name Your Character</Text>
      <Text style={styles.stepSub}>Choose a name that fits your legend.</Text>

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

// ── Deck styles ────────────────────────────────────────────────────────────────
const deckStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  cardArea: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: RADIUS.xxl,
    overflow: 'hidden',
  },
  cardOuter: {
    width: CARD_W,
    height: CARD_H,
  },
  face: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: RADIUS.xxl,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    ...SHADOWS.md,
  },
  faceTouch: {
    flex: 1,
  },
  backFace: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  artImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  artPlaceholder: {
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 72,
  },
  frontGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
  },
  cardName: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.display,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardTagline: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  tapHintRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  tapHint: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Back face
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  backEmoji: { fontSize: 22 },
  backName: {
    flex: 1,
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  hitDiePill: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  hitDieText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSystem,
    fontWeight: '700',
  },
  backScroll: {
    flex: 1,
  },
  backScrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  loreText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  bonusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  bonusPill: {
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  bonusText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  sectionLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  traitRow: {
    marginBottom: SPACING.sm,
  },
  traitName: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  traitDesc: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  saveText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  flipBackBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  flipBackText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },

  // Dots / arrows
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 20,
    borderRadius: 4,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: { opacity: 0.25 },
  arrowText: {
    fontFamily: FONTS.sansSerif,
    fontSize: 28,
    color: COLORS.primary,
    lineHeight: 32,
  },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
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

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  topBarBack: { width: 32, paddingVertical: 4 },
  topBarBackText: { fontSize: 22, color: COLORS.textSecondary },
  topBarSettings: { width: 32, alignItems: 'flex-end', paddingVertical: 4 },
  topBarSettingsText: { fontSize: 18, color: COLORS.textMuted },

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

  // Stats
  pointsRemaining: {
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1, borderColor: COLORS.primaryDark,
    borderRadius: RADIUS.md, padding: SPACING.sm,
    alignItems: 'center', marginBottom: SPACING.md,
  },
  pointsRemainingText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '700' },
  statRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  statLabel: { flex: 1 },
  statKey: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, fontWeight: '700' },
  statName: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted },
  statControls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statBtn: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
  },
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
  statRowTop: { alignItems: 'flex-start' },
  statDesc: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    lineHeight: 15,
    marginTop: 2,
  },
  statRecRight: {
    alignItems: 'flex-end',
    gap: 4,
    paddingTop: 2,
  },
  statRationale: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontStyle: 'italic',
    textAlign: 'right',
    maxWidth: 140,
  },
  statRecScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  recHeader: {
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  recHeaderTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  recHeaderSub: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  toggleModeBtn: {
    marginTop: SPACING.md,
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceElevated,
  },
  toggleModeBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // Name
  summaryCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.lg,
  },
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

  // Nav
  navRow: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    padding: SPACING.md, borderTopWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, gap: SPACING.md,
  },
  backButton: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  backText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  nextButton: {
    flex: 1, backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center',
  },
  nextButtonDisabled: { opacity: 0.4 },
  nextText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.lg, color: COLORS.black, fontWeight: '800' },
});
