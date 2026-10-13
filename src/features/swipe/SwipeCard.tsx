import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import type { MediaItem } from '@/db/mediaItem';
import { createStyles } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

export type SwipeDirection = 'left' | 'right';

export interface SwipeCardHandle {
  swipe: (direction: SwipeDirection) => void;
}

interface SwipeCardProps {
  item: MediaItem;
  onSwiped: (item: MediaItem, direction: SwipeDirection) => void;
  active: boolean;
  drag: SharedValue<number>;
}

const VELOCITY_THRESHOLD = 800;

function crossedHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { item, onSwiped, active, drag },
  ref,
) {
  const styles = useStyles();
  const { t } = useTranslation();
  const format = useFormat();
  const { width } = useWindowDimensions();
  const threshold = width * 0.28;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const crossed = useSharedValue(0);
  const done = useSharedValue(false);

  useEffect(() => {
    drag.set(0);
  }, [drag]);

  useAnimatedReaction(
    () => translateX.get(),
    (value) => {
      drag.set(Math.min(Math.abs(value) / threshold, 1));
    },
  );

  const finish = (direction: SwipeDirection) => {
    onSwiped(item, direction);
  };

  const flyOut = (direction: SwipeDirection, velocity = 0) => {
    'worklet';
    if (done.get()) return;
    done.set(true);
    const target = (direction === 'left' ? -1 : 1) * width * 1.5;
    const duration = Math.max(160, 260 - Math.min(Math.abs(velocity), 2000) / 20);
    translateX.set(
      withTiming(target, { duration }, (finished) => {
        if (finished) scheduleOnRN(finish, direction);
      }),
    );
  };

  useImperativeHandle(ref, () => ({
    swipe: (direction: SwipeDirection) => flyOut(direction),
  }));

  const pan = Gesture.Pan()
    .enabled(active)
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      translateX.set(event.translationX);
      translateY.set(event.translationY * 0.3);
      const side = event.translationX > threshold ? 1 : event.translationX < -threshold ? -1 : 0;
      if (side !== 0 && crossed.get() !== side) {
        scheduleOnRN(crossedHaptic);
      }
      crossed.set(side);
    })
    .onEnd((event) => {
      const goRight = event.translationX > threshold || event.velocityX > VELOCITY_THRESHOLD;
      const goLeft = event.translationX < -threshold || event.velocityX < -VELOCITY_THRESHOLD;
      if (goRight || goLeft) {
        flyOut(goRight ? 'right' : 'left', event.velocityX);
      } else {
        translateX.set(withSpring(0, { damping: 18, stiffness: 180 }));
        translateY.set(withSpring(0, { damping: 18, stiffness: 180 }));
        crossed.set(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      {
        rotate: `${interpolate(translateX.get(), [-width, 0, width], [-12, 0, 12], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));
  const keepStyle = useAnimatedStyle(() => {
    const amount = interpolate(translateX.get(), [0, threshold], [0, 1], Extrapolation.CLAMP);
    return { opacity: amount, transform: [{ rotate: '-10deg' }, { scale: 0.7 + amount * 0.3 }] };
  });
  const trashStyle = useAnimatedStyle(() => {
    const amount = interpolate(translateX.get(), [-threshold, 0], [1, 0], Extrapolation.CLAMP);
    return { opacity: amount, transform: [{ rotate: '10deg' }, { scale: 0.7 + amount * 0.3 }] };
  });
  const keepTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [0, threshold * 1.4], [0, 0.32], Extrapolation.CLAMP),
  }));
  const trashTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-threshold * 1.4, 0], [0.32, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, cardStyle]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('swipe.cardA11y', {
          date: format.date(item.createdAt),
          size: format.bytes(item.fileSize),
        })}
        accessibilityHint={t('swipe.cardHint')}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="contain"
          recyclingKey={item.id}
          cachePolicy="memory"
        />
        <Animated.View style={[styles.tint, styles.keepTint, keepTintStyle]} pointerEvents="none" />
        <Animated.View
          style={[styles.tint, styles.trashTint, trashTintStyle]}
          pointerEvents="none"
        />
        <View style={styles.meta}>
          <AppText variant="label" tone="onPrimary">
            {format.date(item.createdAt)}
          </AppText>
          <AppText variant="caption" tone="onPrimary">
            {format.bytes(item.fileSize)}
          </AppText>
        </View>
        <Animated.View style={[styles.stamp, styles.stampKeep, keepStyle]} pointerEvents="none">
          <AppText variant="heading" tone="onPrimary">
            {t('swipe.keep')}
          </AppText>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampTrash, trashStyle]} pointerEvents="none">
          <AppText variant="heading" tone="onDanger">
            {t('swipe.toTrash')}
          </AppText>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

const useStyles = createStyles((theme) => ({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    backgroundColor: theme.scheme === 'dark' ? '#000000' : '#0E1F1C',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  image: {
    flex: 1,
  },
  meta: {
    position: 'absolute',
    left: theme.spacing.lg,
    bottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  stamp: {
    position: 'absolute',
    top: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
  },
  stampKeep: {
    left: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
  },
  stampTrash: {
    right: theme.spacing.xl,
    backgroundColor: theme.colors.danger,
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  keepTint: {
    backgroundColor: theme.colors.primaryBright,
  },
  trashTint: {
    backgroundColor: theme.colors.coral,
  },
}));
