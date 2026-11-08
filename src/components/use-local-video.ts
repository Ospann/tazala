import { useEventListener } from 'expo';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import TazalaScanner, { type VideoSourceResult } from 'tazala-scanner';

import {
  describeSource,
  useVideoErrorStore,
  type VideoErrorStage,
} from '@/stores/video-error-store';

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
  frameShown: boolean;
  onFirstFrame: () => void;
  download: () => void;
  cancelDownload: () => void;
}

const FIRST_FRAME_TIMEOUT_MS = 8000;
const MAX_ATTEMPT = 2;

function applyMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function useLocalVideo(
  assetId: string,
  { muted, loop, autoplay }: LocalVideoOptions,
): LocalVideo {
  const [state, setState] = useState<{
    id: string;
    status: LocalVideoStatus;
    progress: number;
    frameShown: boolean;
  }>({ id: assetId, status: 'loading', progress: 0, frameShown: false });
  const generation = useRef(0);
  const attempt = useRef(0);
  const sourceUri = useRef<string | null>(null);
  const downloading = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useVideoPlayer(null, (created) => {
    created.loop = loop;
    created.muted = muted;
    created.audioMixingMode = 'mixWithOthers';
  });

  const clearWatchdog = useCallback(() => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  }, []);

  const report = useCallback(
    (stage: VideoErrorStage, error: unknown) => {
      const message = messageOf(error);
      if (__DEV__) console.warn(`[video] ${stage} #${attempt.current} ${assetId}: ${message}`);
      useVideoErrorStore.getState().record({
        assetId,
        stage,
        attempt: attempt.current,
        message,
        source: describeSource(sourceUri.current),
      });
    },
    [assetId],
  );

  const fail = useCallback(
    (token: number) => {
      if (token !== generation.current) return;
      clearWatchdog();
      setState({ id: assetId, status: 'failed', progress: 0, frameShown: false });
    },
    [assetId, clearWatchdog],
  );

  const recoverRef = useRef<(token: number, stage: VideoErrorStage, error: unknown) => void>(
    () => undefined,
  );

  const play = useCallback(
    async (token: number, source: VideoSourceResult, fallback: LocalVideoStatus) => {
      if (token !== generation.current) return;
      if (!source.uri) {
        if (source.status === 'cloud-only') {
          setState({ id: assetId, status: 'cloud-only', progress: 0, frameShown: false });
          return;
        }
        if (source.status === 'cancelled' || fallback === 'cloud-only') {
          setState({ id: assetId, status: fallback, progress: 0, frameShown: false });
          return;
        }
        recoverRef.current(token, 'resolve', source.reason ?? source.status);
        return;
      }
      sourceUri.current = source.uri;
      try {
        await player.replaceAsync({ uri: source.uri });
      } catch (error: unknown) {
        recoverRef.current(token, 'load', error);
        return;
      }
      if (token !== generation.current) return;
      if (autoplay) player.play();
      setState({ id: assetId, status: 'ready', progress: 1, frameShown: false });
      clearWatchdog();
      watchdog.current = setTimeout(() => {
        watchdog.current = null;
        if (token !== generation.current) return;
        if (player.status === 'readyToPlay') {
          setState((current) =>
            current.id === assetId ? { ...current, frameShown: true } : current,
          );
          return;
        }
        recoverRef.current(
          token,
          'first-frame',
          `status ${player.status} after ${FIRST_FRAME_TIMEOUT_MS} ms`,
        );
      }, FIRST_FRAME_TIMEOUT_MS);
    },
    [assetId, autoplay, clearWatchdog, player],
  );

  const recover = useCallback(
    (token: number, stage: VideoErrorStage, error: unknown) => {
      if (token !== generation.current) return;
      clearWatchdog();
      report(stage, error);
      if (attempt.current >= MAX_ATTEMPT) {
        fail(token);
        return;
      }
      attempt.current += 1;
      setState({ id: assetId, status: 'loading', progress: 0, frameShown: false });
      TazalaScanner.releaseVideoSource(assetId);
      const next =
        attempt.current === 1
          ? TazalaScanner.resolveVideoSource(assetId)
          : TazalaScanner.exportVideoSource(assetId);
      next
        .then((source) => play(token, source, 'failed'))
        .catch((nextError: unknown) => {
          report(attempt.current === 1 ? 'resolve' : 'export', nextError);
          fail(token);
        });
    },
    [assetId, clearWatchdog, fail, play, report],
  );

  useLayoutEffect(() => {
    recoverRef.current = recover;
  }, [recover]);

  useEffect(() => {
    generation.current += 1;
    const token = generation.current;
    attempt.current = 0;
    sourceUri.current = null;
    TazalaScanner.resolveVideoSource(assetId)
      .then((source) => play(token, source, 'failed'))
      .catch((error: unknown) => recoverRef.current(token, 'resolve', error));
    return () => {
      generation.current += 1;
      clearWatchdog();
      if (downloading.current) {
        downloading.current = false;
        TazalaScanner.cancelVideoDownload(assetId);
      }
      TazalaScanner.releaseVideoSource(assetId);
    };
  }, [assetId, clearWatchdog, play]);

  const download = useCallback(() => {
    if (downloading.current) return;
    downloading.current = true;
    const token = generation.current;
    setState({ id: assetId, status: 'downloading', progress: 0, frameShown: false });
    TazalaScanner.downloadVideo(assetId)
      .then((source) => {
        downloading.current = false;
        return play(token, source, source.status === 'cancelled' ? 'cloud-only' : 'failed');
      })
      .catch((error: unknown) => {
        downloading.current = false;
        report('resolve', error);
        fail(token);
      });
  }, [assetId, fail, play, report]);

  const cancelDownload = useCallback(() => {
    if (!downloading.current) return;
    TazalaScanner.cancelVideoDownload(assetId);
  }, [assetId]);

  const onFirstFrame = useCallback(() => {
    clearWatchdog();
    setState((current) =>
      current.id === assetId && !current.frameShown ? { ...current, frameShown: true } : current,
    );
  }, [assetId, clearWatchdog]);

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
    recoverRef.current(generation.current, 'player', error ?? 'player error');
  });

  const current =
    state.id === assetId ? state : { status: 'loading' as const, progress: 0, frameShown: false };
  return {
    player,
    status: current.status,
    progress: current.progress,
    frameShown: current.frameShown,
    onFirstFrame,
    download,
    cancelDownload,
  };
}
