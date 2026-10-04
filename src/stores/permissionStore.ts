import TazalaScanner, { type PermissionStatus } from 'tazala-scanner';
import { create } from 'zustand';

interface PermissionState {
  status: PermissionStatus | null;
  refresh: () => Promise<PermissionStatus>;
  request: () => Promise<PermissionStatus>;
  changeSelection: () => Promise<PermissionStatus>;
}

export function hasLibraryAccess(status: PermissionStatus | null): boolean {
  return status === 'granted' || status === 'limited';
}

export const usePermissionStore = create<PermissionState>()((set) => ({
  status: null,
  refresh: async () => {
    const status = await TazalaScanner.getPermissionStatus();
    set({ status });
    return status;
  },
  request: async () => {
    const status = await TazalaScanner.requestPermission();
    set({ status });
    return status;
  },
  changeSelection: async () => {
    await TazalaScanner.presentLimitedLibraryPicker();
    const status = await TazalaScanner.getPermissionStatus();
    set({ status });
    return status;
  },
}));
