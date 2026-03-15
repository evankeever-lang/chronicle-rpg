// src/utils/menuMusic.js
// Menu music singleton — delegates to MenuMusicManager (mounted in App.js).
//
// ─── HOW TO ADD TRACKS ────────────────────────────────────────────────────────
// 1. Drop MP3 files into src/assets/music/ using the naming convention:
//      MENU_01.mp3, MENU_02.mp3, MENU_03.mp3 …
// 2. Uncomment the matching require() line in MENU_TRACKS below.
// 3. On each app launch a random track is picked and looped.
//
// ─── SAFE WHEN EMPTY ──────────────────────────────────────────────────────────
// If MENU_TRACKS is empty the system no-ops silently.

export const MENU_TRACKS = [
  require('../assets/music/MENU_01.mp3'),
  // require('../assets/music/MENU_02.mp3'),
  // require('../assets/music/MENU_03.mp3'),
];

// Controls are registered by MenuMusicManager on mount.
let _controls = null;

export function _registerMusicControls(controls) {
  _controls = controls;
}

export function startMenuMusic() {
  _controls?.start();
}

export async function stopMenuMusic({ fade = false } = {}) {
  await _controls?.stop({ fade });
}

export function isMenuMusicPlaying() {
  return _controls?.isPlaying() ?? false;
}
