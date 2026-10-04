import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AccessibilityInfo, Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { createStyles, useTheme } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

interface CelebrationProps {
  freedBytes: number;
  deletedCount: number;
  showIosHint: boolean;
  onClose: () => void;
}

const PARTICLES = 14;

function Particle({ index, color }: { index: number; color: string }) {
  const styles = useStyles();
  const progress = useSharedValue(0);
  const angle = (index / PARTICLES) * Math.PI * 2;
  const distance = 110 + (index % 3) * 30;

  useEffect(() => {
    progress.set(
      withDelay(index * 15, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })),
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [
      { translateX: Math.cos(angle) * distance * progress.get() },
      { translateY: Math.sin(angle) * distance * progress.get() },
      { scale: 1 - progress.get() * 0.5 },
    ],
  }));

  return <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />;
}

export function Celebration({ freedBytes, deletedCount, showIosHint, onClose }: CelebrationProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation();
  const format = useFormat();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const freed = format.bytesParts(freedBytes);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AccessibilityInfo.announceForAccessibility(
      t('trash.freedA11y', { size: format.bytes(freedBytes), count: deletedCount }),
    );
    opacity.set(withTiming(1, { duration: 200 }));
    scale.set(withSpring(1, { damping: 12, stiffness: 140 }));
  }, [deletedCount, format, freedBytes, opacity, scale, t]);

  const valueStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));
  const colors = [theme.colors.primaryBright, theme.colors.coral, theme.colors.primary];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay} accessibilityViewIsModal>
        <View style={styles.sheet}>
          <View style={styles.burst}>
            {Array.from({ length: PARTICLES }, (_, index) => (
              <Particle
                key={index}
                index={index}
                color={colors[index % colors.length] ?? theme.colors.primary}
              />
            ))}
            <Animated.View style={[styles.value, valueStyle]}>
              <AppText variant="hero" tone="accent">
                {freed.value}
              </AppText>
              <AppText variant="title" tone="accent">
                {freed.unit}
              </AppText>
            </Animated.View>
          </View>
          <AppText variant="heading" align="center">
            {t('trash.freedTitle')}
          </AppText>
          <AppText tone="secondary" align="center">
            {t('trash.freedBody', { count: deletedCount })}
          </AppText>
          {showIosHint ? (
            <View style={styles.hint}>
              <AppText variant="caption" tone="secondary">
                {t('trash.iosRecentlyDeleted')}
              </AppText>
            </View>
          ) : null}
          <Button label={t('common.great')} onPress={onClose} />
        </View>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
        />
      </View>
    </Modal>
  );
}

const useStyles = createStyles((theme) => ({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.overlay,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  sheet: {
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  burst: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  particle: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  hint: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
}));
