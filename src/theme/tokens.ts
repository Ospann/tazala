export const palettes = {
  light: {
    background: '#F5FAF9',
    surface: '#FFFFFF',
    surfaceMuted: '#EAF4F2',
    border: '#D7E6E2',
    text: '#0E1F1C',
    textSecondary: '#4D625D',
    textTertiary: '#6F837E',
    primary: '#0B7D70',
    primaryBright: '#2CC7B2',
    primarySoft: '#D3F1EC',
    onPrimary: '#FFFFFF',
    danger: '#C8463C',
    dangerSoft: '#FDE3DF',
    onDanger: '#FFFFFF',
    coral: '#FF8A7A',
    overlay: 'rgba(8, 20, 18, 0.55)',
    shadow: '#0B2622',
  },
  dark: {
    background: '#0A1614',
    surface: '#11211E',
    surfaceMuted: '#182D29',
    border: '#24403A',
    text: '#EAF5F2',
    textSecondary: '#A6BDB7',
    textTertiary: '#839A94',
    primary: '#3DD5C0',
    primaryBright: '#3DD5C0',
    primarySoft: '#153D37',
    onPrimary: '#04201C',
    danger: '#FF8B7E',
    dangerSoft: '#3B1F1B',
    onDanger: '#2B0905',
    coral: '#FF8B7E',
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  hero: { fontSize: 52, lineHeight: 58, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type ColorScheme = keyof typeof palettes;
export type ThemeColors = { [K in keyof (typeof palettes)['light']]: string };

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: palettes[scheme], spacing, radii, typography };
}
