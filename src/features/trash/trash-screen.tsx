import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Header } from '@/components/header';
import { MediaGrid } from '@/components/media-grid';
import { MediaViewer, type ViewerSelection } from '@/components/media-viewer';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useMediaFilterSegments } from '@/components/use-media-filter-segments';
import { useSelection } from '@/components/use-selection';
import { useSelectionMode } from '@/components/use-selection-mode';
import { getDatabase } from '@/db/database';
import { matchesMediaFilter, type MediaFilter, type MediaItem } from '@/db/media-item';
import { getTrashItems, restoreFromTrash } from '@/db/trash-repository';
import { useLibraryStore } from '@/stores/library-store';
import { createStyles, useTheme } from '@/theme/theme-provider';
import { useFormat } from '@/utils/use-format';

import { Celebration } from './celebration';
import { deleteFromLibrary, type DeleteOutcome } from './delete-service';

export function TrashScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const format = useFormat();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [outcome, setOutcome] = useState<DeleteOutcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const segments = useMediaFilterSegments();
  const revision = useLibraryStore((state) => state.revision);

  useEffect(() => {
    let active = true;
    void getDatabase()
      .then(getTrashItems)
      .then((result) => {
        if (active) setItems(result);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  const visibleItems = useMemo(
    () => (items ?? []).filter((item) => matchesMediaFilter(item, filter)),
    [filter, items],
  );
  const ids = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const selection = useSelection(ids);
  const { clear: clearSelection, toggle: toggleSelection } = selection;
  const mode = useSelectionMode(clearSelection);
  const { enter: enterSelectionMode } = mode;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const openItem = useCallback(
    (item: MediaItem) => setViewerIndex(visibleItems.indexOf(item)),
    [visibleItems],
  );
  const viewerSelection = useMemo<ViewerSelection>(
    () => ({
      isSelected: selection.isSelected,
      toggle: (item) => {
        enterSelectionMode();
        toggleSelection(item.id);
      },
    }),
    [enterSelectionMode, selection.isSelected, toggleSelection],
  );
  const totalBytes = useMemo(
    () => (items ?? []).reduce((sum, item) => sum + item.fileSize, 0),
    [items],
  );
  const visibleBytes = useMemo(
    () => visibleItems.reduce((sum, item) => sum + item.fileSize, 0),
    [visibleItems],
  );
  const selectedBytes = useMemo(
    () =>
      visibleItems.reduce(
        (sum, item) => (selection.selected.has(item.id) ? sum + item.fileSize : sum),
        0,
      ),
    [visibleItems, selection.selected],
  );
  const hasSelection = selection.count > 0;
  const deleteCount = hasSelection ? selection.count : ids.length;
  const deleteBytes = hasSelection ? selectedBytes : visibleBytes;

  const changeFilter = (value: MediaFilter) => {
    mode.exit();
    setFilter(value);
  };

  const onToggle = useCallback(
    (item: MediaItem) => {
      void Haptics.selectionAsync();
      selection.toggle(item.id);
    },
    [selection],
  );

  const restoreSelected = async () => {
    const selected = [...selection.selected];
    if (selected.length === 0) return;
    const db = await getDatabase();
    await restoreFromTrash(db, selected);
    mode.exit();
    setNotice(t('trash.restored', { count: selected.length }));
    await useLibraryStore.getState().refresh();
  };

  const performDelete = async (targetIds: readonly string[]) => {
    setDeleting(true);
    setNotice(null);
    try {
      const result = await deleteFromLibrary(targetIds);
      mode.exit();
      if (result.deletedCount > 0) {
        setOutcome(result);
      }
      if (result.cancelled && result.deletedCount === 0) {
        setNotice(t('trash.cancelled'));
      } else if (result.failedCount > 0) {
        setNotice(t('trash.partial', { count: result.failedCount }));
      }
    } catch (error) {
      setNotice(t('trash.failed'));
      if (__DEV__) console.warn(error);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    const targetIds = hasSelection ? [...selection.selected] : ids;
    Alert.alert(
      t('trash.confirmTitle', { count: targetIds.length }),
      t(Platform.OS === 'ios' ? 'trash.confirmBodyIos' : 'trash.confirmBodyAndroid', {
        size: format.bytes(deleteBytes),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trash.confirmAction'),
          style: 'destructive',
          onPress: () => void performDelete(targetIds),
        },
      ],
    );
  };

  const labelFor = useCallback(
    (item: MediaItem) =>
      t('category.itemA11y', {
        date: format.date(item.createdAt),
        size: format.bytes(item.fileSize),
        state: selection.isSelected(item.id) ? t('trash.selectedItem') : t('groups.notSelected'),
      }),
    [format, selection, t],
  );

  const footer =
    visibleItems.length > 0 ? (
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}>
        {selection.count > 0 ? (
          <Button
            label={t('trash.restore', { count: selection.count })}
            icon="arrow-undo-outline"
            variant="secondary"
            onPress={() => void restoreSelected()}
          />
        ) : null}
        <Button
          label={t('trash.deleteAll', { count: deleteCount, size: format.bytes(deleteBytes) })}
          icon="trash"
          variant="danger"
          size="large"
          loading={deleting}
          onPress={confirmDelete}
        />
      </View>
    ) : null;

  return (
    <Screen edges={['top']} footer={footer}>
      <Header
        title={t('trash.title')}
        subtitle={items && items.length > 0 ? format.bytes(totalBytes) : undefined}
        right={
          items && items.length > 0 ? (
            <Button
              label={mode.active ? t('common.done') : t('common.select')}
              variant="ghost"
              onPress={mode.active ? mode.exit : enterSelectionMode}
            />
          ) : undefined
        }
      />
      {notice ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <AppText variant="label">{notice}</AppText>
        </View>
      ) : null}
      {items === null ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="trash-outline"
          title={t('trash.emptyTitle')}
          message={t('trash.emptyBody')}
        />
      ) : (
        <>
          <View style={styles.filter}>
            <SegmentedControl
              segments={segments}
              value={filter}
              onChange={changeFilter}
              accessibilityLabel={t('mediaFilter.a11y')}
            />
          </View>
          {visibleItems.length === 0 ? (
            <EmptyState
              icon="funnel-outline"
              title={t('mediaFilter.emptyTitle')}
              message={t('mediaFilter.emptyBody')}
            />
          ) : (
            <MediaGrid
              items={visibleItems}
              selection={selection}
              selectionMode={mode.active}
              onSelectionModeStart={enterSelectionMode}
              onToggle={onToggle}
              onOpen={openItem}
              labelFor={labelFor}
              header={
                <AppText variant="caption" tone="secondary" style={styles.description}>
                  {t('trash.description')}
                </AppText>
              }
            />
          )}
        </>
      )}
      {outcome ? (
        <Celebration
          freedBytes={outcome.freedBytes}
          deletedCount={outcome.deletedCount}
          showIosHint={Platform.OS === 'ios'}
          onClose={() => setOutcome(null)}
        />
      ) : null}
      {viewerIndex !== null ? (
        <MediaViewer
          items={visibleItems}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          selection={viewerSelection}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  loader: {
    marginTop: theme.spacing.xxxl,
  },
  filter: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  description: {
    paddingBottom: theme.spacing.md,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  notice: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
  },
}));
