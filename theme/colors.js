export const COLORS = {
  // Light theme
  light: {
    bg: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#3C3C43',
    accent: '#007AFF',
    green: '#34C759',
    red: '#FF3B30',
    orange: '#FF9500',
    yellow: '#FFCC00',
    teal: '#5AC8FA',
    purple: '#AF52DE',
    pink: '#FF2D55',
    gray1: '#8E8E93',
    gray2: '#AEAEB2',
    gray3: '#C7C7CC',
    gray4: '#D1D1D6',
    gray5: '#E5E5EA',
    gray6: '#F2F2F7',
  },
  // Dark theme
  dark: {
    bg: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    accent: '#0A84FF',
    green: '#30D158',
    red: '#FF453A',
    orange: '#FF9F0A',
    yellow: '#FFD60A',
    teal: '#64D2FF',
    purple: '#BF5AF2',
    pink: '#FF375F',
    gray1: '#8E8E93',
    gray2: '#636366',
    gray3: '#48484A',
    gray4: '#3A3A3C',
    gray5: '#2C2C2E',
    gray6: '#1C1C1E',
  },
};

// Текущая тема: system | light | dark
export function getThemeColors(preference = 'system') {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? COLORS.dark : COLORS.light;
  }
  return COLORS[preference] || COLORS.light;
}
