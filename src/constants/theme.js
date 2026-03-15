export const COLORS = {
  background: '#0D0B07',
  surface: '#1A1612',
  surfaceElevated: '#241E17',
  surfaceHighlight: '#2E2720',
  overlay: 'rgba(0,0,0,0.72)',
  border: '#3D3326',
  borderLight: '#5C4F3A',
  primary: '#C9A84C',
  primaryDark: '#8B6914',
  primaryLight: '#E8C97A',
  primaryFaint: 'rgba(201,168,76,0.12)',
  accentNarration: '#C9A84C',
  accentNPC: '#6EAF88',
  accentSystem: '#5B8AB5',
  accentDanger: '#C85C4B',
  textPrimary: '#F0E6CC',
  textSecondary: '#9E8E6E',
  textMuted: '#5C5040',
  textNarration: '#E8DCC8',
  textNPC: '#A8D4B0',
  textSystem: '#8BA8C8',
  hp: '#C84B4B',
  hpLow: '#FF6B4A',
  mp: '#4B7EC8',
  success: '#4BAF6E',
  danger: '#C84B4B',
  warning: '#C9A84C',
  diceFace: '#1A1612',
  diceBorder: '#C9A84C',
  diceCrit: '#FFD700',
  diceFumble: '#C84B4B',
  white: '#FFFFFF',
  black: '#000000',
};

export const FONTS = {
  display: 'Cinzel_700Bold',          // titles, button labels, screen headers
  displayLight: 'Cinzel_400Regular',  // subheadings, section labels
  serif: 'EBGaramond_400Regular',     // DM narration, flavour text, lore
  serifMedium: 'EBGaramond_500Medium',// NPC speech, important prose
  ui: 'CrimsonPro_400Regular',        // stat labels, menu items, small text
  uiBold: 'CrimsonPro_600SemiBold',   // HP numbers, gold amounts, key values
};

export const FONT_SIZES = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, display: 32,
};

export const SPACING = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const RADIUS = {
  sm: 4, md: 8, lg: 12, xl: 16, xxl: 24, pill: 100,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4, shadowRadius: 2, elevation: 2,
  },
  md: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 5,
  },
  glow: {
    shadowColor: '#C9A84C', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
};
