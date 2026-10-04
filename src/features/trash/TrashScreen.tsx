import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { MediaGrid } from '@/components/MediaGrid';
import { Screen } from '@/components/Screen';
import { useSelection } from '@/components/useSelection';
import { getDatabase } from '@/db/database';
import type { MediaItem } from '@/db/mediaItem';
import { getTrashItems, restoreFromTrash } from '@/db/trashRepository';
import { useLibraryStore } from '@/stores/libraryStore';
import { createStyles, useTheme } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

import { Celebration } from './Celebration';
import { deleteFromLibrary, type DeleteOutcome } from './deleteService';

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

  const ids = useMemo(() => (items ?? []).map((item) => item.id), [items]);
  const selection = useSelection(ids);
  const totalBytes = useMemo(
    () => (items ?? []).reduce((sum, item) => sum + item.fileSize, 0),
    [items],
  );

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
    selection.clear();
    setNotice(t('trash.restored', { count: selected.length }));
    await useLibraryStore.getState().refresh();
  };

  const performDelete = async () => {
    setDeleting(true);
    setNotice(null);
    try {
      const result = await deleteFromLibrary(ids);
      selection.clear();
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
    Alert.alert(
      t('trash.confirmTitle', { count: ids.length }),
      t(Platform.OS === 'ios' ? 'trash.confirmBodyIos' : 'trash.confirmBodyAndroid', {
        size: format.bytes(totalBytes),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trash.confirmAction'),
          style: 'destructive',
          onPress: () => void performDelete(),
        },
      ],
    );
  };

  const labelFor = useCallback(
    (item: MediaItem) =>
      t('category.itemA11y', {
        date: format.date(item.createdAt),
        size: format.bytes(item.fileSize),
        state: selection.isSelected(item.id)
          ? t('trash.selectedForRestore')
          : t('groups.notSelected'),
      }),
    [format, selection, t],
  );

  const footer =
    items && items.length > 0 ? (
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
          label={t('trash.deleteAll', { count: items.length, size: format.bytes(totalBytes) })}
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
        <MediaGrid
          items={items}
          isSelected={selection.isSelected}
          onToggle={onToggle}
          labelFor={labelFor}
          header={
            <AppText variant="caption" tone="secondary" style={styles.description}>
              {t('trash.description')}
            </AppText>
          }
        />
      )}
      {outcome ? (
        <Celebration
          freedBytes={outcome.freedBytes}
          deletedCount={outcome.deletedCount}
          showIosHint={Platform.OS === 'ios'}
          onClose={() => setOutcome(null)}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  loader: {
    marginTop: theme.spacing.xxxl,
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
