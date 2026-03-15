// src/utils/sfx.js
// Sound-effects singleton — delegates to SfxManager (mounted in DMConversationScreen).
//
// ─── HOW TO ADD SFX ───────────────────────────────────────────────────────────
// 1. Drop MP3 files into src/assets/sfx/ using the naming convention:
//      SFX_DICE_ROLL.mp3          — plays on dice animation start
//      SFX_DICE_LAND_SUCCESS.mp3  — plays on successful skill check or attack hit
//      SFX_DICE_LAND_FAIL.mp3     — plays on failed skill check, miss, or fumble
//      SFX_COMBAT_START.mp3       — one-shot sting when combat begins
// 2. Uncomment the matching require() line in SFX_SOURCES below.
//
// ─── HOW TO ADD NEW SFX KEYS ──────────────────────────────────────────────────
// Add a key here, add a useAudioPlayer() in SfxManager.js, include it in the
// player map there.
//
// ─── SAFE WHEN NULL ───────────────────────────────────────────────────────────
// Sources set to null are ignored — playSfx() no-ops silently.

export const SFX_SOURCES = {
  dice_roll:          require('../assets/sfx/SFX_DICE_ROLL.mp3'),
  dice_land_success:  require('../assets/sfx/SFX_DICE_LAND_SUCCESS.mp3'),
  dice_land_fail:     require('../assets/sfx/SFX_DICE_LAND_FAIL.mp3'),
  combat_start:       require('../assets/sfx/SFX_COMBAT_START.mp3'),
};

// Controls are registered by SfxManager on mount.
let _controls = null;

export function _registerSfxControls(controls) {
  _controls = controls;
}

export function playSfx(key) {
  _controls?.play(key);
}
