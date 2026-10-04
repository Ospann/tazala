import type { IconName } from '@/components/Icon';
import type { CategoryKind } from '@/db/categoriesRepository';

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
