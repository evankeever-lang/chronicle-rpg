import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

/**
 * Renders a single message from the uiMessages array.
 * Handles the role-based format used by DMConversationScreen:
 *   - role === 'user'      → player bubble (displayText)
 *   - role === 'assistant' → structured DM response object (narration, npc_dialogue, system_text)
 */
export default function DMMessage({ message }) {
  if (message.role === 'user') {
    if (!message.displayText) return null;
    return (
      <View style={styles.playerRow}>
        <View style={styles.playerBubble}>
          <Text style={styles.playerText}>{message.displayText}</Text>
        </View>
      </View>
    );
  }

  if (message.role === 'assistant') {
    const c = message.content;
    // Fallback: plain string (e.g. error messages)
    if (typeof c === 'string') {
      return <NarrationBlock text={c} />;
    }
    if (!c) return null;
    return (
      <View>
        {!!c.narration && <NarrationBlock text={c.narration} />}
        {!!c.npc_dialogue?.text && (
          <NpcBlock name={c.npc_dialogue.name} text={c.npc_dialogue.text} />
        )}
        {!!c.system_text && <SystemBlock content={c.system_text} />}
      </View>
    );
  }

  return null;
}

function NarrationBlock({ text }) {
  return (
    <View style={styles.dmRow}>
      <View style={[styles.accentBar, { backgroundColor: COLORS.accentNarration }]} />
      <View style={styles.dmContent}>
        <Text style={styles.narrationText}>{text}</Text>
      </View>
    </View>
  );
}

function NpcBlock({ name, text }) {
  return (
    <View style={styles.dmRow}>
      <View style={[styles.accentBar, { backgroundColor: COLORS.accentNPC }]} />
      <View style={styles.dmContent}>
        {!!name && <Text style={styles.npcName}>{name}</Text>}
        <Text style={styles.npcText}>"{text}"</Text>
      </View>
    </View>
  );
}

function SystemBlock({ content }) {
  return (
    <View style={styles.systemRow}>
      <View style={styles.systemContainer}>
        <View style={styles.systemHeader}>
          <Text style={styles.systemIcon}>•</Text>
        </View>
        <Text style={styles.systemText}>{content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Player message
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  playerBubble: {
    maxWidth: '78%',
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  playerText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },

  // DM narration / NPC row (left-aligned with accent bar)
  dmRow: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  dmContent: {
    flex: 1,
  },

  // Narration
  narrationText: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textNarration,
    lineHeight: 24,
    letterSpacing: 0.2,
  },

  // NPC dialogue
  npcName: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.accentNPC,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  npcText: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textNPC,
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // System messages
  systemRow: {
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  systemContainer: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.accentSystem,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  systemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  systemIcon: {
    fontSize: 16,
    color: COLORS.textSystem,
    marginRight: 6,
  },
  systemText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
