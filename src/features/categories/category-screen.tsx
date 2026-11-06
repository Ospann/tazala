import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { MediaGrid } from '@/components/media-grid';
import { MediaViewer, type ViewerSelection } from '@/components/media-viewer';
import { Screen } from '@/components/screen';
import { SelectionBar } from '@/components/selection-bar';
import { useSelection } from '@/components/use-selection';
import { useSelectionMode } from '@/components/use-selection-mode';
import type { CategoryKind, MediaGroup } from '@/db/categories-repository';
import { getDatabase } from '@/db/database';
import type { MediaItem } from '@/db/media-item';
import { addToTrash } from '@/db/trash-repository';
import { categoryIcons } from '@/features/dashboard/category-meta';
import { useLibraryStore } from '@/stores/library-store';
import { useScanStore } from '@/stores/scan-store';
import { createStyles, useTheme } from '@/theme/theme-provider';
import { useFormat } from '@/utils/use-format';

import { GroupCard } from './group-card';
import { useCategoryData } from './use-category-data';
import { VideoRow } from './video-row';

const kinds: readonly CategoryKind[] = ['similar', 'duplicates', 'screenshots', 'blurry', 'videos'];

export function isCategoryKind(value: unknown): value is CategoryKind {
  return typeof value === 'string' && (kinds as readonly string[]).includes(value);
}

