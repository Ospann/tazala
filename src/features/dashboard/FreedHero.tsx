import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Sparkle } from '@/components/motion/Sparkle';
import { useCountUp } from '@/components/motion/useCountUp';
import { createStyles, useTheme } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

interface FreedHeroProps {
  freedBytes: number;
  deletedCount: number;
}

export function FreedHero({ freedBytes, deletedCount }: FreedHeroProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation();
  const format = useFormat();
  const animated = useCountUp(freedBytes, 1200, 0);
  const parts = format.bytesParts(animated);
  const celebrating = freedBytes > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={styles.hero}
      accessible
      accessibilityLabel={t('dashboard.freedA11y', { size: format.bytes(freedBytes) })}
    >
      <AppText variant="caption" tone="secondary">
        {t('dashboard.freedTitle')}
      </AppText>
      <View style={styles.valueRow}>
        {celebrating ? (
          <>
            <Sparkle
              size={22}
              color={theme.colors.primaryBright}
              style={styles.sparkleLeft}
              delay={0}
            />
            <Sparkle size={16} color={theme.colors.coral} style={styles.sparkleRight} delay={500} />
            <Sparkle
              size={12}
              color={theme.colors.primaryBright}
              style={styles.sparkleTop}
              delay={900}
            />
          </>
        ) : null}
        <AppText variant="hero" tone="accent">
          {parts.value}
        </AppText>
        <AppText variant="title" tone="accent">
          {parts.unit}
        </AppText>
      </View>
      <AppText variant="caption" tone="secondary">
        {t('dashboard.deletedCount', {
          count: deletedCount,
          formatted: format.number(deletedCount),
        })}
      </AppText>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  hero: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  sparkleLeft: {
    position: 'absolute',
    left: -4,
    top: 6,
  },
  sparkleRight: {
    position: 'absolute',
    right: -2,
    top: -4,
  },
  sparkleTop: {
    position: 'absolute',
    right: 18,
    bottom: -6,
  },
}));
