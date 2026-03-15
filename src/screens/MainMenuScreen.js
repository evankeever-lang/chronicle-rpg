import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Modal,
  ScrollView,
  ImageBackground,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { loadGame, deleteSave, timeSince } from '../utils/storage';
import { startMenuMusic } from '../utils/menuMusic';
import { Splashes, DiceFaceArt } from '../assets';
import { resetProgress } from '../utils/progress';
import { useGame } from '../context/GameContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import SettingsModal from '../components/SettingsModal';

const DICE_SKINS = [
  { key: 'default',   label: 'Classic',   image: DiceFaceArt.classic },
  { key: 'graystone', label: 'Graystone', image: DiceFaceArt.graystone },
  { key: 'obsidian',  label: 'Obsidian',  image: DiceFaceArt.obsidian  },
  { key: 'dragon',    label: 'Dragon',    image: DiceFaceArt.dragon    },
  { key: 'crystal',   label: 'Crystal',   image: DiceFaceArt.crystal   },
];

const HOW_TO_PLAY = [
  {
    heading: 'Your AI Dungeon Master',
    body: 'Chronicle uses an AI Dungeon Master that remembers your choices, reacts to your decisions, and shapes the story around you. Type anything — describe what you do, say, or investigate.',
  },
  {
    heading: 'Sessions & Turns',
    body: 'Each session gives you 40 player turns. The DM responds to each of yours. At turn 32 you will be warned that the session is drawing to a close.',
  },
  {
    heading: 'Suggested Actions',
    body: 'After each DM response, three action chips appear. Tap one to send it instantly, or write your own. You are never limited to the suggestions.',
  },
  {
    heading: 'Dice Rolls',
    body: "When the story calls for it — a Perception check, an attack, a Persuasion attempt — the DM will trigger a dice roll. A die appears on screen. Roll it. Your result shapes what happens next.",
  },
  {
    heading: 'The Chronicle',
    body: "At session end, your Chronicle is automatically written — a third-person narrative of your adventure — and you're assigned an epithet based on how you played.",
  },
  {
    heading: 'Your Character',
    body: 'HP, AC, inventory, and conditions are all tracked in the HUD at the top. The DM updates them automatically when you take damage, find loot, or gain conditions.',
  },
  {
    heading: 'Auto-Save',
    body: 'Your progress saves automatically after every DM response. Return anytime and pick up exactly where you left off.',
  },
];

