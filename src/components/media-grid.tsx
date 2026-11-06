import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { MediaItem } from '@/db/media-item';
import { createStyles, useTheme } from '@/theme/theme-provider';

import { Thumbnail } from './thumbnail';
import { useDragSelect } from './use-drag-select';
import type { Selection } from './use-selection';

interface MediaGridProps {
  items: readonly MediaItem[];
  selection: Selection;
  selectionMode: boolean;
  onSelectionModeStart: () => void;
  onToggle: (item: MediaItem) => void;
  onOpen: (item: MediaItem) => void;
  labelFor: (item: MediaItem) => string;
  captionFor?: (item: MediaItem) => string | undefined;
  header?: ReactElement;
  columns?: number;
}

export function MediaGrid({
  items,
  selection,
  selectionMode,
  onSelectionModeStart,
  onToggle,
  onOpen,
  labelFor,
  captionFor,
  header,
  columns = 3,
}: MediaGridProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlashListRef<MediaItem>>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const gap = theme.spacing.xs;
  const size = Math.floor((width - theme.spacing.lg * 2 - gap * (columns - 1)) / columns);
  const { isSelected } = selection;

  const { gesture, dragging } = useDragSelect({
    listRef,
    items,
    selection,
    columns,
    cellSize: size,
    horizontalInset: theme.spacing.lg,
    viewportHeight,
    onBegin: onSelectionModeStart,
    enabled: true,
  });

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <View style={styles.cell}>
        <Thumbnail
          item={item}
          size={size}
          selected={isSelected(item.id)}
          caption={captionFor?.(item)}
          accessibilityLabel={labelFor(item)}
          selectable={selectionMode}
          onPress={selectionMode ? onToggle : onOpen}
        />
      </View>
    ),
    [captionFor, isSelected, labelFor, onOpen, onToggle, selectionMode, size, styles.cell],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.container}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        <FlashList
          ref={listRef}
          data={items}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={styles.content}
          extraData={[isSelected, selectionMode]}
          scrollEnabled={!dragging}
        />
      </View>
    </GestureDetector>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
  },
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
