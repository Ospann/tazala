export interface MediaItem {
  id: string;
  uri: string;
  mediaType: 'photo' | 'video';
  fileSize: number;
  createdAt: number;
  width: number;
  height: number;
  duration: number | null;
  blurScore: number | null;
}

export interface MediaItemRow {
  id: string;
  uri: string;
  media_type: 'photo' | 'video';
  file_size: number;
  created_at: number;
  width: number;
  height: number;
  duration: number | null;
  blur_score: number | null;
}

export const MEDIA_ITEM_COLUMNS =
  'a.id, a.uri, a.media_type, a.file_size, a.created_at, a.width, a.height, a.duration';

export function toMediaItem(row: MediaItemRow): MediaItem {
  return {
    id: row.id,
    uri: row.uri,
    mediaType: row.media_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    width: row.width,
    height: row.height,
    duration: row.duration,
    blurScore: row.blur_score ?? null,
  };
}
