import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const STAR_PATH = 'M50 0 Q56 44 100 50 Q56 56 50 100 Q44 56 0 50 Q44 44 50 0 Z';

interface SparkleProps {
  size: number;
  color: string;
  delay?: number;
  period?: number;
  twinkle?: boolean;
  style?: object;
}

export function Sparkle({
  size,
  color,
  delay = 0,
  period = 1600,
  twinkle = true,
  style,
}: SparkleProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(twinkle && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (!twinkle || reduceMotion) {
      progress.set(1);
      return;
    }
    progress.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.35, { duration: period / 2, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      ),
    );
  }, [delay, period, progress, reduceMotion, twinkle]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.4 + progress.get() * 0.6,
    transform: [{ scale: 0.6 + progress.get() * 0.4 }, { rotate: `${progress.get() * 20}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, style, animated]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d={STAR_PATH} fill={color} />
      </Svg>
    </Animated.View>
  );
}
