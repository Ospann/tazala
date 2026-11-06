import type { IconName } from '@/components/icon';
import type { CategoryKind } from '@/db/categories-repository';

export const categoryOrder: CategoryKind[] = [
  'similar',
  'duplicates',
  'screenshots',
  'blurry',
  'videos',
];

export const categoryIcons: Record<CategoryKind, IconName> = {
  similar: 'albums-outline',
  duplicates: 'copy-outline',
  screenshots: 'phone-portrait-outline',
  blurry: 'eye-off-outline',
  videos: 'videocam-outline',
};
