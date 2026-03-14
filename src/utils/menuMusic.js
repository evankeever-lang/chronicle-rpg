// src/utils/menuMusic.js
// Menu music singleton — plays ambient tracks on the main menu / campaign select /
// character creation screens, then fades out when the game session begins.
//
// ─── HOW TO ADD TRACKS ────────────────────────────────────────────────────────
// 1. Drop MP3 files into src/assets/music/ using the naming convention:
//      MENU_01.mp3, MENU_02.mp3, MENU_03.mp3 …
// 2. Uncomment the matching require() line in MENU_TRACK_SOURCES below.
// 3. On each app launch a random track is picked and looped for the session.
//
// ─── SAFE WHEN EMPTY ──────────────────────────────────────────────────────────
// If MENU_TRACK_SOURCES is empty the system no-ops silently.

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const MENU_TRACK_SOURCES = [
  require('../assets/music/MENU_01.mp3'),
  // require('../assets/music/MENU_02.mp3'),
  // require('../assets/music/MENU_03.mp3'),
];

const VOLUME = 0.55;
const FADE_STEPS = 20;
const FADE_INTERVAL_MS = 80; // total ~1.6 s

let _player = null;
let _isPlaying = false;

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Start menu music. Safe to call multiple times — no-ops if already playing.
 */
export async function startMenuMusic() {
  if (MENU_TRACK_SOURCES.length === 0) return;
  if (_isPlaying) return;

  try {
    console.log('[MenuMusic] step 1: setAudioModeAsync');
    await setAudioModeAsync({ playsInSilentModeIOS: true });
    console.log('[MenuMusic] step 2: createAudioPlayer');
    const index = Math.floor(Math.random() * MENU_TRACK_SOURCES.length);
    _player = createAudioPlayer(MENU_TRACK_SOURCES[index]);
    console.log('[MenuMusic] step 3: set volume+loop');
    _player.volume = VOLUME;
    _player.loop = true;
    console.log('[MenuMusic] step 4: play');
    _player.play();
    _isPlaying = true;
    console.log('[MenuMusic] started ok');
  } catch (e) {
    _isPlaying = false;
    console.warn('[MenuMusic] failed at step above ^', String(e), e);
  }
}

/**
 * Stop menu music.
 * @param {Object} options
 * @param {boolean} options.fade — fades out over ~1.6 s before stopping
 */
export async function stopMenuMusic({ fade = false } = {}) {
  if (!_player || !_isPlaying) return;
  _isPlaying = false;

  try {
    if (fade) {
      const step = VOLUME / FADE_STEPS;
      for (let v = VOLUME; v > 0; v -= step) {
        if (!_player) break;
        _player.volume = Math.max(0, parseFloat(v.toFixed(4)));
        await new Promise(r => setTimeout(r, FADE_INTERVAL_MS));
      }
    }
    if (_player) {
      _player.remove();
      _player = null;
    }
  } catch (_) {
    _player = null;
  }
}

/**
 * Returns true if menu music is currently active.
 */
export function isMenuMusicPlaying() {
  return _isPlaying;
}
