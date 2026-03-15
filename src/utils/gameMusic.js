// src/utils/gameMusic.js
// Gameplay music singleton — delegates to GameplayMusicManager (mounted in DMConversationScreen).
//
// ─── HOW TO ADD TRACKS ────────────────────────────────────────────────────────
// 1. Drop MP3 files into src/assets/music/ using the naming convention:
//      EXPLORATION_01.mp3, EXPLORATION_02.mp3 …  (looping ambient/adventure)
//      COMBAT_01.mp3, COMBAT_02.mp3 …            (looping combat)
// 2. Uncomment the matching require() line in SITUATION_TRACKS below.
// 3. A random track per situation is picked at app launch and looped.
//
// ─── ADDING MORE SITUATIONS ───────────────────────────────────────────────────
// Add a key to SITUATION_TRACKS (e.g. 'tavern', 'boss'), update TONE_TO_SITUATION
// and combatStateToSituation() as needed.
//
// ─── SAFE WHEN EMPTY ──────────────────────────────────────────────────────────
// Empty arrays are handled gracefully — the system no-ops silently.

export const SITUATION_TRACKS = {
  exploration: [
    require('../assets/music/EXPLORATION_01.mp3'),
    require('../assets/music/EXPLORATION_02.mp3'),
  ],
  combat: [
    require('../assets/music/COMBAT_01.mp3'),
    // require('../assets/music/COMBAT_02.mp3'),
  ],
};

// Random track selected once per session per situation (stable across re-renders).
export const SELECTED_TRACKS = Object.fromEntries(
  Object.entries(SITUATION_TRACKS).map(([situation, tracks]) => [
    situation,
    tracks.length > 0 ? tracks[Math.floor(Math.random() * tracks.length)] : null,
  ])
);

// Map combatState → situation
export function combatStateToSituation(combatState) {
  if (combatState === 'EXPLORATION') return 'exploration';
  return 'combat'; // COMBAT_INIT, COMBAT_STATE, COMBAT_RESOLUTION, DOWNED
}

// Tone → situation (upgrade path: expand this map as more tracks arrive)
export const TONE_TO_SITUATION = {
  exploration:  'exploration',
  tension:      'exploration',
  travel:       'exploration',
  discovery:    'exploration',
  somber:       'exploration',
  victory:      'exploration',
  tavern:       'exploration',
  combat_light: 'combat',
  combat_heavy: 'combat',
  boss:         'combat',
};

// Controls are registered by GameplayMusicManager on mount.
let _controls = null;

export function _registerGameMusicControls(controls) {
  _controls = controls;
}

export function startGameplayMusic() {
  _controls?.start();
}

export async function stopGameplayMusic({ fade = false } = {}) {
  await _controls?.stop({ fade });
}

export function setGameplaySituation(situation) {
  _controls?.setSituation(situation);
}

export function isGameplayMusicPlaying() {
  return _controls?.isPlaying() ?? false;
}
