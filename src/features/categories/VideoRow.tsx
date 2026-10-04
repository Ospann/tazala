import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Thumbnail } from '@/components/Thumbnail';
import type { MediaItem } from '@/db/mediaItem';
import { createStyles } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

interface VideoRowProps {
  item: MediaItem;
  selected: boolean;
  accessibilityLabel: string;
  onToggle: (item: MediaItem) => void;
}

function VideoRowComponent({ item, selected, accessibilityLabel, onToggle }: VideoRowProps) {
  const styles = useStyles();
  const format = useFormat();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onToggle(item)}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.pressed,
      ]}
    >
      <Thumbnail item={item} size={72} accessibilityLabel="" />
      <View style={styles.text}>
        <AppText variant="bodyStrong">{format.bytes(item.fileSize)}</AppText>
        <AppText variant="caption" tone="secondary">
          {format.duration(item.duration ?? 0)} · {format.date(item.createdAt)}
        </AppText>
      </View>
      <View style={[styles.check, selected && styles.checkSelected]}>
        {selected ? <Icon name="checkmark" size={16} color="onDanger" /> : null}
      </View>
    </Pressable>
  );
}

export const VideoRow = memo(VideoRowComponent);

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowSelected: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerSoft,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  checkSelected: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.danger,
  },
}));
