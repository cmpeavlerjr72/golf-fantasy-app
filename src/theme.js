// Shared design system — Sleeper/ESPN-inspired dark theme with golf accents
export const colors = {
  // Base backgrounds (dark charcoal/navy)
  bg: '#0d1117',
  bgCard: '#161b22',
  bgCardAlt: '#1c2333',
  bgElevated: '#21262d',
  bgHighlight: '#1a2a1e',

  // Borders
  border: '#30363d',
  borderLight: '#21262d',

  // Text
  textPrimary: '#f0f6fc',
  textSecondary: '#8b949e',
  textMuted: '#484f58',

  // Accent — golf green
  accent: '#3fb950',
  accentDark: '#238636',
  accentDim: '#1a3a2a',

  // Scoring colors
  positive: '#3fb950',
  negative: '#f85149',
  neutral: '#8b949e',
  gold: '#d29922',
  goldDim: '#2a2000',

  // Status
  live: '#f85149',
  upcoming: '#d29922',
  active: '#3fb950',

  // Misc
  white: '#ffffff',
  overlay: 'rgba(0,0,0,0.5)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// Common style fragments
export const cardStyle = {
  backgroundColor: colors.bgCard,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.border,
};

export const inputStyle = {
  backgroundColor: colors.bgElevated,
  borderRadius: 10,
  padding: 14,
  fontSize: 16,
  color: colors.textPrimary,
  borderWidth: 1,
  borderColor: colors.border,
};

export const buttonStyle = {
  borderRadius: 10,
  padding: 14,
  alignItems: 'center',
};