export default function MainMenuScreen({ navigation }) {
  const { loadSavedGame, preferences, setDiceSkin } = useGame();
  const [saveData, setSaveData] = useState(null);
  const [checking, setChecking] = useState(true);
  const [howToPlayVisible, setHowToPlayVisible] = useState(false);
  const [skinModalVisible, setSkinModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    startMenuMusic();
    loadGame().then((save) => {
      setSaveData(save);
      setChecking(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const handleContinue = () => {
    if (!saveData) return;
    loadSavedGame(saveData);
    navigation.navigate('DMConversation');
  };

  const handleNewGame = () => {
    if (saveData) {
      Alert.alert(
        'Start New Game?',
        'Your current save will be replaced when you begin playing. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'New Game', style: 'destructive', onPress: () => navigation.navigate('CampaignSelect') },
        ]
      );
    } else {
      navigation.navigate('CampaignSelect');
    }
  };

  const handleEraseSave = () => {
    Alert.alert(
      'Erase Save?',
      'This will permanently delete your saved adventure. There is no going back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            await deleteSave();
            await resetProgress();
            setSaveData(null);
          },
        },
      ]
    );
  };

  if (checking) return <View style={styles.splash} />;

  const char = saveData?.character;
  const hasSave = !!saveData;

  return (
    <ImageBackground
      source={Splashes.mainMenu}
      style={styles.bgImage}
      resizeMode="cover"
    >
    <SafeAreaView style={styles.safe}>
      {/* Dark overlay so UI text stays legible over the image */}
      <LinearGradient
        colors={['rgba(9,8,15,0.55)', 'rgba(13,11,7,0.72)', 'rgba(9,8,15,0.90)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowTop} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Title ── */}
        <View style={styles.titleSection}>
          <Text style={styles.eyebrow}>Project</Text>
          <Text style={styles.title}>Chronicle</Text>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerGem} />
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.tagline}>An AI-Powered Tabletop Adventure</Text>
        </View>

        {/* ── Save card ── */}
        {hasSave && (
          <View style={styles.saveCard}>
            <View style={styles.saveCardHeader}>
              <Text style={styles.saveCardLabel}>LAST SAVE</Text>
              <Text style={styles.saveCardTime}>{timeSince(saveData.savedAt)}</Text>
            </View>
            <View style={styles.saveCardBody}>
              <View style={styles.savePortrait}>
                <Text style={styles.savePortraitInitial}>{char?.race?.name?.[0] || char?.name?.[0] || '?'}</Text>
              </View>
              <View style={styles.saveInfo}>
                <Text style={styles.saveCharName}>{char?.name || 'Unknown Hero'}</Text>
                <Text style={styles.saveCharMeta}>
                  {[char?.race?.name, char?.class?.name].filter(Boolean).join(' ')}
                  {char?.level ? ` · Level ${char.level}` : ''}
                </Text>
                <Text style={styles.saveCampaign} numberOfLines={1}>
                  {saveData.campaign?.title || 'Unknown Campaign'}
                </Text>
              </View>
            </View>
            {saveData.sessionMessageCount > 0 && (
              <Text style={styles.saveTurns}>{saveData.sessionMessageCount} turns played</Text>
            )}
          </View>
        )}

        {/* ── Main buttons ── */}
        <View style={styles.buttons}>
          {hasSave && (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleContinue} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>Continue Adventure</Text>
              <Text style={styles.btnPrimaryArrow}>→</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={hasSave ? styles.btnSecondary : styles.btnPrimary}
            onPress={handleNewGame}
            activeOpacity={0.85}
          >
            <Text style={hasSave ? styles.btnSecondaryText : styles.btnPrimaryText}>
              {hasSave ? 'New Game' : 'Begin Your Adventure'}
            </Text>
            {!hasSave && <Text style={styles.btnPrimaryArrow}>→</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Secondary options grid ── */}
        <View style={styles.secondaryGrid}>
          <TouchableOpacity style={styles.secondaryTile} onPress={() => setSettingsVisible(true)} activeOpacity={0.75}>
            <Text style={styles.secondaryTileText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryTile} onPress={() => setHowToPlayVisible(true)} activeOpacity={0.75}>
            <Text style={styles.secondaryTileText}>How to Play</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryTile} onPress={() => setSkinModalVisible(true)} activeOpacity={0.75}>
            <Text style={styles.secondaryTileText}>Dice Skins</Text>
          </TouchableOpacity>
          {hasSave ? (
            <TouchableOpacity style={[styles.secondaryTile, styles.secondaryTileDanger]} onPress={handleEraseSave} activeOpacity={0.75}>
              <Text style={[styles.secondaryTileText, styles.secondaryTileTextDanger]}>Erase Save</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.secondaryTile} onPress={() => setHowToPlayVisible(true)} activeOpacity={0.75}>
              <Text style={styles.secondaryTileText}>About</Text>
            </TouchableOpacity>
          )}
        </View>


      </Animated.View>

      {/* ── Dice Skin modal ── */}
      <Modal visible={skinModalVisible} animationType="slide" transparent onRequestClose={() => setSkinModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Choose Your Dice</Text>
            <View style={styles.modalDivider} />
            <ScrollView contentContainerStyle={styles.skinGrid} showsVerticalScrollIndicator={false}>
              {DICE_SKINS.map((skin) => {
                const isSelected = (preferences?.diceSkin || 'default') === skin.key;
                return (
                  <TouchableOpacity
                    key={skin.key}
                    style={[styles.skinCard, isSelected && styles.skinCardSelected]}
                    onPress={() => setDiceSkin(skin.key)}
                    activeOpacity={0.8}
                  >
                    {skin.image ? (
                      <Image source={skin.image} style={styles.skinCardImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.skinCardClassic}>
                        <Text style={styles.skinCardClassicDie}>D6</Text>
                      </View>
                    )}
                    <Text style={[styles.skinCardLabel, isSelected && styles.skinCardLabelSelected]}>
                      {skin.label}
                    </Text>
                    {isSelected && <View style={styles.skinCardCheck}><View style={styles.skinCardCheckDot} /></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSkinModalVisible(false)} activeOpacity={0.85}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── How to Play modal ── */}
      <Modal visible={howToPlayVisible} animationType="slide" transparent onRequestClose={() => setHowToPlayVisible(false)} >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>How to Play</Text>
            <View style={styles.modalDivider} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {HOW_TO_PLAY.map((item, i) => (
                <View key={i} style={styles.modalItem}>
                  <Text style={styles.modalItemHeading}>{item.heading}</Text>
                  <Text style={styles.modalItemBody}>{item.body}</Text>
                </View>
              ))}
              <View style={styles.modalFooter}>
                <Text style={styles.modalFooterText}>Project Chronicle · Early Access</Text>
                <Text style={styles.modalFooterText}>Powered by Claude (Anthropic)</Text>
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setHowToPlayVisible(false)} activeOpacity={0.85}>
              <Text style={styles.modalCloseText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#0D0B07' },
  bgImage: { flex: 1 },
  safe: { flex: 1, backgroundColor: 'transparent' },

  glowTop: {
    position: 'absolute', top: -80, alignSelf: 'center',
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: COLORS.primary, opacity: 0.04,
  },

  content: {
    flex: 1, paddingHorizontal: SPACING.lg, justifyContent: 'center', paddingBottom: SPACING.xl,
  },

  // Title
  titleSection: { alignItems: 'center', marginBottom: SPACING.xl },
  eyebrow: {
    fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.primary,
    letterSpacing: 4, textTransform: 'uppercase', marginBottom: SPACING.sm, opacity: 0.8,
  },
  title: {
    fontFamily: FONTS.serif, fontSize: 56, color: COLORS.textPrimary,
    fontWeight: '700', letterSpacing: 2, marginBottom: SPACING.md,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm, width: '60%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.primary, opacity: 0.4 },
  dividerGem: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, opacity: 0.7 },
  tagline: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, letterSpacing: 0.5 },

  // Save card
  saveCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOWS.md,
  },
  saveCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  saveCardLabel: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.primary, letterSpacing: 2, fontWeight: '700' },
  saveCardTime: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted },
  saveCardBody: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  savePortrait: {
    width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1, borderColor: COLORS.primaryDark, alignItems: 'center', justifyContent: 'center',
  },
  savePortraitInitial: {
    fontSize: 20, color: COLORS.primary, fontFamily: FONTS.serif,
    fontWeight: '700', textTransform: 'uppercase',
  },
  saveInfo: { flex: 1 },
  saveCharName: { fontFamily: FONTS.serif, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, fontWeight: '700' },
  saveCharMeta: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  saveCampaign: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.primary, fontStyle: 'italic', marginTop: 2, opacity: 0.9 },
  saveTurns: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: SPACING.sm, textAlign: 'right' },

  // Buttons
  buttons: { gap: SPACING.sm, marginBottom: SPACING.md },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, gap: SPACING.sm, ...SHADOWS.glow,
  },
  btnPrimaryText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.lg, color: COLORS.background, fontWeight: '800', letterSpacing: 0.3 },
  btnPrimaryArrow: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.lg, color: COLORS.background, fontWeight: '800' },
  btnSecondary: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
  },
  btnSecondaryText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, color: COLORS.textSecondary, fontWeight: '600' },

  // Secondary options grid
  secondaryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl,
  },
  secondaryTile: {
    flex: 1, minWidth: '45%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
  },
  secondaryTileDanger: { borderColor: COLORS.danger + '55' },
  secondaryTileText: {
    fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary,
    fontWeight: '600', letterSpacing: 0.3,
  },
  secondaryTileTextDanger: { color: COLORS.danger, opacity: 0.85 },

  footer: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, textAlign: 'center', fontStyle: 'italic' },

  // How to Play modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    borderTopWidth: 1, borderColor: COLORS.border, paddingTop: SPACING.sm,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: SPACING.md,
  },
  modalTitle: {
    fontFamily: FONTS.serif, fontSize: FONT_SIZES.xxl, color: COLORS.textPrimary,
    fontWeight: '700', textAlign: 'center', marginBottom: SPACING.sm,
  },
  modalDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  modalScroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  modalItem: { marginBottom: SPACING.lg },
  modalItemHeading: {
    fontFamily: FONTS.serif, fontSize: FONT_SIZES.lg, color: COLORS.primary,
    fontWeight: '700', marginBottom: SPACING.xs,
  },
  modalItemBody: {
    fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, color: COLORS.textSecondary,
    lineHeight: 22,
  },
  modalFooter: { borderTopWidth: 1, borderColor: COLORS.border, paddingTop: SPACING.md, gap: 4 },
  modalFooterText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, textAlign: 'center' },
  modalClose: {
    margin: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, alignItems: 'center', ...SHADOWS.glow,
  },
  modalCloseText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.md, color: COLORS.background, fontWeight: '800' },

  // Dice skin selector
  skinGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  skinCard: {
    width: 140, borderRadius: RADIUS.lg,
    borderWidth: 2, borderColor: COLORS.border,
    overflow: 'hidden', alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
  },
  skinCardSelected: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  skinCardImage: { width: 140, height: 140 },
  skinCardClassic: {
    width: 140, height: 100, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  skinCardClassicDie: {
    fontSize: 28, color: COLORS.primary, fontFamily: FONTS.serif,
    fontWeight: '700', letterSpacing: 2,
  },
  skinCardLabel: {
    fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary,
    letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700',
    paddingVertical: SPACING.sm,
  },
  skinCardLabelSelected: { color: COLORS.primary },
  skinCardCheck: {
    position: 'absolute', top: 6, right: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.pill,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  skinCardCheckDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.background,
  },
});
