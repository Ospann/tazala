import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/ProgressBar';
import { cancelScan, pauseScan, resumeScan, runScan } from '@/features/scan/scanService';
import { useScanStore } from '@/stores/scanStore';
import { createStyles } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

export function ScanCard() {
  const styles = useStyles();
  const { t } = useTranslation();
  const format = useFormat();
  const { phase, processed, total, paused, error } = useScanStore();

  if (phase === 'idle' && !error) {
    return null;
  }

  if (phase === 'idle' && error) {
    return (
      <View style={styles.card} accessibilityLiveRegion="polite">
        <AppText variant="bodyStrong">{t('scan.errorTitle')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('scan.errorBody')}
        </AppText>
        <Button label={t('common.retry')} variant="secondary" onPress={() => void runScan()} />
      </View>
    );
  }

  const progress =
    phase === 'analyzing' && total > 0 ? processed / total : phase === 'grouping' ? 1 : 0;
  const label =
    phase === 'syncing'
      ? t('scan.syncing', { count: processed, formatted: format.number(processed) })
      : phase === 'grouping'
        ? t('scan.grouping')
        : t('scan.analyzing', { processed: format.number(processed), total: format.number(total) });

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {paused ? t('scan.paused') : t('scan.title')}
        </AppText>
        {phase === 'analyzing' && total > 0 ? (
          <AppText variant="label" tone="accent">
            {Math.round(progress * 100)}%
          </AppText>
        ) : null}
      </View>
      <ProgressBar progress={progress} accessibilityLabel={label} />
      <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
        {label}
      </AppText>
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
    </View>
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
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
}));
