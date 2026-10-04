import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { getDatabase } from '@/db/database';
import { getSwipeMonths, type SwipeMonth } from '@/db/swipeRepository';
import { createStyles, useTheme } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

function open(month: string) {
  router.push({ pathname: '/swipe/[month]', params: { month } });
}

export function SwipeMonthsScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation();
  const format = useFormat();
  const [months, setMonths] = useState<SwipeMonth[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getDatabase()
        .then(getSwipeMonths)
        .then((result) => {
          if (active) setMonths(result);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const header = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('swipe.random')}
      onPress={() => open('random')}
      style={({ pressed }) => [styles.random, pressed && styles.pressed]}
    >
      <Icon name="shuffle" color="onPrimary" />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" tone="onPrimary">
          {t('swipe.random')}
        </AppText>
        <AppText variant="caption" tone="onPrimary">
          {t('swipe.randomHint')}
        </AppText>
      </View>
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <Header title={t('swipe.title')} subtitle={t('swipe.chooseMonth')} />
      {months === null ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
      ) : months.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title={t('swipe.emptyTitle')}
          message={t('swipe.emptyBody')}
        />
      ) : (
        <FlashList
          data={months}
          keyExtractor={(item) => item.month}
          ListHeaderComponent={header}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => {
            const done = item.reviewed >= item.total;
            const label = t('swipe.monthLabel', {
              month: format.month(item.month),
              count: item.total,
              formatted: format.number(item.total),
            });
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label}. ${done ? t('swipe.monthDone') : t('swipe.monthProgress', { reviewed: item.reviewed, total: item.total })}`}
                onPress={() => open(item.month)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{label}</AppText>
                  <ProgressBar progress={item.total > 0 ? item.reviewed / item.total : 0} />
                </View>
                {done ? (
                  <Icon name="checkmark-circle" color="primary" />
                ) : (
                  <Icon name="chevron-forward" size={18} color="textTertiary" />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  flex: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  loader: {
    marginTop: theme.spacing.xxxl,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  random: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primary,
    marginBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
}));
