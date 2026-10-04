export type NativePlatform = 'ios' | 'android';

export type MediaType = 'photo' | 'video';

export type PermissionStatus = 'granted' | 'limited' | 'denied' | 'undetermined';

export type SimilarityLevel = 'low' | 'medium' | 'high';

export type FingerprintKind = 'vision-v1' | 'dhash-v1';

export type AnalysisStatus = 'ok' | 'cloud-only' | 'failed';

export interface PingResult {
  platform: NativePlatform;
  osVersion: string;
  moduleVersion: string;
}

export interface AssetInfo {
  id: string;
  uri: string;
  mediaType: MediaType;
  createdAt: number;
  modifiedAt: number;
  width: number;
  height: number;
  fileSize: number;
  fileSizeEstimated: boolean;
  duration?: number;
  isScreenshot: boolean;
  isFavorite: boolean;
}

export interface LibraryStats {
  photoCount: number;
  videoCount: number;
}

export interface ScanOptions {
  assetIds?: string[];
  batchSize?: number;
  concurrency?: number;
}

export interface AssetAnalysis {
  id: string;
  status: AnalysisStatus;
  fingerprint: string | null;
  fingerprintKind: FingerprintKind | null;
  blurScore: number;
  exactHash: string;
  analysisVersion: number;
}

export interface GroupingOptions {
  databasePath: string;
  level: SimilarityLevel;
  windowMs?: number;
}

export interface GroupingResult {
  groups: string[][];
  duplicates: string[][];
  comparisons: number;
  itemCount: number;
  durationMs: number;
}

export interface DeleteResult {
  deletedIds: string[];
  failedIds: string[];
  missingIds: string[];
  cancelled: boolean;
}

export interface ScanProgressEvent {
  processed: number;
  total: number;
}

export interface ScanBatchEvent {
  analyses: AssetAnalysis[];
}

export interface ScanCompleteEvent {
  durationMs: number;
  processed: number;
  cancelled: boolean;
}

export interface ScanErrorEvent {
  message: string;
}

export type TazalaScannerModuleEvents = {
  onScanProgress: (event: ScanProgressEvent) => void;
  onScanBatch: (event: ScanBatchEvent) => void;
  onScanComplete: (event: ScanCompleteEvent) => void;
  onScanError: (event: ScanErrorEvent) => void;
  onLibraryChange: () => void;
};
