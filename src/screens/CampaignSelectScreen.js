import React, { useState, useEffect } from 'react';
import SettingsModal from '../components/SettingsModal';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CAMPAIGNS, SPAWN_POINTS, getCampaignById } from '../constants/campaigns';
import { getDefaultPersonaForCampaign, getPersonaById } from '../constants/personas';
import { useGame } from '../context/GameContext';
import { loadProgress } from '../utils/progress';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { SpawnArt, CampaignArt } from '../assets';

// Region accent colours — used as gradient fallback when spawn art is not yet set
const REGION_COLORS = {
  heartlands:     ['#3D2E0A', '#1C160A'],
  tidebreak_coast:['#0A1F2E', '#080E14'],
  ashpeaks:       ['#1E1E2A', '#0E0E14'],
  lowfen:         ['#0E1F0E', '#080F08'],
  scorched_reach: ['#2E1206', '#140903'],
  thornwood:      ['#0A1A0A', '#060C06'],
  emberveil:      ['#2A0A0A', '#120606'],
};

const DIFFICULTY_COLORS = {
  Introduction: COLORS.success,
  Standard:     COLORS.warning,
  Challenging:  COLORS.danger,
  Variable:     COLORS.textSecondary,
};

export default function CampaignSelectScreen({ navigation }) {
  const { setCampaign } = useGame();
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  useEffect(() => {
    loadProgress().then(p => setTutorialCompleted(!!p.tutorialCompleted));
  }, []);

  // Tutorial tap — sets tutorial campaign and navigates to CharacterCreation
  const handleTutorial = () => {
    const tutorial = getCampaignById('tutorial');
    const persona = getPersonaById(getDefaultPersonaForCampaign('tutorial'));
    setCampaign(tutorial, persona);
    navigation.navigate('CharacterCreation');
  };

  // Spawn point tap — builds an epic_quest variant with an opening directive
  const handleSelectSpawn = (spawnPoint) => {
    const baseNonRandom = SPAWN_POINTS.filter(sp => !sp.isRandom);

    // Random: pick one of the 9 real spawn points at random
    const resolved = spawnPoint.isRandom
      ? baseNonRandom[Math.floor(Math.random() * baseNonRandom.length)]
      : spawnPoint;

    const epicQuest = getCampaignById('epic_quest');
    const campaignVariant = {
      ...epicQuest,
      startingLocation: resolved.locationId,
      startingLocationName: resolved.name,
      dmBrief: `${resolved.dmOpeningDirective}\n\n---\n\n${epicQuest.dmBrief}`,
    };

    const persona = getPersonaById(getDefaultPersonaForCampaign('epic_quest'));
    setCampaign(campaignVariant, persona);
    navigation.navigate('CharacterCreation');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.background, '#0A0806']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBack}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerBackText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEpigraph}>⚔  Araxys  ⚔</Text>
            <Text style={styles.headerTitle}>Where do you begin?</Text>
            <Text style={styles.headerSub}>Choose your first step into the Kingdom of Aranthos</Text>
          </View>
          <TouchableOpacity
            style={styles.headerSettings}
            onPress={() => setSettingsVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerSettingsText}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Tutorial banner — always accessible, separated from main grid */}
        <TutorialBanner onPress={handleTutorial} />

        {/* Section label */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Spawn Points</Text>
          {!tutorialCompleted && (
            <Text style={styles.sectionLocked}>Complete the tutorial to unlock</Text>
          )}
        </View>

        {/* Spawn point cards */}
        {SPAWN_POINTS.map((sp) => (
          <SpawnCard
            key={sp.id}
            spawnPoint={sp}
            locked={!tutorialCompleted}
            onPress={tutorialCompleted ? () => handleSelectSpawn(sp) : undefined}
          />
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>More regions coming in future seasons</Text>
        </View>
      </ScrollView>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Tutorial Banner ──────────────────────────────────────────────────────────

function TutorialBanner({ onPress }) {
  const tutorial = getCampaignById('tutorial');
  return (
    <TouchableOpacity style={styles.tutorialBanner} onPress={onPress} activeOpacity={0.85}>
      {CampaignArt.tutorial && (
        <Image source={CampaignArt.tutorial} style={styles.tutorialBannerArt} resizeMode="cover" />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.82)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tutorialBannerInner}>
        <View style={styles.tutorialBadge}>
          <Text style={styles.tutorialBadgeText}>New to Chronicle?</Text>
        </View>
        <Text style={styles.tutorialBannerTitle}>{tutorial.title}</Text>
        <Text style={styles.tutorialBannerDesc}>{tutorial.description}</Text>
        <Text style={styles.tutorialCTA}>Begin Tutorial →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Spawn Point Card ─────────────────────────────────────────────────────────

function SpawnCard({ spawnPoint, locked, onPress }) {
  const art = SpawnArt[spawnPoint.id];
  const gradientColors = REGION_COLORS[spawnPoint.regionId] || ['#1A1208', '#0A0806'];

  return (
    <TouchableOpacity
      style={[styles.card, locked && styles.cardLocked]}
      onPress={onPress}
      activeOpacity={locked ? 1 : 0.85}
      disabled={locked}
    >
      {/* Art / gradient banner */}
      <View style={styles.cardBannerWrap}>
        {art ? (
          <ImageBackground source={art} style={styles.cardBanner} resizeMode="cover">
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.65)']}
              style={StyleSheet.absoluteFill}
            />
            <CardBannerOverlay spawnPoint={spawnPoint} locked={locked} />
          </ImageBackground>
        ) : (
          <LinearGradient colors={gradientColors} style={styles.cardBanner}>
            <CardBannerOverlay spawnPoint={spawnPoint} locked={locked} />
          </LinearGradient>
        )}
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTagline}>{spawnPoint.tagline}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.diffBadge, { borderColor: DIFFICULTY_COLORS[spawnPoint.difficulty] || COLORS.textMuted }]}>
            <Text style={[styles.diffText, { color: DIFFICULTY_COLORS[spawnPoint.difficulty] || COLORS.textMuted }]}>
              {spawnPoint.difficulty}
            </Text>
          </View>
          {!spawnPoint.isRandom && (
            <Text style={styles.regionChip}>{spawnPoint.region}</Text>
          )}
        </View>
      </View>

      {/* CTA / locked footer */}
      {locked ? (
        <View style={styles.lockedFooter}>
          <Text style={styles.lockedFooterText}>Complete the tutorial to unlock</Text>
        </View>
      ) : (
        <View style={styles.cardCTA}>
          <Text style={styles.cardCTAText}>
            {spawnPoint.isRandom ? 'Let Fate Decide →' : 'Begin Here →'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function CardBannerOverlay({ spawnPoint, locked }) {
  return (
    <View style={styles.bannerOverlay}>
      <View style={styles.bannerTop}>
        {spawnPoint.isRandom ? (
          <Text style={styles.bannerIcon}>🎲</Text>
        ) : (
          <Text style={styles.cityChip}>{spawnPoint.city}</Text>
        )}
        {locked && <Text style={styles.lockIcon}>🔒</Text>}
      </View>
      <Text style={styles.bannerTitle}>{spawnPoint.name}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },

  // Header
  header: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerBack:      { width: 32, paddingTop: 2 },
  headerBackText:  { fontSize: 22, color: COLORS.textSecondary },
  headerCenter:    { flex: 1, alignItems: 'center' },
  headerSettings:  { width: 32, alignItems: 'flex-end', paddingTop: 2 },
  headerSettingsText: { fontSize: 18, color: COLORS.textMuted },
  headerEpigraph: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.display,
    color: COLORS.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Tutorial banner
  tutorialBanner: {
    height: 130,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    ...SHADOWS.md,
  },
  tutorialBannerArt: {
    ...StyleSheet.absoluteFillObject,
  },
  tutorialBannerInner: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'flex-end',
  },
  tutorialBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginBottom: SPACING.xs,
  },
  tutorialBadgeText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tutorialBannerTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  tutorialBannerDesc: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tutorialCTA: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },

  // Section row
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  sectionLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
  },
  sectionLocked: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },

  // Spawn card
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  cardLocked: { opacity: 0.55 },

  cardBannerWrap: { width: '100%' },
  cardBanner: {
    width: '100%',
    height: 110,
    justifyContent: 'flex-end',
  },

  bannerOverlay: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  bannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.lg,
    color: '#FFFFFF',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cityChip: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  bannerIcon: { fontSize: 20 },
  lockIcon:   { fontSize: 14 },

  cardBody: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  cardTagline: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  diffBadge: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  diffText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  regionChip: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },

  cardCTA: {
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceElevated,
  },
  cardCTAText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '700',
    textAlign: 'right',
  },

  lockedFooter: {
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceElevated,
  },
  lockedFooterText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  footer: {
    paddingTop: SPACING.md,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
