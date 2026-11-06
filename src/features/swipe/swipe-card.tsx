import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { type LayoutChangeEvent, useWindowDimensions, View } from 'react-native';
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

import { AppText } from '@/components/app-text';
import type { MediaItem } from '@/db/media-item';
import { createStyles } from '@/theme/theme-provider';
import { useFormat } from '@/utils/use-format';

import { SwipeVideo } from './swipe-video';

export type SwipeDirection = 'left' | 'right';

export interface SwipeCardHandle {
  swipe: (direction: SwipeDirection) => void;
}

interface SwipeCardProps {
  item: MediaItem;
  onSwiped: (item: MediaItem, direction: SwipeDirection) => void;
  active: boolean;
  drag: SharedValue<number>;
  muted: boolean;
  onToggleMuted: () => void;
}

const VELOCITY_THRESHOLD = 800;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const ZOOM_SPRING = { damping: 20, stiffness: 220 };

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function bound(value: number, size: number, currentScale: number) {
  'worklet';
  const limit = (size * (currentScale - 1)) / 2;
  return clamp(value, -limit, limit);
}

function crossedHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { item, onSwiped, active, drag, muted, onToggleMuted },
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
  const isVideo = item.mediaType === 'video';
  const zoomable = active && !isVideo;
  const [zoomed, setZoomed] = useState(false);
  const cardWidth = useSharedValue(width);
  const cardHeight = useSharedValue(width);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const zoomX = useSharedValue(0);
  const zoomY = useSharedValue(0);
  const savedZoomX = useSharedValue(0);
  const savedZoomY = useSharedValue(0);
  const durationLabel = item.duration != null ? format.duration(item.duration) : null;

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

  const onLayout = (event: LayoutChangeEvent) => {
    cardWidth.set(event.nativeEvent.layout.width);
    cardHeight.set(event.nativeEvent.layout.height);
  };

  const resetZoom = () => {
    'worklet';
    scale.set(withSpring(1, ZOOM_SPRING));
    savedScale.set(1);
    zoomX.set(withSpring(0, ZOOM_SPRING));
    zoomY.set(withSpring(0, ZOOM_SPRING));
    savedZoomX.set(0);
    savedZoomY.set(0);
    scheduleOnRN(setZoomed, false);
  };

  const pinch = Gesture.Pinch()
    .enabled(zoomable)
    .onUpdate((event) => {
      const next = clamp(savedScale.get() * event.scale, 0.8, MAX_SCALE);
      scale.set(next);
      zoomX.set(bound(savedZoomX.get(), cardWidth.get(), next));
      zoomY.set(bound(savedZoomY.get(), cardHeight.get(), next));
    })
    .onEnd(() => {
      if (scale.get() <= 1.02) {
        resetZoom();
        return;
      }
      savedScale.set(scale.get());
      savedZoomX.set(zoomX.get());
      savedZoomY.set(zoomY.get());
      scheduleOnRN(setZoomed, true);
    });

  const zoomPan = Gesture.Pan()
    .enabled(zoomable && zoomed)
    .averageTouches(true)
    .onUpdate((event) => {
      zoomX.set(bound(savedZoomX.get() + event.translationX, cardWidth.get(), scale.get()));
      zoomY.set(bound(savedZoomY.get() + event.translationY, cardHeight.get(), scale.get()));
    })
    .onEnd(() => {
      savedZoomX.set(zoomX.get());
      savedZoomY.set(zoomY.get());
    });

  const doubleTap = Gesture.Tap()
    .enabled(zoomable)
    .numberOfTaps(2)
    .onEnd((event) => {
      if (savedScale.get() > 1) {
        resetZoom();
        return;
      }
      const w = cardWidth.get();
      const h = cardHeight.get();
      const nextX = bound((w / 2 - event.x) * (DOUBLE_TAP_SCALE - 1), w, DOUBLE_TAP_SCALE);
      const nextY = bound((h / 2 - event.y) * (DOUBLE_TAP_SCALE - 1), h, DOUBLE_TAP_SCALE);
      scale.set(withTiming(DOUBLE_TAP_SCALE, { duration: 220 }));
      zoomX.set(withTiming(nextX, { duration: 220 }));
      zoomY.set(withTiming(nextY, { duration: 220 }));
      savedScale.set(DOUBLE_TAP_SCALE);
      savedZoomX.set(nextX);
      savedZoomY.set(nextY);
      scheduleOnRN(setZoomed, true);
    });

  const pan = Gesture.Pan()
    .enabled(active && !zoomed)
    .maxPointers(1)
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

  const gesture = Gesture.Simultaneous(Gesture.Race(pinch, pan), zoomPan, doubleTap);

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: zoomX.get() }, { translateY: zoomY.get() }, { scale: scale.get() }],
  }));

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
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.card, cardStyle]}
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          isVideo
            ? t('swipe.cardVideoA11y', {
                date: format.date(item.createdAt),
                duration: durationLabel ?? '',
                size: format.bytes(item.fileSize),
              })
            : t('swipe.cardA11y', {
                date: format.date(item.createdAt),
                size: format.bytes(item.fileSize),
              })
        }
        accessibilityHint={t('swipe.cardHint')}
      >
        <Animated.View style={[styles.image, zoomStyle]}>
          <Image
            source={{ uri: item.uri }}
            style={styles.image}
            contentFit="contain"
            recyclingKey={item.id}
            cachePolicy="memory"
          />
        </Animated.View>
        {isVideo && active ? (
          <SwipeVideo item={item} muted={muted} onToggleMuted={onToggleMuted} />
        ) : null}
        <Animated.View style={[styles.tint, styles.keepTint, keepTintStyle]} pointerEvents="none" />
        <Animated.View
          style={[styles.tint, styles.trashTint, trashTintStyle]}
          pointerEvents="none"
        />
        <View style={[styles.meta, zoomed && styles.hidden]}>
          <AppText variant="label" tone="onMedia">
            {format.date(item.createdAt)}
          </AppText>
          <AppText variant="caption" tone="onMedia">
            {isVideo && durationLabel
              ? `${durationLabel} · ${format.bytes(item.fileSize)}`
              : format.bytes(item.fileSize)}
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
  hidden: {
    opacity: 0,
  },
  meta: {
    position: 'absolute',
    left: theme.spacing.lg,
    bottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.mediaScrim,
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
