import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CAMPAIGNS } from '../constants/campaigns';
import { getDefaultPersonaForCampaign, getPersonaById } from '../constants/personas';
import { useGame } from '../context/GameContext';
import { loadProgress } from '../utils/progress';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const DIFFICULTY_COLORS = {
  Introduction: COLORS.success,
  Standard: COLORS.warning,
  Challenging: COLORS.danger,
  Variable: COLORS.textSecondary,
};

const GENRE_EMOJIS = {
  Tutorial: '📖',
  'Epic Quest': '⚔️',
  'Dungeon Crawl': '🏚️',
  Random: '🎲',
  Mystery: '🔍',
  Horror: '🌑',
};

export default function CampaignSelectScreen({ navigation }) {
  const { setCampaign } = useGame();
  const [tutorialCompleted, setTutorialCompleted] = useState(false);

  useEffect(() => {
    loadProgress().then(p => setTutorialCompleted(!!p.tutorialCompleted));
  }, []);

  const handleSelectCampaign = (campaign) => {
    const personaId = getDefaultPersonaForCampaign(campaign.id);
    const persona = getPersonaById(personaId);
    setCampaign(campaign, persona);
    navigation.navigate('CharacterCreation');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[COLORS.background, '#110E08']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerEpigraph}>⚔  Project Chronicle  ⚔</Text>
          <Text style={styles.headerTitle}>Choose Your Path</Text>
          <Text style={styles.headerSub}>Select a campaign to begin your adventure</Text>
        </View>

        {/* Campaign cards */}
        {CAMPAIGNS.map((campaign) => {
          const locked = !campaign.isTutorial && !tutorialCompleted;
          return (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              locked={locked}
              onPress={locked ? undefined : () => handleSelectCampaign(campaign)}
            />
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>More campaigns coming in future seasons</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CampaignCard({ campaign, locked, onPress }) {
  const personaId = getDefaultPersonaForCampaign(campaign.id);
  const persona = getPersonaById(personaId);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={locked ? 1 : 0.85}
      disabled={locked}
    >
      <View style={styles.cardInner}>
        {/* Genre row + badges */}
        <View style={styles.cardTopRow}>
          <View style={styles.genreTag}>
            <Text style={styles.genreEmoji}>{GENRE_EMOJIS[campaign.genre] || '📜'}</Text>
            <Text style={styles.genreText}>{campaign.genre}</Text>
          </View>
          {campaign.isTutorial && (
            <View style={styles.tutorialBadge}>
              <Text style={styles.tutorialBadgeText}>Start Here</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardTitle}>{campaign.title}</Text>
        <Text style={styles.cardDescription}>{campaign.description}</Text>

        {/* Tags */}
        <View style={styles.tagsRow}>
          <Tag label={campaign.tone} />
          <Tag label={campaign.estimatedLength} dimmed />
          <Tag label={campaign.difficulty} color={DIFFICULTY_COLORS[campaign.difficulty]} />
        </View>

        {/* DM Persona */}
        <View style={styles.personaRow}>
          <Text style={styles.personaLabel}>DM: </Text>
          <Text style={styles.personaName}>{persona.name}</Text>
          <Text style={styles.personaTone}> · {persona.title}</Text>
        </View>
      </View>

      {/* CTA footer */}
      {locked ? (
        <View style={styles.lockedFooter}>
          <Text style={styles.lockedFooterText}>
            Complete the tutorial to unlock
          </Text>
        </View>
      ) : (
        <View style={styles.cardCTA}>
          <Text style={styles.cardCTAText}>
            {campaign.isRandom ? 'Spin the Tale →' : 'Begin Adventure →'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function Tag({ label, color, dimmed }) {
  return (
    <View style={[styles.tag, dimmed && styles.tagDimmed]}>
      <Text style={[styles.tagText, color && { color }, dimmed && styles.tagTextDimmed]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },

  header: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  },
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
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  cardInner: { padding: SPACING.lg },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  genreTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  genreEmoji: { fontSize: 14 },
  genreText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  tutorialBadge: {
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  tutorialBadgeText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  cardTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  cardDescription: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  tag: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  tagDimmed: { opacity: 0.6 },
  tagText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tagTextDimmed: { color: COLORS.textMuted },

  personaRow: { flexDirection: 'row', alignItems: 'center' },
  personaLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  personaName: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontStyle: 'italic',
  },
  personaTone: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
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
    fontSize: FONT_SIZES.md,
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
