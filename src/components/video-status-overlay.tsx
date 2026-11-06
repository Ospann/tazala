import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createStyles } from '@/theme/theme-provider';
import { useFormat } from '@/utils/use-format';

import { AppText } from './app-text';
import { Icon } from './icon';
import type { LocalVideoStatus } from './use-local-video';

interface VideoStatusOverlayProps {
  status: LocalVideoStatus;
  progress: number;
  fileSize: number;
  onDownload: () => void;
  onCancel: () => void;
}

export function VideoStatusOverlay({
  status,
  progress,
  fileSize,
  onDownload,
  onCancel,
}: VideoStatusOverlayProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const format = useFormat();

  if (status === 'cloud-only') {
    return (
      <View style={styles.center} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('video.download', { size: format.bytes(fileSize) })}
          accessibilityHint={t('video.downloadHint')}
          onPress={onDownload}
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        >
          <Icon name="cloud-download-outline" size={20} color="onMedia" />
          <AppText variant="label" tone="onMedia">
            {t('video.download', { size: format.bytes(fileSize) })}
          </AppText>
        </Pressable>
      </View>
    );
  }

  if (status === 'downloading') {
    const percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
    return (
      <View style={styles.center} pointerEvents="box-none">
        <View
          style={styles.pill}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('video.downloading', { percent })}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <Icon name="cloud-download-outline" size={20} color="onMedia" />
          <AppText variant="label" tone="onMedia">
            {t('video.downloading', { percent })}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('video.cancel')}
            hitSlop={10}
            onPress={onCancel}
          >
            <Icon name="close-circle" size={20} color="onMedia" />
          </Pressable>
        </View>
        <View style={styles.track}>
          <View style={[styles.bar, { width: `${percent}%` }]} />
        </View>
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.center} pointerEvents="none">
        <View style={styles.pill}>
          <Icon name="alert-circle-outline" size={20} color="onMedia" />
          <AppText variant="label" tone="onMedia">
            {t('video.failed')}
          </AppText>
        </View>
      </View>
    );
  }

  return null;
}

const useStyles = createStyles((theme) => ({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 48,
    maxWidth: '100%',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.mediaScrim,
  },
  pressed: {
    opacity: 0.8,
  },
  track: {
    width: 180,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: theme.colors.mediaScrim,
  },
  bar: {
    height: '100%',
    backgroundColor: theme.colors.onMedia,
  },
}));
