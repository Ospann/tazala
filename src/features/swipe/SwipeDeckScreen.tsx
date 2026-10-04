import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SWIPE_PREFETCH_COUNT } from '@/config';
import { getDatabase } from '@/db/database';
import type { MediaItem } from '@/db/mediaItem';
import {
  getSwipeQueue,
  recordDecision,
  undoDecision,
  type SwipeDecision,
} from '@/db/swipeRepository';
import { useLibraryStore } from '@/stores/libraryStore';
import { createStyles, useTheme } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

import { SwipeCard, type SwipeCardHandle, type SwipeDirection } from './SwipeCard';

interface HistoryEntry {
  item: MediaItem;
  decision: SwipeDecision;
}

export function SwipeDeckScreen({ month }: { month: string }) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation();
  const format = useFormat();
  const [queue, setQueue] = useState<MediaItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [trashedBytes, setTrashedBytes] = useState(0);
  const cardRef = useRef<SwipeCardHandle>(null);

  useEffect(() => {
    let active = true;
    void getDatabase()
      .then((db) => getSwipeQueue(db, month))
      .then((items) => {
        if (active) setQueue(items);
      });
    return () => {
      active = false;
    };
  }, [month]);

  useEffect(() => {
    if (!queue) return;
    const upcoming = queue
      .slice(index + 1, index + 1 + SWIPE_PREFETCH_COUNT)
      .map((item) => item.uri);
    if (upcoming.length > 0) {
      void Image.prefetch(upcoming, 'memory').catch(() => false);
    }
  }, [queue, index]);

  useEffect(
    () => () => {
      void useLibraryStore.getState().refresh();
    },
    [],
  );

  const onSwiped = useCallback(async (item: MediaItem, direction: SwipeDirection) => {
    const decision: SwipeDecision = direction === 'left' ? 'trash' : 'keep';
    void Haptics.impactAsync(
      decision === 'trash' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    setIndex((current) => current + 1);
    setHistory((current) => [...current.slice(-49), { item, decision }]);
    if (decision === 'trash') setTrashedBytes((bytes) => bytes + item.fileSize);
    const db = await getDatabase();
    await recordDecision(db, item.id, decision, Date.now());
  }, []);

  const undo = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    void Haptics.selectionAsync();
    setHistory((current) => current.slice(0, -1));
    setIndex((current) => Math.max(current - 1, 0));
    if (last.decision === 'trash')
      setTrashedBytes((bytes) => Math.max(bytes - last.item.fileSize, 0));
    const db = await getDatabase();
    await undoDecision(db, last.item.id);
  };

  const title = month === 'random' ? t('swipe.random') : format.month(month);

  if (!queue) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title={title} />
        <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
      </Screen>
    );
  }

  const current = queue[index];
  const next = queue[index + 1];
  const trashedCount = history.filter((entry) => entry.decision === 'trash').length;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={title}
        subtitle={
          queue.length > 0
            ? t('swipe.position', {
                current: Math.min(index + 1, queue.length),
                total: queue.length,
              })
            : undefined
        }
        right={
          <IconButton
            icon="arrow-undo"
            label={t('swipe.undo')}
            onPress={() => void undo()}
            disabled={history.length === 0}
          />
        }
      />
      {queue.length > 0 ? (
        <View style={styles.progress}>
          <ProgressBar
            progress={index / queue.length}
            accessibilityLabel={t('swipe.position', { current: index, total: queue.length })}
          />
        </View>
      ) : null}

      {queue.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={t('swipe.allDoneTitle')}
          message={t('swipe.allDoneBody')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
        />
      ) : !current ? (
        <View style={styles.finished}>
          <EmptyState
            icon="sparkles-outline"
            title={t('swipe.finishedTitle')}
            message={t('swipe.finishedBody', {
              count: trashedCount,
              size: format.bytes(trashedBytes),
            })}
          />
          <View style={styles.finishedActions}>
            {trashedCount > 0 ? (
              <Button
                label={t('trash.open')}
                icon="trash-outline"
                onPress={() => router.replace('/trash')}
              />
            ) : null}
            <Button
              label={t('swipe.otherMonths')}
              variant="secondary"
              onPress={() => router.back()}
            />
            <Button
              label={t('swipe.undo')}
              variant="ghost"
              onPress={() => void undo()}
              disabled={history.length === 0}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.deck}>
            {next ? (
              <View style={styles.nextCard} pointerEvents="none">
                <Image
                  source={{ uri: next.uri }}
                  style={styles.nextImage}
                  contentFit="contain"
                  cachePolicy="memory"
                />
              </View>
            ) : null}
            <SwipeCard
              key={current.id}
              ref={cardRef}
              item={current}
              active
              onSwiped={(item, direction) => void onSwiped(item, direction)}
            />
          </View>
          <View style={styles.actions}>
            <Button
              label={t('swipe.toTrash')}
              icon="trash-outline"
              variant="danger"
              onPress={() => cardRef.current?.swipe('left')}
              style={styles.action}
              accessibilityHint={t('swipe.trashHint')}
            />
            <Button
              label={t('swipe.keep')}
              icon="heart-outline"
              onPress={() => cardRef.current?.swipe('right')}
              style={styles.action}
              accessibilityHint={t('swipe.keepHint')}
            />
          </View>
          <AppText variant="caption" tone="secondary" align="center" style={styles.hint}>
            {t('swipe.gestureHint')}
          </AppText>
        </>
      )}
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  loader: {
    marginTop: theme.spacing.xxxl,
  },
  progress: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  deck: {
    flex: 1,
    marginHorizontal: theme.spacing.lg,
  },
  nextCard: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: -theme.spacing.sm,
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
    opacity: 0.6,
  },
  nextImage: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  action: {
    flex: 1,
  },
  hint: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  finished: {
    flex: 1,
  },
  finishedActions: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
}));
