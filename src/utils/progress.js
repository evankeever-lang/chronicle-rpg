import * as FileSystem from 'expo-file-system/legacy';

const SAVES_DIR = FileSystem.documentDirectory + 'saves/';
const PROGRESS_PATH = SAVES_DIR + 'progress.json';

const DEFAULTS = {
  tutorialCompleted: false,
};

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(SAVES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SAVES_DIR, { intermediates: true });
  }
}

export async function loadProgress() {
  try {
    const info = await FileSystem.getInfoAsync(PROGRESS_PATH);
    if (!info.exists) return { ...DEFAULTS };
    const json = await FileSystem.readAsStringAsync(PROGRESS_PATH);
    return { ...DEFAULTS, ...JSON.parse(json) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveProgress(updates) {
  try {
    await ensureDir();
    const current = await loadProgress();
    const merged = { ...current, ...updates };
    await FileSystem.writeAsStringAsync(PROGRESS_PATH, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('[Chronicle] Progress save failed:', e);
  }
}

export async function markTutorialCompleted() {
  return saveProgress({ tutorialCompleted: true });
}

export async function resetProgress() {
  try {
    await FileSystem.deleteAsync(PROGRESS_PATH, { idempotent: true });
  } catch (e) {
    console.warn('[Chronicle] Progress reset failed:', e);
  }
}
