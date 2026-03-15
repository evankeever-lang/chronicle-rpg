// src/components/SfxManager.js
// Mounted inside DMConversationScreen. Preloads SFX via expo-audio hooks and
// registers a playSfx(key) dispatcher with the sfx singleton.
//
// Add new SFX: add a source to SFX_SOURCES in sfx.js, add a useAudioPlayer()
// call here, and include the player in the playerMap below.

import { useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { useGame } from '../context/GameContext';
import { SFX_SOURCES, _registerSfxControls } from '../utils/sfx';

export default function SfxManager() {
  const { preferences } = useGame();
  const { masterVolume = 100, sfxVolume = 80 } = preferences || {};

  // Keep volume in a ref so play() always uses the latest preference
  const effectiveVolume = (masterVolume / 100) * (sfxVolume / 100);
  const volumeRef = useRef(effectiveVolume);
  volumeRef.current = effectiveVolume;

  // One player per SFX key — hooks must always be called unconditionally
  const diceRollPlayer         = useAudioPlayer(SFX_SOURCES.dice_roll);
  const diceLandSuccessPlayer  = useAudioPlayer(SFX_SOURCES.dice_land_success);
  const diceLandFailPlayer     = useAudioPlayer(SFX_SOURCES.dice_land_fail);
  const combatStartPlayer      = useAudioPlayer(SFX_SOURCES.combat_start);

  useEffect(() => {
    const playerMap = {
      dice_roll:         SFX_SOURCES.dice_roll         ? diceRollPlayer         : null,
      dice_land_success: SFX_SOURCES.dice_land_success ? diceLandSuccessPlayer  : null,
      dice_land_fail:    SFX_SOURCES.dice_land_fail    ? diceLandFailPlayer     : null,
      combat_start:      SFX_SOURCES.combat_start      ? combatStartPlayer      : null,
    };

    _registerSfxControls({
      play(key) {
        const player = playerMap[key];
        if (!player) return;
        try {
          player.volume = Math.min(1, Math.max(0, volumeRef.current));
          player.seekTo(0);
          player.play();
        } catch (_) {}
      },
    });

    return () => _registerSfxControls(null);
  }, [diceRollPlayer, diceLandSuccessPlayer, diceLandFailPlayer, combatStartPlayer]); // stable refs — runs once

  return null;
}
