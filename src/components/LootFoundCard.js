import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

const ITEM_TYPE_ICON = {
  weapon: '🗡',
  armor: '🛡',
  consumable: '🧪',
  quest: '🔑',
  misc: '📦',
};

/**
 * Slides up from the bottom of DMConversationScreen when new loot is received.
 * Auto-dismisses after 3 seconds. Tap anywhere to dismiss early.
 *
 * Props:
 *   loot: { items: [string | { name, type }], gold: number } | null
 *   onDismiss: () => void
 */
export default function LootFoundCard({ loot, onDismiss }) {
  const slideAnim = useRef(new Animated.Value(120)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!loot) return;

    // Slide in
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 90, friction: 12,
    }).start();

    // Auto-dismiss after 3 seconds
    timerRef.current = setTimeout(() => {
      dismiss();
    }, 3000);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [loot]);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: 120, duration: 200, useNativeDriver: true,
    }).start(() => onDismiss?.());
  };

  if (!loot) return null;

  const items = loot.items || [];
  const gold = loot.gold || 0;

  return (
    <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.inner} onPress={dismiss} activeOpacity={0.95}>
        <Text style={styles.header}>⚔ Loot Found</Text>
        {items.map((item, i) => {
          const name = typeof item === 'string' ? item : item.name;
          const type = typeof item === 'object' ? item.type : 'misc';
          const icon = ITEM_TYPE_ICON[type] || ITEM_TYPE_ICON.misc;
          return (
            <Text key={i} style={styles.itemRow}>{icon}  {name}</Text>
          );
        })}
        {gold > 0 && (
          <Text style={styles.goldRow}>🪙 +{gold} gp</Text>
        )}
        <Text style={styles.dismiss}>Tap to dismiss</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 120,
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 100,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  inner: {
    backgroundColor: '#1A1204',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  header: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.lg,
    color: '#C9A84C',
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  itemRow: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  goldRow: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: '#D4860B',
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  dismiss: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'right',
  },
});
