import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import type { MediaItem } from '@/db/media-item';
import { createStyles } from '@/theme/theme-provider';
import { useFormat } from '@/utils/use-format';

import { AppText } from './app-text';
import { Icon } from './icon';
import { useLocalVideo } from './use-local-video';
import { VideoStatusOverlay } from './video-status-overlay';
import { ZoomableImage } from './zoomable-image';

const FADE_MS = 180;

export interface ViewerSelection {
  isSelected: (id: string) => boolean;
  toggle: (item: MediaItem) => void;
}

interface MediaViewerProps {
  items: readonly MediaItem[];
  initialIndex: number;
  onClose: () => void;
  selection?: ViewerSelection;
}

export function MediaViewer({ items, initialIndex, onClose, selection }: MediaViewerProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const format = useFormat();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)),
  );
  const [zoomed, setZoomed] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const current = items[index];
  const opacity = useSharedValue(0);
  const closing = useRef(false);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    opacity.set(withTiming(1, { duration: FADE_MS }));
  }, [opacity]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    opacity.set(
      withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) scheduleOnRN(onClose);
      }),
    );
  }, [onClose, opacity]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(Math.min(Math.max(next, 0), items.length - 1));
      setZoomed(false);
    },
    [items.length, width],
  );

  const toggleChrome = useCallback(() => setChromeVisible((visible) => !visible), []);

  const renderItem = useCallback<ListRenderItem<MediaItem>>(
    ({ item, index: itemIndex }) =>
      item.mediaType === 'video' ? (
        <VideoPage item={item} active={itemIndex === index} width={width} height={height} />
      ) : (
        <ZoomableImage
          item={item}
          zoomed={zoomed && itemIndex === index}
          onZoomChange={setZoomed}
          onTap={toggleChrome}
          onDismiss={close}
        />
      ),
    [close, height, index, toggleChrome, width, zoomed],
  );

  const selected = current && selection ? selection.isSelected(current.id) : false;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait']}
    >
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[styles.root, fadeStyle]}>
          <StatusBar style="light" hidden={!chromeVisible} />
          <FlatList
            data={items}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            extraData={[index, zoomed]}
            initialScrollIndex={index}
            getItemLayout={(_, itemIndex) => ({
              length: width,
              offset: width * itemIndex,
              index: itemIndex,
            })}
            onMomentumScrollEnd={onMomentumEnd}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
          />
          {chromeVisible && current ? (
            <>
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                style={[styles.top, { paddingTop: insets.top + 8 }]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  hitSlop={8}
                  onPress={close}
                  style={styles.round}
                >
                  <Icon name="close" size={22} color="onMedia" />
                </Pressable>
                <View style={styles.titles}>
                  <AppText variant="label" tone="onMedia" numberOfLines={1}>
                    {format.date(current.createdAt)}
                  </AppText>
                  <AppText variant="caption" tone="onMedia" numberOfLines={1}>
                    {t('viewer.position', { current: index + 1, total: items.length })} ·{' '}
                    {format.bytes(current.fileSize)}
                  </AppText>
                </View>
                <View style={styles.spacer} />
              </Animated.View>
              {selection ? (
                <Animated.View
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(150)}
                  style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={t('viewer.select')}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      selection.toggle(current);
                    }}
                    style={[styles.selectButton, selected && styles.selectButtonActive]}
                  >
                    <Icon
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? 'onDanger' : 'onMedia'}
                    />
                    <AppText variant="label" tone={selected ? 'onDanger' : 'onMedia'}>
                      {selected ? t('viewer.selected') : t('viewer.select')}
                    </AppText>
                  </Pressable>
                </Animated.View>
              ) : null}
            </>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

interface VideoPageProps {
  item: MediaItem;
  active: boolean;
  width: number;
  height: number;
}

function VideoPage({ item, active, width, height }: VideoPageProps) {
  const styles = useStyles();
  return (
    <View style={{ width, height }}>
      <Image
        source={{ uri: item.uri }}
        style={styles.fill}
        contentFit="contain"
        recyclingKey={item.id}
        cachePolicy="memory"
      />
      {active ? <ActiveVideo item={item} /> : null}
    </View>
  );
}

function ActiveVideo({ item }: { item: MediaItem }) {
  const styles = useStyles();
  const { player, status, progress, frameShown, onFirstFrame, download, cancelDownload } =
    useLocalVideo(item.id, {
      muted: false,
      loop: false,
      autoplay: true,
    });

  if (status === 'loading') return null;
  if (status !== 'ready') {
    return (
      <VideoStatusOverlay
        status={status}
        progress={progress}
        fileSize={item.fileSize}
        onDownload={download}
        onCancel={cancelDownload}
      />
    );
  }
  return (
    <View style={[styles.overlay, !frameShown && styles.hidden]}>
      <VideoView
        player={player}
        style={styles.fill}
        contentFit="contain"
        nativeControls
        allowsPictureInPicture={false}
        onFirstFrameRender={onFirstFrame}
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.mediaBackground,
  },
  fill: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hidden: {
    opacity: 0,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.mediaScrim,
  },
  titles: {
    flex: 1,
    alignItems: 'center',
  },
  spacer: {
    width: 40,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: theme.spacing.md,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 48,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.mediaScrim,
  },
  selectButtonActive: {
    backgroundColor: theme.colors.danger,
  },
}));
