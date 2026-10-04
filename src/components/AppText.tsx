import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors, typography } from '@/theme/tokens';

type Variant = keyof typeof typography;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'onPrimary' | 'onDanger';

const toneColor: Record<Tone, keyof ThemeColors> = {
  primary: 'text',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  accent: 'primary',
  danger: 'danger',
  onPrimary: 'onPrimary',
  onDanger: 'onDanger',
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
}

export function AppText({
  variant = 'body',
  tone = 'primary',
  align,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={variant === 'hero' ? 1.3 : 2}
      style={[
        theme.typography[variant],
        { color: theme.colors[toneColor[tone]], textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}
