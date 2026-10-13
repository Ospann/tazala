import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AccessibilityInfo, Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sparkle } from '@/components/motion/Sparkle';
import { useCountUp } from '@/components/motion/useCountUp';
import { createStyles, useTheme } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

interface CelebrationProps {
  freedBytes: number;
  deletedCount: number;
  showIosHint: boolean;
  onClose: () => void;
}

const PARTICLES = 18;

function Particle({
  index,
  color,
  reduceMotion,
}: {
  index: number;
  color: string;
  reduceMotion: boolean;
}) {
  const styles = useStyles();
  const progress = useSharedValue(0);
  const angle = (index / PARTICLES) * Math.PI * 2 + (index % 2) * 0.2;
  const distance = 95 + (index % 4) * 26;
  const spin = (index % 2 === 0 ? 1 : -1) * (180 + (index % 3) * 90);
  const size = index % 3 === 0 ? 18 : index % 3 === 1 ? 12 : 9;

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(
      withDelay(
        120 + (index % 6) * 25,
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [index, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.15, 0.75, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: Math.cos(angle) * distance * progress.get() },
      {
        translateY:
          Math.sin(angle) * distance * progress.get() + 40 * progress.get() * progress.get(),
      },
      { rotate: `${spin * progress.get()}deg` },
      { scale: 1.2 - progress.get() * 0.6 },
    ],
  }));

  return (
    <Animated.View style={[styles.particle, style]}>
      <Sparkle size={size} color={color} twinkle={false} />
    </Animated.View>
  );
}

function Shockwave({ color, reduceMotion }: { color: string; reduceMotion: boolean }) {
  const styles = useStyles();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - progress.get()),
    transform: [{ scale: 0.4 + progress.get() * 1.4 }],
  }));
  return <Animated.View style={[styles.shockwave, { borderColor: color }, style]} />;
}

export function Celebration({ freedBytes, deletedCount, showIosHint, onClose }: CelebrationProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation();
  const format = useFormat();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const animatedBytes = useCountUp(freedBytes, 1300, 0);
  const freed = format.bytesParts(animatedBytes);

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
            <Shockwave color={theme.colors.primaryBright} reduceMotion={reduceMotion} />
            {Array.from({ length: PARTICLES }, (_, index) => (
              <Particle
                key={index}
                index={index}
                reduceMotion={reduceMotion}
                color={colors[index % colors.length] ?? theme.colors.primary}
              />
            ))}
            <Animated.View style={[styles.value, valueStyle]}>
              <Sparkle
                size={20}
                color={theme.colors.primaryBright}
                style={styles.staySparkleLeft}
                delay={1200}
              />
              <Sparkle
                size={14}
                color={theme.colors.coral}
                style={styles.staySparkleRight}
                delay={1500}
              />
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
    height: 190,
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
  },
  staySparkleLeft: {
    position: 'absolute',
    left: -22,
    top: -6,
  },
  staySparkleRight: {
    position: 'absolute',
    right: -18,
    bottom: 4,
  },
  shockwave: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
  },
  hint: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
}));
