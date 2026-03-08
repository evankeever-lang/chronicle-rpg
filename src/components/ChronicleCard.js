import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ScrollView } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export default function ChronicleCard({ character, campaign, summary, epithet, onClose, onNewGame }) {
  const handleShare = async () => {
    const raceName = character?.race?.name || character?.race || '';
    const className = character?.class?.name || character?.class || '';
    const shareText = [
      `⚔ THE CHRONICLE`,
      `${campaign?.title || 'An Adventure'}`,
      ``,
      summary || '',
      ``,
      `─────────────────`,
      `${character?.name?.toUpperCase()} · LVL ${character?.level} ${className.toUpperCase()}`,
      epithet || '',
      ``,
      `Play Project Chronicle`,
    ].join('\n');

    try {
      await Share.share({ message: shareText });
    } catch (_) {}
  };

  const raceName = character?.race?.name || character?.race || '';
  const className = character?.class?.name || character?.class || '';

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.headerSymbol}>⚔</Text>
            <Text style={styles.headerTitle}>THE CHRONICLE</Text>
            <Text style={styles.headerSymbol}>⚔</Text>
          </View>

          <Text style={styles.campaignTitle}>{campaign?.title || 'An Adventure'}</Text>
          <View style={styles.divider} />

          {/* Chronicle text */}
          <Text style={styles.chronicleText}>
            {summary || 'Your tale is still being written…'}
          </Text>

          <View style={styles.divider} />

          {/* Character footer */}
          <View style={styles.characterFooter}>
            <Text style={styles.characterName}>{character?.name}</Text>
            <Text style={styles.characterInfo}>
              Level {character?.level} {raceName} {className}
            </Text>
            {epithet ? <Text style={styles.epithet}>{epithet}</Text> : null}
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>Continue Playing</Text>
          </TouchableOpacity>

          {onNewGame && (
            <TouchableOpacity style={styles.btnSecondary} onPress={onNewGame} activeOpacity={0.85}>
              <Text style={styles.btnSecondaryText}>Start New Game</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btnShare} onPress={handleShare} activeOpacity={0.7}>
            <Text style={styles.btnShareText}>Share Chronicle</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    backgroundColor: '#1A1510',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderTopWidth: 1,
    borderColor: COLORS.primary,
    maxHeight: '90%',
    paddingBottom: SPACING.xl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  headerSymbol: {
    fontSize: 14,
    color: COLORS.primary,
  },
  headerTitle: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '800',
    letterSpacing: 3,
  },
  campaignTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  chronicleText: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  characterFooter: {
    alignItems: 'center',
  },
  characterName: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  characterInfo: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  epithet: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },

  actions: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.glow,
  },
  btnPrimaryText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.background,
    fontWeight: '800',
  },
  btnSecondary: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  btnShare: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  btnShareText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
});
