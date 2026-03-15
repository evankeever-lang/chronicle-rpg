// src/components/MenuMusicManager.js
// Mounted once in App.js (never unmounts). Manages menu music via expo-audio
// hooks and registers start/stop controls for screen components to call.

import { useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { useGame } from '../context/GameContext';
import { MENU_TRACKS, _registerMusicControls } from '../utils/menuMusic';

const FADE_STEPS = 20;
const FADE_INTERVAL_MS = 80; // ~1.6 s total

// Pick a random track once per session (stable across re-renders)
const INITIAL_INDEX = MENU_TRACKS.length > 0
  ? Math.floor(Math.random() * MENU_TRACKS.length)
  : -1;

const hasTrack = INITIAL_INDEX >= 0;

export default function MenuMusicManager() {
  const { preferences } = useGame();
  const { masterVolume = 100, musicVolume = 90 } = preferences || {};

  // Multiply master × music, both 0–100, to get a 0–1 float
  const effectiveVolume = (masterVolume / 100) * (musicVolume / 100);
  const volumeRef = useRef(effectiveVolume);
  volumeRef.current = effectiveVolume;

  const player = useAudioPlayer(hasTrack ? MENU_TRACKS[INITIAL_INDEX] : null);
  const isPlayingRef = useRef(false);

  // React to preference changes while music is playing
  useEffect(() => {
    if (isPlayingRef.current) {
      player.volume = effectiveVolume;
    }
  }, [effectiveVolume, player]);

  // Register controls with the singleton
  useEffect(() => {
    if (!hasTrack) {
      _registerMusicControls(null);
      return;
    }

    const controls = {
      start() {
        if (isPlayingRef.current) return;
        try {
          player.volume = volumeRef.current;
          player.loop = true;
          player.play();
          isPlayingRef.current = true;
        } catch (e) {
          console.warn('[MenuMusic] start failed:', e.message);
        }
      },

      async stop({ fade = false } = {}) {
        if (!isPlayingRef.current) return;
        isPlayingRef.current = false;
        try {
          if (fade) {
            const startVol = player.volume;
            const step = startVol / FADE_STEPS;
            for (let v = startVol; v > 0; v -= step) {
              player.volume = Math.max(0, parseFloat(v.toFixed(4)));
              await new Promise(r => setTimeout(r, FADE_INTERVAL_MS));
            }
          }
          player.pause();
          player.seekTo(0);
        } catch (_) {}
      },

      isPlaying() {
        return isPlayingRef.current;
      },
    };

    _registerMusicControls(controls);
    return () => _registerMusicControls(null);
  }, [player]);

  return null;
}
