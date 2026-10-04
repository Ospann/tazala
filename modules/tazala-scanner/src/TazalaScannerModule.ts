import { NativeModule, requireNativeModule } from 'expo';

import type {
  AssetInfo,
  DeleteResult,
  FingerprintKind,
  GroupingOptions,
  GroupingResult,
  LibraryStats,
  NativePlatform,
  PermissionStatus,
  PingResult,
  ScanOptions,
  TazalaScannerModuleEvents,
} from './TazalaScanner.types';

declare class TazalaScannerModule extends NativeModule<TazalaScannerModuleEvents> {
  readonly platform: NativePlatform;
  readonly moduleVersion: string;
  readonly analysisVersion: number;
  readonly fingerprintKind: FingerprintKind;
  ping(): Promise<PingResult>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestPermission(): Promise<Exclude<PermissionStatus, 'undetermined'>>;
  presentLimitedLibraryPicker(): Promise<void>;
  getLibraryStats(): Promise<LibraryStats>;
  listAssets(offset: number, limit: number): Promise<AssetInfo[]>;
  startScan(options: ScanOptions): Promise<void>;
  pauseScan(): void;
  resumeScan(): void;
  cancelScan(): void;
  isScanning(): boolean;
  findSimilarGroups(options: GroupingOptions): Promise<GroupingResult>;
  deleteAssets(ids: string[]): Promise<DeleteResult>;
  getMemoryUsage(): number;
}

export default requireNativeModule<TazalaScannerModule>('TazalaScanner');
