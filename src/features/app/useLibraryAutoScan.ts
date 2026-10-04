import { useEffect } from 'react';
import { AppState } from 'react-native';
import TazalaScanner from 'tazala-scanner';

import { LIBRARY_CHANGE_DEBOUNCE_MS } from '@/config';
import { runScan } from '@/features/scan/scanService';
import { hasLibraryAccess, usePermissionStore } from '@/stores/permissionStore';
import { useSettingsStore } from '@/stores/settingsStore';

function canScan(): boolean {
  return (
    useSettingsStore.getState().onboardingCompleted &&
    hasLibraryAccess(usePermissionStore.getState().status)
  );
}

export function useLibraryAutoScan(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (canScan() && AppState.currentState === 'active') {
          void runScan();
        }
      }, LIBRARY_CHANGE_DEBOUNCE_MS);
    };

    const librarySubscription = TazalaScanner.addListener('onLibraryChange', schedule);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !useSettingsStore.getState().onboardingCompleted) return;
      const previous = usePermissionStore.getState().status;
      void usePermissionStore
        .getState()
        .refresh()
        .then((status) => {
          if (hasLibraryAccess(status) && status !== previous) {
            void runScan();
          }
        });
    });

    return () => {
      if (timer) clearTimeout(timer);
      librarySubscription.remove();
      appStateSubscription.remove();
    };
  }, []);
}
