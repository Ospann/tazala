import { memo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Thumbnail } from '@/components/Thumbnail';
import type { MediaGroup } from '@/db/categoriesRepository';
import type { MediaItem } from '@/db/mediaItem';
import { createStyles, useTheme } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

interface GroupCardProps {
  group: MediaGroup;
  selected: ReadonlySet<string>;
  onToggle: (item: MediaItem) => void;
}

function GroupCardComponent({ group, selected, onToggle }: GroupCardProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation();
  const format = useFormat();
  const { width } = useWindowDimensions();
  const columns = 3;
  const gap = theme.spacing.xs;
  const inner = width - theme.spacing.lg * 2 - theme.spacing.md * 2;
  const size = Math.floor((inner - gap * (columns - 1)) / columns);
  const selectedBytes = group.items.reduce(
    (sum, item) => (selected.has(item.id) ? sum + item.fileSize : sum),
    0,
  );
  const first = group.items[0];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="label">{first ? format.date(first.createdAt) : ''}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('groups.summary', { count: group.items.length, size: format.bytes(selectedBytes) })}
        </AppText>
      </View>
      <View style={[styles.grid, { gap }]}>
        {group.items.map((item, index) => {
          const isSelected = selected.has(item.id);
          const isBest = item.id === group.bestAssetId;
          const state = isSelected ? t('groups.markedForTrash') : t('groups.keep');
          return (
            <Thumbnail
              key={item.id}
              item={item}
              size={size}
              selected={isSelected}
              badge={isBest ? t('groups.best') : undefined}
              caption={format.bytes(item.fileSize)}
              accessibilityLabel={t('groups.itemA11y', {
                index: index + 1,
                total: group.items.length,
                state,
                best: isBest ? t('groups.best') : '',
              })}
              onPress={onToggle}
            />
          );
        })}
      </View>
    </View>
  );
}

export const GroupCard = memo(GroupCardComponent);

const useStyles = createStyles((theme) => ({
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
}));
