import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { createStyles, useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'regular' | 'large';
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const variantColors: Record<
  Variant,
  { background: keyof ThemeColors | null; foreground: keyof ThemeColors }
> = {
  primary: { background: 'primary', foreground: 'onPrimary' },
  secondary: { background: 'surfaceMuted', foreground: 'text' },
  danger: { background: 'danger', foreground: 'onDanger' },
  ghost: { background: null, foreground: 'primary' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  size = 'regular',
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = variantColors[variant];
  const inactive = disabled || loading;
  const textTone =
    colors.foreground === 'onPrimary'
      ? 'onPrimary'
      : colors.foreground === 'onDanger'
        ? 'onDanger'
        : colors.foreground === 'primary'
          ? 'accent'
          : 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'large' && styles.large,
        { backgroundColor: colors.background ? theme.colors[colors.background] : 'transparent' },
        (pressed || inactive) && { opacity: inactive ? 0.5 : 0.85 },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={theme.colors[colors.foreground]} />
        ) : (
          icon && <Icon name={icon} size={size === 'large' ? 22 : 18} color={colors.foreground} />
        )}
        <AppText
          variant={size === 'large' ? 'bodyStrong' : 'label'}
          tone={textTone}
          numberOfLines={2}
          align="center"
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  base: {
    minHeight: 48,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    justifyContent: 'center',
  },
  large: {
    minHeight: 60,
    paddingVertical: theme.spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
}));
