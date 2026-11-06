import { Image } from 'expo-image';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { MediaItem } from '@/db/media-item';
import { createStyles } from '@/theme/theme-provider';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const SPRING = { damping: 20, stiffness: 220 };

interface ZoomableImageProps {
  item: MediaItem;
  zoomed: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onTap: () => void;
  onDismiss: () => void;
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function bound(value: number, size: number, currentScale: number) {
  'worklet';
  const limit = (size * (currentScale - 1)) / 2;
  return clamp(value, -limit, limit);
}

export function ZoomableImage({
  item,
  zoomed,
  onZoomChange,
  onTap,
  onDismiss,
}: ZoomableImageProps) {
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const dismissY = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.set(withSpring(1, SPRING));
    savedScale.set(1);
    translateX.set(withSpring(0, SPRING));
    translateY.set(withSpring(0, SPRING));
    savedX.set(0);
    savedY.set(0);
    scheduleOnRN(onZoomChange, false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = clamp(savedScale.get() * event.scale, 0.8, MAX_SCALE);
      scale.set(next);
      translateX.set(bound(savedX.get(), width, next));
      translateY.set(bound(savedY.get(), height, next));
    })
    .onEnd(() => {
      if (scale.get() <= 1.02) {
        reset();
        return;
      }
      savedScale.set(scale.get());
      savedX.set(translateX.get());
      savedY.set(translateY.get());
      scheduleOnRN(onZoomChange, true);
    });

  const zoomPan = Gesture.Pan()
    .enabled(zoomed)
    .averageTouches(true)
    .onUpdate((event) => {
      translateX.set(bound(savedX.get() + event.translationX, width, scale.get()));
      translateY.set(bound(savedY.get() + event.translationY, height, scale.get()));
    })
    .onEnd(() => {
      savedX.set(translateX.get());
      savedY.set(translateY.get());
    });

  const dismissPan = Gesture.Pan()
    .enabled(!zoomed)
    .activeOffsetY([-16, 16])
    .failOffsetX([-16, 16])
    .onUpdate((event) => {
      dismissY.set(event.translationY);
    })
    .onEnd((event) => {
      if (
        Math.abs(event.translationY) > DISMISS_DISTANCE ||
        Math.abs(event.velocityY) > DISMISS_VELOCITY
      ) {
        scheduleOnRN(onDismiss);
      } else {
        dismissY.set(withSpring(0, SPRING));
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (savedScale.get() > 1) {
        reset();
        return;
      }
      const nextX = bound((width / 2 - event.x) * (DOUBLE_TAP_SCALE - 1), width, DOUBLE_TAP_SCALE);
      const nextY = bound(
        (height / 2 - event.y) * (DOUBLE_TAP_SCALE - 1),
        height,
        DOUBLE_TAP_SCALE,
      );
      scale.set(withTiming(DOUBLE_TAP_SCALE, { duration: 220 }));
      translateX.set(withTiming(nextX, { duration: 220 }));
      translateY.set(withTiming(nextY, { duration: 220 }));
      savedScale.set(DOUBLE_TAP_SCALE);
      savedX.set(nextX);
      savedY.set(nextY);
      scheduleOnRN(onZoomChange, true);
    });

  const singleTap = Gesture.Tap()
    .requireExternalGestureToFail(doubleTap)
    .onEnd(() => {
      scheduleOnRN(onTap);
    });

  const gesture = Gesture.Simultaneous(
    pinch,
    zoomPan,
    dismissPan,
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() + dismissY.get() },
      { scale: scale.get() * (1 - Math.min(Math.abs(dismissY.get()) / height, 0.4)) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, { width, height }]}>
        <Animated.View style={[styles.fill, imageStyle]}>
          <Image
            source={{ uri: item.uri }}
            style={styles.fill}
            contentFit="contain"
            recyclingKey={item.id}
            cachePolicy="memory"
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const useStyles = createStyles(() => ({
  page: {
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
}));
