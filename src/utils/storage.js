import * as FileSystem from 'expo-file-system/legacy';

const SAVES_DIR = FileSystem.documentDirectory + 'saves/';
const AUTO_SAVE_PATH = SAVES_DIR + 'autosave.json';
const PREFS_PATH    = SAVES_DIR + 'preferences.json';
const SAVE_VERSION = 2;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(SAVES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SAVES_DIR, { intermediates: true });
  }
}

/**
 * Persist the current game state to disk.
 * Call this after any meaningful state change (DM response, character update, etc.)
 */
export async function saveGame(state) {
  try {
    await ensureDir();
    const saveData = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      campaign: state.campaign,
      dmPersona: state.dmPersona,
      character: state.character,
      uiMessages: state.uiMessages,
      conversationHistory: state.conversationHistory,
      sessionFlags: state.sessionFlags,
      npcMemory: state.npcMemory,
      sessionMessageCount: state.sessionMessageCount,
      sessionStartedAt: state.sessionStartedAt,
      isSessionActive: state.isSessionActive,
      // Context window management (were missing — cross-session continuity)
      worldRegistry: state.worldRegistry,
      entityRegistry: state.entityRegistry,
      rollingSummary: state.rollingSummary || null,
      campaignMemory: state.campaignMemory || null,
      // Aranthos world tracking
      worldReputations: state.worldReputations,
      visitedLocations: state.visitedLocations || [],
      npcDispositions: state.npcDispositions || {},
      mainPlotStage: state.mainPlotStage || 'hidden',
    };
    await FileSystem.writeAsStringAsync(AUTO_SAVE_PATH, JSON.stringify(saveData));
    return saveData;
  } catch (e) {
    console.warn('[Chronicle] Auto-save failed:', e);
    return null;
  }
}

/**
 * Load the most recent auto-save. Returns null if no save exists.
 */
export async function loadGame() {
  try {
    const info = await FileSystem.getInfoAsync(AUTO_SAVE_PATH);
    if (!info.exists) return null;
    const json = await FileSystem.readAsStringAsync(AUTO_SAVE_PATH);
    const data = JSON.parse(json);
    // Accept v1 saves (missing new fields) — GameContext.LOAD_GAME spreads over
    // initialState so missing fields get their defaults automatically.
    // Only discard saves from truly incompatible future versions.
    if (data.version !== SAVE_VERSION && data.version !== 1) return null;
    return data;
  } catch (e) {
    console.warn('[Chronicle] Load failed:', e);
    return null;
  }
}

/**
 * Persist user preferences (dice skin, volume, etc.) independently of the game save.
 * Survives session resets and game save/load.
 */
export async function savePreferences(preferences) {
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(PREFS_PATH, JSON.stringify(preferences));
  } catch (e) {
    console.warn('[Chronicle] Preferences save failed:', e);
  }
}

/**
 * Load persisted user preferences. Returns null if none saved yet.
 */
export async function loadPreferences() {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_PATH);
    if (!info.exists) return null;
    return JSON.parse(await FileSystem.readAsStringAsync(PREFS_PATH));
  } catch (e) {
    return null;
  }
}

/**
 * Delete the auto-save (e.g. "Erase Save" or after starting a truly new game).
 */
export async function deleteSave() {
  try {
    await FileSystem.deleteAsync(AUTO_SAVE_PATH, { idempotent: true });
  } catch (e) {
    console.warn('[Chronicle] Delete save failed:', e);
  }
}

/**
 * Returns true if an auto-save file exists on disk.
 */
export async function hasSave() {
  try {
    const info = await FileSystem.getInfoAsync(AUTO_SAVE_PATH);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Human-readable time since a saved ISO date string.
 * e.g. "3h ago", "2d ago", "Just now"
 */
export function timeSince(isoDate) {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}
