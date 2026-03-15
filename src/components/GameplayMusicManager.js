// src/components/GameplayMusicManager.js
// Mounted inside DMConversationScreen. Manages gameplay music via expo-audio hooks
// and registers start/stop/setSituation controls with the gameMusic singleton.
//
// Two players (exploration, combat) are created at mount. combatState changes
// drive crossfades between them. Mirrors the MenuMusicManager pattern.

import { useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { useGame } from '../context/GameContext';
import {
  SELECTED_TRACKS,
  combatStateToSituation,
  _registerGameMusicControls,
} from '../utils/gameMusic';

const FADE_OUT_STEPS    = 20;
const FADE_OUT_INTERVAL = 75;  // ms — ~1.5 s total
const FADE_IN_STEPS     = 10;
const FADE_IN_INTERVAL  = 60;  // ms — ~0.6 s total

export default function GameplayMusicManager() {
  const { combatState, preferences } = useGame();
  const { masterVolume = 100, musicVolume = 90 } = preferences || {};

  const effectiveVolume = (masterVolume / 100) * (musicVolume / 100);
  const volumeRef       = useRef(effectiveVolume);
  volumeRef.current     = effectiveVolume;

  // Keep combatState in a ref so the controls closure can read it without staleness
  const combatStateRef = useRef(combatState);
  useEffect(() => { combatStateRef.current = combatState; }, [combatState]);

  // One player per situation — null source is handled gracefully by expo-audio
  const explorationPlayer = useAudioPlayer(SELECTED_TRACKS.exploration);
  const combatPlayer      = useAudioPlayer(SELECTED_TRACKS.combat);

  const isPlayingRef        = useRef(false);
  const currentSitRef       = useRef('exploration');
  const transitionLockRef   = useRef(false);
  const controlsRef         = useRef(null);

  function getPlayer(situation) {
    return situation === 'exploration' ? explorationPlayer : combatPlayer;
  }

  async function fadeOut(player) {
    try {
      const startVol = player.volume;
      if (startVol <= 0) return;
      const step = startVol / FADE_OUT_STEPS;
      for (let v = startVol; v > 0; v -= step) {
        player.volume = Math.max(0, parseFloat(v.toFixed(4)));
        await new Promise(r => setTimeout(r, FADE_OUT_INTERVAL));
      }
      player.pause();
      player.seekTo(0);
    } catch (_) {}
  }

  async function fadeIn(player, targetVolume) {
    try {
      player.volume = 0;
      player.loop   = true;
      player.play();
      const step = targetVolume / FADE_IN_STEPS;
      for (let v = 0; v <= targetVolume; v += step) {
        player.volume = Math.min(targetVolume, parseFloat(v.toFixed(4)));
        await new Promise(r => setTimeout(r, FADE_IN_INTERVAL));
      }
      player.volume = targetVolume;
    } catch (_) {}
  }

  // Build and register controls on mount; clean up on unmount
  useEffect(() => {
    const controls = {
      start() {
        if (isPlayingRef.current) return;
        isPlayingRef.current = true;
        const situation = combatStateToSituation(combatStateRef.current);
        currentSitRef.current = situation;
        if (!SELECTED_TRACKS[situation]) return;
        try {
          const player = getPlayer(situation);
          player.volume = volumeRef.current;
          player.loop   = true;
          player.play();
        } catch (e) {
          console.warn('[GameMusic] start failed:', e.message);
        }
      },

      async stop({ fade = false } = {}) {
        if (!isPlayingRef.current) return;
        isPlayingRef.current = false;
        const player = getPlayer(currentSitRef.current);
        try {
          if (fade) {
            await fadeOut(player);
          } else {
            player.pause();
            player.seekTo(0);
          }
        } catch (_) {}
      },

      async setSituation(situation) {
        if (situation === currentSitRef.current) return;
        if (transitionLockRef.current) return; // already mid-crossfade — ignore
        if (!isPlayingRef.current) { currentSitRef.current = situation; return; }

        transitionLockRef.current = true;
        const prev = currentSitRef.current;
        currentSitRef.current = situation;

        await fadeOut(getPlayer(prev));

        if (SELECTED_TRACKS[situation] && isPlayingRef.current) {
          await fadeIn(getPlayer(situation), volumeRef.current);
        }

        transitionLockRef.current = false;
      },

      isPlaying() { return isPlayingRef.current; },
    };

    controlsRef.current = controls;
    _registerGameMusicControls(controls);
    controls.start();

    return () => {
      isPlayingRef.current = false;
      try { explorationPlayer.pause(); explorationPlayer.seekTo(0); } catch (_) {}
      try { combatPlayer.pause(); combatPlayer.seekTo(0); } catch (_) {}
      controlsRef.current = null;
      _registerGameMusicControls(null);
    };
  }, [explorationPlayer, combatPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Crossfade when combatState changes
  useEffect(() => {
    controlsRef.current?.setSituation(combatStateToSituation(combatState));
  }, [combatState]);

  // Update volume on preference change
  useEffect(() => {
    if (!isPlayingRef.current) return;
    try { getPlayer(currentSitRef.current).volume = effectiveVolume; } catch (_) {}
  }, [effectiveVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
