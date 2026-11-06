import { useEventListener } from 'expo';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import TazalaScanner, { type VideoSourceResult } from 'tazala-scanner';

export type LocalVideoStatus = 'loading' | 'ready' | 'cloud-only' | 'downloading' | 'failed';

interface LocalVideoOptions {
  muted: boolean;
  loop: boolean;
  autoplay: boolean;
}

interface LocalVideo {
  player: VideoPlayer;
  status: LocalVideoStatus;
  progress: number;
  download: () => void;
  cancelDownload: () => void;
}

function applyMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

export function useLocalVideo(
  assetId: string,
  { muted, loop, autoplay }: LocalVideoOptions,
): LocalVideo {
  const [state, setState] = useState<{ id: string; status: LocalVideoStatus; progress: number }>({
    id: assetId,
    status: 'loading',
    progress: 0,
  });
  const alive = useRef(true);
  const downloading = useRef(false);
  const player = useVideoPlayer(null, (created) => {
    created.loop = loop;
    created.muted = muted;
    created.audioMixingMode = 'mixWithOthers';
  });

  const apply = useCallback(
    async (source: VideoSourceResult, fallback: LocalVideoStatus) => {
      if (!alive.current) return;
      if (!source.uri) {
        setState({
          id: assetId,
          status: source.status === 'cloud-only' ? 'cloud-only' : fallback,
          progress: 0,
        });
        return;
      }
      await player.replaceAsync({ uri: source.uri });
      if (!alive.current) return;
      if (autoplay) player.play();
      setState({ id: assetId, status: 'ready', progress: 1 });
    },
    [assetId, autoplay, player],
  );

  useEffect(() => {
    alive.current = true;
    TazalaScanner.resolveVideoSource(assetId)
      .then((source) => apply(source, 'failed'))
      .catch((error: unknown) => {
        if (__DEV__) console.warn(error);
        if (alive.current) setState({ id: assetId, status: 'failed', progress: 0 });
      });
    return () => {
      alive.current = false;
      if (downloading.current) {
        downloading.current = false;
        TazalaScanner.cancelVideoDownload(assetId);
      }
    };
  }, [apply, assetId]);

  const download = useCallback(() => {
    if (downloading.current) return;
    downloading.current = true;
    setState({ id: assetId, status: 'downloading', progress: 0 });
    TazalaScanner.downloadVideo(assetId)
      .then((source) => {
        downloading.current = false;
        return apply(source, source.status === 'cancelled' ? 'cloud-only' : 'failed');
      })
      .catch((error: unknown) => {
        downloading.current = false;
        if (__DEV__) console.warn(error);
        if (alive.current) setState({ id: assetId, status: 'failed', progress: 0 });
      });
  }, [apply, assetId]);

  const cancelDownload = useCallback(() => {
    if (!downloading.current) return;
    TazalaScanner.cancelVideoDownload(assetId);
  }, [assetId]);

  useEventListener(TazalaScanner, 'onVideoDownloadProgress', ({ id, progress }) => {
    if (id !== assetId) return;
    setState((current) =>
      current.id === assetId && current.status === 'downloading'
        ? { ...current, progress }
        : current,
    );
  });

  useEffect(() => {
    applyMuted(player, muted);
  }, [muted, player]);

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status !== 'error') return;
    if (__DEV__) console.warn(error);
    setState({ id: assetId, status: 'failed', progress: 0 });
  });

  const current = state.id === assetId ? state : { status: 'loading' as const, progress: 0 };
  return { player, status: current.status, progress: current.progress, download, cancelDownload };
}
