import { VideoView } from 'expo-video';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/icon';
import { useLocalVideo } from '@/components/use-local-video';
import { VideoStatusOverlay } from '@/components/video-status-overlay';
import type { MediaItem } from '@/db/media-item';
import { createStyles } from '@/theme/theme-provider';

interface SwipeVideoProps {
  item: MediaItem;
  muted: boolean;
  onToggleMuted: () => void;
}

export function SwipeVideo({ item, muted, onToggleMuted }: SwipeVideoProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { player, status, progress, frameShown, onFirstFrame, download, cancelDownload } =
    useLocalVideo(item.id, {
      muted,
      loop: true,
      autoplay: true,
    });

  if (status !== 'ready' && status !== 'loading') {
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
    <>
      {status === 'ready' ? (
        <View style={[styles.video, !frameShown && styles.hidden]} pointerEvents="none">
          <VideoView
            player={player}
            style={styles.fill}
            contentFit="contain"
            nativeControls={false}
            allowsPictureInPicture={false}
            onFirstFrameRender={onFirstFrame}
          />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? t('swipe.unmute') : t('swipe.mute')}
        hitSlop={8}
        onPress={onToggleMuted}
        style={styles.mute}
      >
        <Icon name={muted ? 'volume-mute' : 'volume-high'} size={20} color="onMedia" />
      </Pressable>
    </>
  );
}

const useStyles = createStyles((theme) => ({
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fill: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
  },
  mute: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.mediaScrim,
  },
}));
