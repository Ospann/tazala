import { Image } from 'expo-image';
import { memo, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import type { MediaItem } from '@/db/mediaItem';
import { createStyles } from '@/theme/ThemeProvider';
import { formatDuration } from '@/utils/format';

import { AppText } from './AppText';
import { Icon } from './Icon';

interface ThumbnailProps {
  item: MediaItem;
  size: number;
  selected?: boolean;
  badge?: string;
  caption?: string;
  accessibilityLabel: string;
  onPress?: (item: MediaItem) => void;
  onLongPress?: (item: MediaItem) => void;
}

function ThumbnailComponent({
  item,
  size,
  selected = false,
  badge,
  caption,
  accessibilityLabel,
  onPress,
  onLongPress,
}: ThumbnailProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef({ id: item.id, selected });

  useEffect(() => {
    const changed = previous.current.id === item.id && previous.current.selected !== selected;
    previous.current = { id: item.id, selected };
    if (!changed || reduceMotion) return;
    scale.set(
      withSequence(
        withTiming(0.9, { duration: 90 }),
        withSpring(1, { damping: 9, stiffness: 260 }),
      ),
    );
  }, [item.id, reduceMotion, scale, selected]);

  const bounceStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={bounceStyle}>
      <Pressable
        accessibilityRole={onPress ? 'checkbox' : 'image'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={onPress ? { checked: selected } : undefined}
        onPress={onPress ? () => onPress(item) : undefined}
        onLongPress={onLongPress ? () => onLongPress(item) : undefined}
        style={[styles.container, { width: size, height: size }]}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="cover"
          recyclingKey={item.id}
          cachePolicy="memory"
          transition={120}
        />
        {selected ? <View style={styles.selectedOverlay} /> : null}
        {onPress ? (
          <View style={[styles.check, selected && styles.checkSelected]}>
            {selected ? (
              <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}>
                <Icon name="checkmark" size={16} color="onDanger" />
              </Animated.View>
            ) : null}
          </View>
        ) : null}
        {badge ? (
          <View style={styles.badge}>
            <AppText variant="caption" tone="onPrimary" numberOfLines={1}>
              {badge}
            </AppText>
          </View>
        ) : null}
        {item.mediaType === 'video' && item.duration != null ? (
          <View style={styles.duration}>
            <Icon name="play" size={12} color="onPrimary" />
            <AppText variant="caption" tone="onPrimary">
              {formatDuration(item.duration)}
            </AppText>
          </View>
        ) : null}
        {caption ? (
          <View style={styles.caption}>
            <AppText variant="caption" tone="onPrimary" numberOfLines={1}>
              {caption}
            </AppText>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export const Thumbnail = memo(ThumbnailComponent);

const useStyles = createStyles((theme) => ({
  container: {
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    borderWidth: 3,
    borderColor: theme.colors.danger,
    borderRadius: theme.radii.sm,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
  },
  badge: {
    position: 'absolute',
    left: 6,
    top: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
    maxWidth: '75%',
  },
  duration: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  caption: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
}));
