import { Redirect, useLocalSearchParams } from 'expo-router';

import { CategoryScreen, isCategoryKind } from '@/features/categories/CategoryScreen';

export default function CategoryRoute() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  if (!isCategoryKind(kind)) {
    return <Redirect href="/" />;
  }
  return <CategoryScreen kind={kind} />;
}
