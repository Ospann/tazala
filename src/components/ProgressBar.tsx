import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { createStyles } from '@/theme/ThemeProvider';

interface ProgressBarProps {
  progress: number;
  accessibilityLabel?: string;
  tone?: 'primary' | 'danger';
}

export function ProgressBar({ progress, accessibilityLabel, tone = 'primary' }: ProgressBarProps) {
  const styles = useStyles();
  const clamped = Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 1);
  const width = useSharedValue(clamped);

  useEffect(() => {
    width.set(withTiming(clamped, { duration: 300 }));
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View style={[styles.fill, tone === 'danger' && styles.danger, fillStyle]} />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  track: {
    height: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryBright,
  },
  danger: {
    backgroundColor: theme.colors.coral,
  },
}));