export function CategoryScreen({ kind }: { kind: CategoryKind }) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation();
  const format = useFormat();
  const { data, error, reload } = useCategoryData(kind);
  const scanning = useScanStore((state) => state.phase !== 'idle');
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allItems = useMemo<MediaItem[]>(() => {
    if (!data) return [];
    return data.type === 'groups' ? data.groups.flatMap((group) => group.items) : data.items;
  }, [data]);
  const allIds = useMemo(() => allItems.map((item) => item.id), [allItems]);
  const suggestedIds = useMemo(() => {
    if (data?.type !== 'groups') return allIds;
    return data.groups.flatMap((group) =>
      group.items.filter((item) => item.id !== group.bestAssetId).map((item) => item.id),
    );
  }, [allIds, data]);

  const selection = useSelection(allIds);
  const { set: setSelection, clear: clearSelection, toggle: toggleSelection } = selection;
  const isGroups = data?.type === 'groups';
  const mode = useSelectionMode(clearSelection);
  const { enter: enterSelectionMode } = mode;
  const [viewer, setViewer] = useState<{ items: readonly MediaItem[]; index: number } | null>(null);

  const openItem = useCallback(
    (item: MediaItem) => setViewer({ items: allItems, index: allItems.indexOf(item) }),
    [allItems],
  );
  const openInGroup = useCallback(
    (group: MediaGroup, item: MediaItem) =>
      setViewer({ items: group.items, index: group.items.indexOf(item) }),
    [],
  );
  const viewerSelection = useMemo<ViewerSelection>(
    () => ({
      isSelected: selection.isSelected,
      toggle: (item) => {
        if (!isGroups) enterSelectionMode();
        toggleSelection(item.id);
      },
    }),
    [enterSelectionMode, isGroups, selection.isSelected, toggleSelection],
  );

  useEffect(() => {
    if (data?.type === 'groups') {
      setSelection(suggestedIds);
    } else {
      setSelection([]);
    }
  }, [data, suggestedIds, setSelection]);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const sizeById = useMemo(
    () => new Map(allItems.map((item) => [item.id, item.fileSize])),
    [allItems],
  );
  const selectedBytes = useMemo(() => {
    let total = 0;
    selection.selected.forEach((id) => {
      total += sizeById.get(id) ?? 0;
    });
    return total;
  }, [selection.selected, sizeById]);

  const onToggle = useCallback(
    (item: MediaItem) => {
      void Haptics.selectionAsync();
      selection.toggle(item.id);
    },
    [selection],
  );

  const moveToTrash = async () => {
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    setMoving(true);
    try {
      const db = await getDatabase();
      await addToTrash(db, ids, kind, Date.now());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice(t('category.moved', { count: ids.length }));
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 8000);
      if (!isGroups) mode.exit();
      await useLibraryStore.getState().refresh();
    } finally {
      setMoving(false);
    }
  };

  const title = t(`categories.${kind}.title`);
  const subtitle =
    data?.type === 'groups'
      ? t('category.groupsSubtitle', {
          count: data.groups.length,
          formatted: format.number(data.groups.length),
        })
      : data
        ? t('category.itemsSubtitle', {
            count: data.items.length,
            formatted: format.number(data.items.length),
          })
        : undefined;

  const labelFor = useCallback(
    (item: MediaItem) =>
      t('category.itemA11y', {
        date: format.date(item.createdAt),
        size: format.bytes(item.fileSize),
        state: selection.isSelected(item.id) ? t('groups.markedForTrash') : t('groups.notSelected'),
      }),
    [format, selection, t],
  );

  const description = (
    <AppText variant="caption" tone="secondary" style={styles.description}>
      {t(`categories.${kind}.description`)}
    </AppText>
  );

  let content: ReactNode;
  if (error) {
    content = (
      <EmptyState
        icon="alert-circle-outline"
        title={t('common.errorTitle')}
        message={t('common.errorBody')}
        actionLabel={t('common.retry')}
        onAction={reload}
      />
    );
  } else if (!data) {
    content = <ActivityIndicator style={styles.loader} color={theme.colors.primary} />;
  } else if (allItems.length === 0) {
    content = (
      <EmptyState
        icon={scanning ? 'hourglass-outline' : categoryIcons[kind]}
        title={scanning ? t('category.scanningTitle') : t('category.emptyTitle')}
        message={scanning ? t('category.scanningBody') : t(`categories.${kind}.empty`)}
      />
    );
  } else if (data.type === 'groups') {
    content = (
      <FlashList<MediaGroup>
        data={data.groups}
        keyExtractor={(group) => `${group.groupId}`}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            selected={selection.selected}
            onToggle={onToggle}
            onOpen={openInGroup}
          />
        )}
        extraData={selection.selected}
        ListHeaderComponent={description}
        contentContainerStyle={styles.listContent}
      />
    );
  } else if (kind === 'videos') {
    content = (
      <FlashList<MediaItem>
        data={data.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VideoRow
            item={item}
            selected={selection.isSelected(item.id)}
            selectionMode={mode.active}
            accessibilityLabel={labelFor(item)}
            onToggle={onToggle}
            onOpen={openItem}
            onSelectionModeStart={enterSelectionMode}
          />
        )}
        extraData={[selection.selected, mode.active]}
        ListHeaderComponent={description}
        contentContainerStyle={styles.listContent}
      />
    );
  } else {
    content = (
      <MediaGrid
        items={data.items}
        selection={selection}
        selectionMode={mode.active}
        onSelectionModeStart={enterSelectionMode}
        onToggle={onToggle}
        onOpen={openItem}
        labelFor={labelFor}
        header={description}
      />
    );
  }

  return (
    <Screen
      edges={['top']}
      footer={
        allItems.length > 0 ? (
          <SelectionBar
            count={selection.count}
            total={suggestedIds.length}
            bytes={selectedBytes}
            busy={moving}
            onSelectAll={() => {
              if (!isGroups) enterSelectionMode();
              setSelection(suggestedIds);
            }}
            onClear={selection.clear}
            onConfirm={() => void moveToTrash()}
          />
        ) : null
      }
    >
      <Header
        title={title}
        subtitle={subtitle}
        right={
          !isGroups && allItems.length > 0 ? (
            <Button
              label={mode.active ? t('common.done') : t('common.select')}
              variant="ghost"
              onPress={mode.active ? mode.exit : enterSelectionMode}
            />
          ) : undefined
        }
      />
      {notice ? (
        <Animated.View
          entering={FadeInDown.springify().damping(14)}
          exiting={FadeOutUp}
          style={styles.notice}
          accessibilityLiveRegion="polite"
        >
          <AppText variant="label" style={styles.flex}>
            {notice}
          </AppText>
          <Button
            label={t('trash.open')}
            variant="ghost"
            onPress={() => router.push('/trash')}
            style={styles.noticeButton}
          />
        </Animated.View>
      ) : null}
      <View style={styles.flex}>{content}</View>
      {viewer ? (
        <MediaViewer
          items={viewer.items}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
          selection={viewerSelection}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: theme.spacing.xxxl,
  },
  description: {
    paddingBottom: theme.spacing.md,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
  },
  noticeButton: {
    paddingHorizontal: theme.spacing.md,
  },
}));
