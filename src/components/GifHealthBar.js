// src/components/GifHealthBar.js
// Displays the correct frame of health_bar.gif based on HP percentage.
//
// Setup (one-time):
//   npm install --save-dev gifuct-js jimp
//   node scripts/extract-health-bar-frames.js
//
// Props:
//   hp      — current HP
//   maxHp   — maximum HP
//   width   — display width  (default 80)
//   height  — display height (default 14)
//   style   — extra style overrides

import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

// Populated by scripts/extract-health-bar-frames.js
// Falls back gracefully to a plain bar if frames haven't been extracted yet.
let FRAMES = [];
try {
  FRAMES = require('../assets/ui/health_bar_frames/frames').default;
} catch (_) {
  // frames not yet extracted — fallback bar renders instead
}

export default function GifHealthBar({ hp, maxHp, width = 80, height = 14, style }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

  if (FRAMES.length === 0) {
    // Fallback: plain coloured bar until frames are extracted
    const barColor = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FF9800' : '#F44336';
    return (
      <View style={[fallback.bg, { width, height }, style]}>
        <View style={[fallback.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
    );
  }

  // Frame 0 = full health, last frame = near/at death
  // If your GIF runs the other direction, change to:
  //   const frameIndex = Math.round(pct * (FRAMES.length - 1));
  const frameIndex = Math.round((1 - pct) * (FRAMES.length - 1));

  return (
    <Image
      source={FRAMES[frameIndex]}
      style={[{ width, height }, style]}
      resizeMode="stretch"
      fadeDuration={0}
    />
  );
}

const fallback = StyleSheet.create({
  bg: {
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
