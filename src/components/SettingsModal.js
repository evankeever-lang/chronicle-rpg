import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  PanResponder,
} from 'react-native';
import { useGame } from '../context/GameContext';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

function VolumeRow({ label, settingKey, value, onSet, onAdjust }) {
  const trackWidth = useRef(0);
  const onSetRef = useRef(onSet);
  onSetRef.current = onSet;

  const resolveX = (x) => {
    const clamped = Math.max(0, Math.min(x, trackWidth.current));
    return Math.round((clamped / trackWidth.current) * 100);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (!trackWidth.current) return;
        onSetRef.current(settingKey, resolveX(evt.nativeEvent.locationX));
      },
      onPanResponderMove: (evt) => {
        if (!trackWidth.current) return;
        onSetRef.current(settingKey, resolveX(evt.nativeEvent.locationX));
      },
    })
  ).current;

  const pct = Math.min(100, Math.max(0, value));

  return (
    <View style={styles.volumeRow}>
      <View style={styles.volumeHeader}>
        <Text style={styles.volumeLabel}>{label}</Text>
        <Text style={styles.valueText}>{value}</Text>
      </View>
      <View style={styles.volumeControls}>
        <TouchableOpacity
          style={styles.adjBtn}
          onPress={() => onAdjust(settingKey, -5)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.adjBtnText}>−</Text>
        </TouchableOpacity>

        <View
          style={styles.trackContainer}
          onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
          {...panResponder.panHandlers}
        >
          <View style={styles.trackBg}>
            <View style={[styles.trackFill, { width: `${pct}%` }]} />
          </View>
          <View style={[styles.thumb, { left: `${pct}%` }]} />
        </View>

        <TouchableOpacity
          style={styles.adjBtn}
          onPress={() => onAdjust(settingKey, +5)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.adjBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SettingsModal({ visible, onClose }) {
  const { preferences, setPreferences } = useGame();
  const { masterVolume = 80, musicVolume = 70, sfxVolume = 80 } = preferences || {};

  const set = (key, val) => setPreferences({ [key]: Math.min(100, Math.max(0, val)) });
  const adjust = (key, delta) => set(key, (preferences[key] ?? 80) + delta);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Settings</Text>
        <View style={styles.divider} />
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          <Text style={styles.sectionHeader}>Audio</Text>
          <VolumeRow label="Master Volume" settingKey="masterVolume" value={masterVolume} onSet={set} onAdjust={adjust} />
          <VolumeRow label="Music Volume"  settingKey="musicVolume"  value={musicVolume}  onSet={set} onAdjust={adjust} />
          <VolumeRow label="SFX Volume"    settingKey="sfxVolume"    value={sfxVolume}    onSet={set} onAdjust={adjust} />
        </ScrollView>
        <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const THUMB_SIZE = 20;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: SPACING.xl,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  body: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  sectionHeader: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },

  volumeRow: {
    marginBottom: SPACING.lg,
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  volumeLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  valueText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    width: 28,
    textAlign: 'right',
  },
  volumeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  adjBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjBtnText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    lineHeight: 20,
    fontFamily: FONTS.sansSerif,
  },

  // Track: tall hit area so drags start easily
  trackContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  trackBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  // Thumb sits on top of the track bg, centered on the fill endpoint
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.primary,
    borderWidth: 2.5,
    borderColor: COLORS.surface,
    top: (32 - THUMB_SIZE) / 2,          // vertically centered in trackContainer
    marginLeft: -(THUMB_SIZE / 2),       // center the circle on the fill endpoint
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },

  doneBtn: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});
