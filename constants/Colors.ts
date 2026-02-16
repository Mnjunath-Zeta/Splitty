// Base palettes define structural colors (background, surface, text)
export const BasePalettes = {
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    inputBackground: '#F1F5F9',
    success: '#10B981',
    error: '#EF4444',
  },
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    inputBackground: '#334155',
    success: '#34D399',
    error: '#F87171',
  },
};

// Accent palettes define brand/theme colors (primary, secondary, accent)
export const AccentPalettes = {
  classic: {
    primary: '#6366F1',
    secondary: '#0891B2',
    accent: '#E11D48',
  },
  midnight: {
    primary: '#818CF8',
    secondary: '#C084FC',
    accent: '#F472B6',
  },
  sunset: {
    primary: '#F093FB',
    secondary: '#F5576C',
    accent: '#F97316',
  },
  forest: {
    primary: '#4ADE80',
    secondary: '#2DD4BF',
    accent: '#FACC15',
  },
};

export type AppearanceMode = 'light' | 'dark';
export type AccentName = keyof typeof AccentPalettes;

// Combined Theme type
export type ThemeColors = typeof BasePalettes.light & typeof AccentPalettes.classic;

/**
 * Gets the combined color palette for a given appearance and accent theme.
 */
export const getThemeColors = (appearance: AppearanceMode, accent: AccentName): ThemeColors => {
  const base = BasePalettes[appearance] || BasePalettes.light;
  const colors = AccentPalettes[accent] || AccentPalettes.classic;

  return {
    ...base,
    ...colors,
  };
};

// For backward compatibility during migration
export type ThemeName = 'light' | 'dark' | 'midnight' | 'sunset' | 'forest';
export const Themes: Record<ThemeName, ThemeColors> = {
  light: getThemeColors('light', 'classic'),
  dark: getThemeColors('dark', 'classic'),
  midnight: getThemeColors('dark', 'midnight'),
  sunset: getThemeColors('dark', 'sunset'),
  forest: getThemeColors('dark', 'forest'),
};

export const Colors = BasePalettes.light; // Base fallback
export const GlassTheme = {
  background: 'rgba(255, 255, 255, 0.8)',
  border: 'rgba(255, 255, 255, 0.1)',
};

