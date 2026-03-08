import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

// Visual language:
// Narration  — the world speaking. Warm parchment background, serif prose, no speaker label.
// NPC        — a person speaking. Cool-tinted bg, name badge pill, quoted dialogue.
// System     — mechanical outcomes. Bordered card, icon + label.
// Player     — right-aligned bubble.

export default function DMMessage({ message }) {
  // ── Player message (role === 'user') ────────────────────────────────────────
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

  // ── DM message (role === 'assistant') ───────────────────────────────────────
  if (message.role === 'assistant') {
    const c = message.content;
    if (!c) return null;

    // Fallback: plain string (e.g. error messages)
    if (typeof c === 'string') {
      return <NarrationBlock text={c} />;
    }

    // Normalize npc_dialogue to array
    const npcLines = Array.isArray(c.npc_dialogue)
      ? c.npc_dialogue.filter(n => n?.text)
      : (c.npc_dialogue?.text ? [c.npc_dialogue] : []);

    return (
      <View>
        {!!c.narration && <NarrationBlock text={c.narration} />}
        {npcLines.map((npc, i) => (
          <NpcBlock key={i} name={npc.name} text={npc.text} />
        ))}
        {!!c.system_text && <SystemBlock content={c.system_text} />}
      </View>
    );
  }

  return null;
}

function NarrationBlock({ text }) {
  return (
    <View style={styles.narrationBlock}>
      <View style={styles.narrationBar} />
      <View style={styles.narrationContent}>
        <Text style={styles.narrationText}>{text}</Text>
      </View>
    </View>
  );
}

function NpcBlock({ name, text }) {
  return (
    <View style={styles.npcBlock}>
      <View style={styles.npcBar} />
      <View style={styles.npcContent}>
        {!!name && (
          <View style={styles.npcNameBadge}>
            <Text style={styles.npcNameText}>{name}</Text>
          </View>
        )}
        <Text style={styles.npcDialogue}>
          <Text style={styles.npcQuoteMark}>"</Text>
          {text}
          <Text style={styles.npcQuoteMark}>"</Text>
        </Text>
      </View>
    </View>
  );
}

function SystemBlock({ content }) {
  return <SystemMessage content={content} />;
}

function SystemMessage({ content }) {
  // Infer icon from the content string produced by callDM
  const icon = content?.toLowerCase().includes('check') ? '🎲'
    : content?.toLowerCase().includes('loot') || content?.toLowerCase().includes('discover') ? '📦'
    : content?.toLowerCase().includes('combat') ? '⚔️'
    : '⚡';

  return (
    <View style={styles.systemRow}>
      <View style={styles.systemContainer}>
        <View style={styles.systemHeader}>
          <Text style={styles.systemIcon}>{icon}</Text>
          {content ? <Text style={styles.systemLabel}>{content}</Text> : null}
        </View>
      </View>
    </View>
  );
}

// ─── Accent colours ───────────────────────────────────────────────────────────
const NARRATION_BAR    = '#C9A84C';   // gold
const NARRATION_BG     = '#1C1608';   // very dark warm amber — parchment in shadow
const NARRATION_TEXT   = '#EDE0C4';   // warm cream

const NPC_BAR          = '#4A9B7E';   // teal
const NPC_BG           = '#081614';   // very dark cool teal
const NPC_BADGE_BG     = '#4A9B7E22'; // teal wash
const NPC_BADGE_BORDER = '#4A9B7E66';
const NPC_NAME_TEXT    = '#7EB8A0';   // teal
const NPC_DIALOGUE     = '#C8DED8';   // cool off-white
const NPC_QUOTE        = '#4A9B7E';   // teal quote marks

const styles = StyleSheet.create({

  // ── Player bubble ──────────────────────────────────────────────────────────
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  playerBubble: {
    maxWidth: '78%',
    backgroundColor: '#1A1630',
    borderWidth: 1,
    borderColor: '#3A3460',
    borderRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  playerText: {
    fontFamily: FONTS?.sansSerif || 'System',
    fontSize: FONT_SIZES?.md || 15,
    color: '#EDE8D5',
    lineHeight: 22,
  },

  // ── Narration block ────────────────────────────────────────────────────────
  // Distinct warm parchment feel — clearly "the world describing"
  narrationBlock: {
    flexDirection: 'row',
    marginVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: NARRATION_BG,
  },
  narrationBar: {
    width: 3,
    backgroundColor: NARRATION_BAR,
  },
  narrationContent: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  narrationText: {
    fontFamily: FONTS?.serif || 'Georgia',
    fontSize: FONT_SIZES?.md || 15,
    color: NARRATION_TEXT,
    lineHeight: 26,
    letterSpacing: 0.2,
  },

  // ── NPC dialogue block ─────────────────────────────────────────────────────
  // Cool-tinted, clearly "a person speaking"
  npcBlock: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: NPC_BG,
  },
  npcBar: {
    width: 3,
    backgroundColor: NPC_BAR,
  },
  npcContent: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  npcNameBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NPC_BADGE_BG,
    borderWidth: 1,
    borderColor: NPC_BADGE_BORDER,
    borderRadius: RADIUS.pill || 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 7,
  },
  npcNameText: {
    fontFamily: FONTS?.sansSerif || 'System',
    fontSize: (FONT_SIZES?.sm || 12),
    color: NPC_NAME_TEXT,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  npcDialogue: {
    fontFamily: FONTS?.serif || 'Georgia',
    fontSize: FONT_SIZES?.md || 15,
    color: NPC_DIALOGUE,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  npcQuoteMark: {
    color: NPC_QUOTE,
    fontSize: (FONT_SIZES?.md || 15) + 2,
    fontStyle: 'normal',
    fontWeight: '700',
  },

  // ── System messages ────────────────────────────────────────────────────────
  systemRow: {
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  systemContainer: {
    backgroundColor: '#16122A',
    borderWidth: 1,
    borderColor: '#8A7AC066',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  systemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  systemIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  systemLabel: {
    fontFamily: FONTS?.sansSerif || 'System',
    fontSize: FONT_SIZES?.sm || 12,
    color: '#8A7AC0',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  systemText: {
    fontFamily: FONTS?.sansSerif || 'System',
    fontSize: FONT_SIZES?.sm || 12,
    color: '#9B9480',
    lineHeight: 20,
  },
  lootList: {
    marginTop: SPACING.xs,
  },
  lootItem: {
    fontFamily: FONTS?.sansSerif || 'System',
    fontSize: FONT_SIZES?.sm || 12,
    color: '#EDE8D5',
    lineHeight: 20,
  },
  lootGold: {
    fontFamily: FONTS?.sansSerif || 'System',
    fontSize: FONT_SIZES?.sm || 12,
    color: '#C9A84C',
    fontWeight: '700',
    marginTop: 4,
  },
});
