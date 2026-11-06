import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  size: number;
  strokeWidth: number;
  progress: number;
  trackColor: string;
  colors: [string, string];
  spinning?: boolean;
  children?: ReactNode;
}

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  trackColor,
  colors,
  spinning = false,
  children,
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useSharedValue(0);
  const rotation = useSharedValue(0);
  const clamped = Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 1);

  useEffect(() => {
    value.set(
      withTiming(clamped, { duration: reduceMotion ? 0 : 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [clamped, reduceMotion, value]);

  useEffect(() => {
    if (spinning && !reduceMotion) {
      rotation.set(0);
      rotation.set(
        withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1, false),
      );
    } else {
      rotation.set(withTiming(0, { duration: 200 }));
    }
  }, [reduceMotion, rotation, spinning]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.get()),
  }));
  const sweepProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * 0.82,
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
    opacity: spinning ? 1 : 0,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ring)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arcProps}
          fill="none"
        />
      </Svg>
      <Animated.View
        style={[{ position: 'absolute', width: size, height: size }, sweepStyle]}
        pointerEvents="none"
      >
        <Svg width={size} height={size}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors[0]}
            strokeOpacity={0.35}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={sweepProps}
            fill="none"
          />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}
