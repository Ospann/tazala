import createIconSet from '@expo/vector-icons/createIconSet';
import type Ionicons from '@expo/vector-icons/Ionicons';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

const font =
  require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') as number;

const EmbeddedIonicons = createIconSet(glyphMap, 'Ionicons', font);

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: keyof ThemeColors;
}

export function Icon({ name, size = 22, color = 'text' }: IconProps) {
  const theme = useTheme();
  return (
    <EmbeddedIonicons name={name} size={size} color={theme.colors[color]} accessible={false} />
  );
}
