import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Sparkle } from '@/components/motion/Sparkle';
import { createStyles, useTheme } from '@/theme/ThemeProvider';

const SIZE = 220;

function MiniPhoto({
  width,
  height,
  sky,
  mountain,
  accent,
}: {
  width: number;
  height: number;
  sky: string;
  mountain: string;
  accent: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 120">
      <Rect x="0" y="0" width="100" height="120" rx="14" fill="#FFFFFF" />
      <Rect x="8" y="8" width="84" height="104" rx="9" fill={sky} />
      <Circle cx="68" cy="38" r="11" fill={accent} />
      <Path
        d="M8 92 L38 52 L58 78 L72 62 L92 86 L92 103 Q92 112 83 112 L17 112 Q8 112 8 103 Z"
        fill={mountain}
      />
    </Svg>
  );
}

function useActivation(active: boolean) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.set(1);
      return;
    }
    progress.set(
      active ? withSpring(1, { damping: 14, stiffness: 110 }) : withTiming(0, { duration: 200 }),
    );
  }, [active, progress, reduceMotion]);
  return progress;
}

export function IntroIllustration({ active }: { active: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  const progress = useActivation(active);
  const cards = [
    { angle: -16, x: -46, sky: theme.colors.primarySoft, mountain: theme.colors.primaryBright },
    { angle: 14, x: 46, sky: '#FFE3DE', mountain: theme.colors.coral },
    { angle: 0, x: 0, sky: '#D7F6F0', mountain: theme.colors.primary },
  ];

  return (
    <View style={styles.stage}>
      {cards.map((card, index) => (
        <FannedCard
          key={card.angle}
          progress={progress}
          angle={card.angle}
          offset={card.x}
          lift={index === 2 ? -6 : 8}
        >
          <MiniPhoto
            width={110}
            height={132}
            sky={card.sky}
            mountain={card.mountain}
            accent={theme.colors.coral}
          />
        </FannedCard>
      ))}
      <Sparkle size={34} color={theme.colors.primaryBright} style={styles.sparkleA} delay={200} />
      <Sparkle size={22} color={theme.colors.coral} style={styles.sparkleB} delay={700} />
      <Sparkle size={16} color={theme.colors.primary} style={styles.sparkleC} delay={1100} />
    </View>
  );
}

function FannedCard({
  progress,
  angle,
  offset,
  lift,
  children,
}: {
  progress: SharedValue<number>;
  angle: number;
  offset: number;
  lift: number;
  children: ReactNode;
}) {
  const styles = useStyles();
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset * progress.get() },
      { translateY: lift * progress.get() },
      { rotate: `${angle * progress.get()}deg` },
      { scale: 0.86 + 0.14 * progress.get() },
    ],
  }));
  return <Animated.View style={[styles.card, style]}>{children}</Animated.View>;
}

export function PrivacyIllustration({ active }: { active: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useActivation(active);
  const shackle = useSharedValue(reduceMotion ? 1 : 0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    shackle.set(
      active
        ? withDelay(450, withSpring(1, { damping: 9, stiffness: 160 }))
        : withTiming(0, { duration: 150 }),
    );
    pulse.set(
      active
        ? withDelay(
            700,
            withRepeat(
              withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
              -1,
              false,
            ),
          )
        : withTiming(0, { duration: 150 }),
    );
  }, [active, pulse, reduceMotion, shackle]);

  const shieldStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + 0.4 * progress.get() }],
    opacity: progress.get(),
  }));
  const shackleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -14 * (1 - shackle.get()) }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.get()),
    transform: [{ scale: 0.8 + 0.6 * pulse.get() }],
  }));

  return (
    <View style={styles.stage}>
      <Animated.View
        style={[styles.pulse, { borderColor: theme.colors.primaryBright }, pulseStyle]}
      />
      <Animated.View style={shieldStyle}>
        <Svg width={150} height={170} viewBox="0 0 150 170">
          <Path
            d="M75 6 L138 30 L138 82 C138 124 110 152 75 164 C40 152 12 124 12 82 L12 30 Z"
            fill={theme.colors.primary}
          />
          <Path
            d="M75 20 L126 39 L126 82 C126 116 104 139 75 150 C46 139 24 116 24 82 L24 39 Z"
            fill={theme.colors.primaryBright}
            opacity={0.35}
          />
          <Rect x="49" y="78" width="52" height="42" rx="9" fill="#FFFFFF" />
          <Circle cx="75" cy="96" r="6" fill={theme.colors.primary} />
          <Rect x="72" y="98" width="6" height="12" rx="3" fill={theme.colors.primary} />
        </Svg>
        <Animated.View style={[styles.shackle, shackleStyle]}>
          <Svg width={40} height={36} viewBox="0 0 40 36">
            <Path
              d="M6 36 L6 18 C6 9 12 3 20 3 C28 3 34 9 34 18 L34 36"
              stroke="#FFFFFF"
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Sparkle size={20} color={theme.colors.coral} style={styles.sparkleB} delay={900} />
    </View>
  );
}

export function AccessIllustration({ active }: { active: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  const tiles = [
    theme.colors.primaryBright,
    theme.colors.primarySoft,
    theme.colors.coral,
    theme.colors.primary,
    theme.colors.primaryBright,
    theme.colors.primarySoft,
    theme.colors.primarySoft,
    theme.colors.primary,
    theme.colors.primaryBright,
  ];
  return (
    <View style={styles.stage}>
      <View style={styles.grid}>
        {tiles.map((tileColor, index) => (
          <GridTile key={index} index={index} active={active} color={tileColor} />
        ))}
      </View>
      <Sparkle size={30} color={theme.colors.primaryBright} style={styles.sparkleA} delay={600} />
      <Sparkle size={18} color={theme.colors.coral} style={styles.sparkleC} delay={1000} />
    </View>
  );
}

function GridTile({ index, active, color }: { index: number; active: boolean; color: string }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const row = Math.floor(index / 3);
    const column = index % 3;
    progress.set(
      active
        ? withDelay(
            (row + column) * 90,
            withSequence(
              withTiming(1.08, { duration: 180 }),
              withSpring(1, { damping: 14, stiffness: 180 }),
            ),
          )
        : withTiming(0, { duration: 150 }),
    );
  }, [active, index, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(progress.get(), 1),
    transform: [{ scale: progress.get() }],
  }));

  return <Animated.View style={[styles.tile, { backgroundColor: color }, style]} />;
}

const useStyles = createStyles((theme) => ({
  stage: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  sparkleA: {
    position: 'absolute',
    top: 4,
    right: 14,
  },
  sparkleB: {
    position: 'absolute',
    bottom: 22,
    left: 6,
  },
  sparkleC: {
    position: 'absolute',
    top: 34,
    left: 24,
  },
  pulse: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
  },
  shackle: {
    position: 'absolute',
    left: 55,
    top: 50,
  },
  grid: {
    width: 180,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: 53,
    height: 53,
    borderRadius: 14,
  },
}));
