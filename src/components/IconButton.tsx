import { Pressable } from 'react-native';

import { createStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: keyof ThemeColors;
  disabled?: boolean;
  filled?: boolean;
}

export function IconButton({
  icon,
  label,
  onPress,
  color = 'text',
  disabled,
  filled,
}: IconButtonProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        filled && styles.filled,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Icon name={icon} color={color} />
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  button: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  dimmed: {
    opacity: 0.5,
  },
}));
