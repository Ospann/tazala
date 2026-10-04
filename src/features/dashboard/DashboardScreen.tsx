import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { isScanRunning, runScan } from '@/features/scan/scanService';
import { useLibraryStore } from '@/stores/libraryStore';
import { hasLibraryAccess, usePermissionStore } from '@/stores/permissionStore';
import { useScanStore } from '@/stores/scanStore';
import { createStyles } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

import { CategoryCard } from './CategoryCard';
import { categoryOrder } from './categoryMeta';
import { LimitedAccessBanner, PermissionDenied } from './PermissionNotice';
import { ScanCard } from './ScanCard';

export function DashboardScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const format = useFormat();
  const status = usePermissionStore((state) => state.status);
  const library = useLibraryStore();
  const phase = useScanStore((state) => state.phase);
  const hasAccess = hasLibraryAccess(status);

  useEffect(() => {
    void useLibraryStore.getState().refresh();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void useLibraryStore.getState().refresh();
    }, []),
  );

  useEffect(() => {
    if (hasAccess && !isScanRunning()) {
      void runScan();
    }
  }, [hasAccess]);

  const freed = format.bytesParts(library.freedBytes);
  const pending = phase !== 'idle' && library.lastScanAt === null;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.topBar}>
        <AppText variant="heading" tone="accent" accessibilityRole="header">
          Tazala
        </AppText>
        <View style={styles.topActions}>
          <View>
            <IconButton
              icon="trash-outline"
              label={t('trash.openWithCount', { count: library.trash.count })}
              onPress={() => router.push('/trash')}
            />
            {library.trash.count > 0 ? (
              <View style={styles.badge} pointerEvents="none">
                <AppText variant="caption" tone="onDanger">
                  {library.trash.count > 999 ? '999+' : library.trash.count}
                </AppText>
              </View>
            ) : null}
          </View>
          <IconButton
            icon="settings-outline"
            label={t('settings.title')}
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>

      {status === 'denied' || status === 'undetermined' ? (
        <PermissionDenied />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => void runScan()}
              enabled={phase === 'idle'}
            />
          }
        >
          <View
            style={styles.hero}
            accessible
            accessibilityLabel={t('dashboard.freedA11y', {
              size: format.bytes(library.freedBytes),
            })}
          >
            <AppText variant="caption" tone="secondary">
              {t('dashboard.freedTitle')}
            </AppText>
            <View style={styles.heroValue}>
              <AppText variant="hero" tone="accent">
                {freed.value}
              </AppText>
              <AppText variant="title" tone="accent">
                {freed.unit}
              </AppText>
            </View>
            <AppText variant="caption" tone="secondary">
              {t('dashboard.deletedCount', {
                count: library.deletedCount,
                formatted: format.number(library.deletedCount),
              })}
            </AppText>
          </View>

          <View style={styles.summary}>
            <SummaryItem
              icon="image-outline"
              value={format.number(library.totals.photoCount)}
              label={t('dashboard.photos', { count: library.totals.photoCount })}
            />
            <SummaryItem
              icon="videocam-outline"
              value={format.number(library.totals.videoCount)}
              label={t('dashboard.videos', { count: library.totals.videoCount })}
            />
            <SummaryItem
              icon="server-outline"
              value={format.bytes(library.totals.totalBytes)}
              label={t('dashboard.occupied')}
            />
          </View>

          {status === 'limited' ? <LimitedAccessBanner /> : null}
          <ScanCard />

          <Button
            label={t('dashboard.swipe')}
            icon="swap-horizontal"
            size="large"
            onPress={() => router.push('/swipe')}
            disabled={library.totals.photoCount === 0}
          />

          <View style={styles.categories}>
            <AppText variant="heading" accessibilityRole="header">
              {t('dashboard.categoriesTitle')}
            </AppText>
            {library.categories
              ? categoryOrder.map((kind) => (
                  <CategoryCard
                    key={kind}
                    summary={library.categories![kind]}
                    pending={pending && kind !== 'screenshots' && kind !== 'videos'}
                    onPress={() => router.push({ pathname: '/category/[kind]', params: { kind } })}
                  />
                ))
              : null}
          </View>

          {library.analysis.cloudOnly > 0 ? (
            <View style={styles.note}>
              <Icon name="cloud-outline" size={18} color="textSecondary" />
              <AppText variant="caption" tone="secondary" style={styles.flex}>
                {t('dashboard.cloudOnly', { count: library.analysis.cloudOnly })}
              </AppText>
            </View>
          ) : null}

          {__DEV__ ? (
            <Button
              label={t('benchmark.title')}
              variant="ghost"
              icon="speedometer-outline"
              onPress={() => router.push('/benchmark')}
            />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SummaryItem({
  icon,
  value,
  label,
}: {
  icon: 'image-outline' | 'videocam-outline' | 'server-outline';
  value: string;
  label: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.summaryItem} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={18} color="primary" />
      <AppText variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.sm,
    minHeight: 56,
  },
  topActions: {
    flexDirection: 'row',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  heroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  summary: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  summaryItem: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 2,
  },
  categories: {
    gap: theme.spacing.sm,
  },
  note: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  flex: {
    flex: 1,
  },
}));
