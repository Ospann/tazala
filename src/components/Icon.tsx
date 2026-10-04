import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: keyof ThemeColors;
}

export function Icon({ name, size = 22, color = 'text' }: IconProps) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={theme.colors[color]} accessible={false} />;
}
