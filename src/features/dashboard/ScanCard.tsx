import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ProgressRing } from '@/components/motion/ProgressRing';
import { cancelScan, pauseScan, resumeScan, runScan } from '@/features/scan/scanService';
import { useScanStore } from '@/stores/scanStore';
import { createStyles, useTheme } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

export function ScanCard() {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation();
  const format = useFormat();
  const { phase, processed, total, paused, error } = useScanStore();

  if (phase === 'idle' && !error) {
    return null;
  }

  if (phase === 'idle' && error) {
    return (
      <Animated.View
        entering={FadeInDown}
        exiting={FadeOutUp}
        style={styles.card}
        accessibilityLiveRegion="polite"
      >
        <AppText variant="bodyStrong">{t('scan.errorTitle')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('scan.errorBody')}
        </AppText>
        <Button label={t('common.retry')} variant="secondary" onPress={() => void runScan()} />
      </Animated.View>
    );
  }

  const determinate = phase === 'analyzing' && total > 0;
  const progress = determinate ? processed / total : phase === 'grouping' ? 1 : 0;
  const label =
    phase === 'syncing'
      ? t('scan.syncing', { count: processed, formatted: format.number(processed) })
      : phase === 'grouping'
        ? t('scan.grouping')
        : t('scan.analyzing', { processed: format.number(processed), total: format.number(total) });

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      exiting={FadeOutUp.duration(300)}
      layout={LinearTransition}
      style={styles.card}
    >
      <View style={styles.row}>
        <ProgressRing
          size={72}
          strokeWidth={7}
          progress={progress}
          trackColor={theme.colors.surfaceMuted}
          colors={[theme.colors.primaryBright, theme.colors.primary]}
          spinning={!paused && phase !== 'analyzing'}
        >
          {determinate ? (
            <AppText variant="label" tone="accent">
              {Math.round(progress * 100)}%
            </AppText>
          ) : (
            <Icon
              name={phase === 'grouping' ? 'albums-outline' : 'images-outline'}
              size={24}
              color="primary"
            />
          )}
        </ProgressRing>
        <View style={styles.text}>
          <AppText variant="bodyStrong">{paused ? t('scan.paused') : t('scan.title')}</AppText>
          <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
            {label}
          </AppText>
        </View>
      </View>
      {phase === 'analyzing' ? (
        <View style={styles.actions}>
          <Button
            label={paused ? t('scan.resume') : t('scan.pause')}
            icon={paused ? 'play' : 'pause'}
            variant="secondary"
            onPress={paused ? resumeScan : pauseScan}
            style={styles.flex}
          />
          <Button label={t('common.cancel')} variant="ghost" onPress={cancelScan} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  text: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
}));
