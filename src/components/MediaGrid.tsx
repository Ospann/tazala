import { FlashList } from '@shopify/flash-list';
import { useCallback, type ReactElement } from 'react';
import { useWindowDimensions, View } from 'react-native';

import type { MediaItem } from '@/db/mediaItem';
import { createStyles, useTheme } from '@/theme/ThemeProvider';

import { Thumbnail } from './Thumbnail';

interface MediaGridProps {
  items: readonly MediaItem[];
  isSelected: (id: string) => boolean;
  onToggle?: (item: MediaItem) => void;
  labelFor: (item: MediaItem) => string;
  captionFor?: (item: MediaItem) => string | undefined;
  header?: ReactElement;
  columns?: number;
}

export function MediaGrid({
  items,
  isSelected,
  onToggle,
  labelFor,
  captionFor,
  header,
  columns = 3,
}: MediaGridProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const gap = theme.spacing.xs;
  const size = Math.floor((width - theme.spacing.lg * 2 - gap * (columns - 1)) / columns);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <View style={styles.cell}>
        <Thumbnail
          item={item}
          size={size}
          selected={isSelected(item.id)}
          caption={captionFor?.(item)}
          accessibilityLabel={labelFor(item)}
          onPress={onToggle}
        />
      </View>
    ),
    [captionFor, isSelected, labelFor, onToggle, size, styles.cell],
  );

  return (
    <FlashList
      data={items}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      extraData={isSelected}
    />
  );
}

const useStyles = createStyles((theme) => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xs / 2,
  },
}));
