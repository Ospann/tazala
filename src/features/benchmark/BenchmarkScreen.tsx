import { useState } from 'react';
import { View } from 'react-native';
import TazalaScanner from 'tazala-scanner';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { runScan } from '@/features/scan/scanService';
import { useScanStore } from '@/stores/scanStore';
import { createStyles } from '@/theme/ThemeProvider';

function rate(count: number, ms: number): string {
  return ms > 0 ? (count / (ms / 1000)).toFixed(1) : '—';
}

function mb(bytes: number): string {
  return bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : '—';
}

export function BenchmarkScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { phase, processed, total, lastMetrics } = useScanStore();
  const [listing, setListing] = useState<{ count: number; ms: number } | null>(null);
  const running = phase !== 'idle';

  const measureListing = async () => {
    const started = Date.now();
    let offset = 0;
    for (;;) {
      const page = await TazalaScanner.listAssets(offset, 1000);
      offset += page.length;
      if (page.length < 1000) break;
    }
    setListing({ count: offset, ms: Date.now() - started });
  };

  const rows: [string, string][] = lastMetrics
    ? [
        [
          'Platform',
          `${TazalaScanner.platform} · analysis v${TazalaScanner.analysisVersion} · ${TazalaScanner.fingerprintKind}`,
        ],
        ['Listed assets', `${lastMetrics.listedAssets}`],
        [
          'Sync',
          `${lastMetrics.syncMs} ms · ${rate(lastMetrics.listedAssets, lastMetrics.syncMs)} assets/s`,
        ],
        ['Analyzed photos', `${lastMetrics.analyzedAssets}`],
        [
          'Analysis',
          `${lastMetrics.analyzeMs} ms · ${rate(lastMetrics.analyzedAssets, lastMetrics.analyzeMs)} photos/s`,
        ],
        ['Grouping', `${lastMetrics.groupingMs} ms · ${lastMetrics.comparisons} comparisons`],
        ['Similar groups', `${lastMetrics.similarGroups}`],
        ['Duplicate groups', `${lastMetrics.duplicateGroups}`],
        ['Peak memory', mb(lastMetrics.peakMemoryBytes)],
        ['Total', `${lastMetrics.totalMs} ms${lastMetrics.cancelled ? ' (cancelled)' : ''}`],
      ]
    : [];

  return (
    <Screen edges={['top']}>
      <Header title={t('benchmark.title')} />
      <View style={styles.flex}>
        <Screen scroll edges={['bottom']}>
          <View style={styles.actions}>
            <Button
              label="Full scan"
              icon="flash-outline"
              disabled={running}
              onPress={() => void runScan({ full: true, measureMemory: true })}
            />
            <Button
              label="Incremental scan"
              variant="secondary"
              disabled={running}
              onPress={() => void runScan({ measureMemory: true })}
            />
            <Button
              label="Measure listAssets"
              variant="secondary"
              disabled={running}
              onPress={() => void measureListing()}
            />
          </View>
          {running ? (
            <View style={styles.card}>
              <AppText variant="label">
                {phase} · {processed}/{total}
              </AppText>
              <ProgressBar progress={total > 0 ? processed / total : 0} />
            </View>
          ) : null}
          {listing ? (
            <View style={styles.card}>
              <AppText variant="label">listAssets</AppText>
              <AppText tone="secondary">
                {listing.count} assets · {listing.ms} ms · {rate(listing.count, listing.ms)}{' '}
                assets/s
              </AppText>
            </View>
          ) : null}
          {rows.length > 0 ? (
            <View style={styles.card}>
              {rows.map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <AppText variant="caption" tone="secondary" style={styles.flex}>
                    {label}
                  </AppText>
                  <AppText variant="label">{value}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </Screen>
      </View>
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  flex: {
    flex: 1,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
}));
