import { Redirect, useLocalSearchParams } from 'expo-router';

import { SwipeDeckScreen } from '@/features/swipe/SwipeDeckScreen';

export default function SwipeDeckRoute() {
  const { month } = useLocalSearchParams<{ month: string }>();
  if (!month || (month !== 'random' && !/^\d{4}-\d{2}$/.test(month))) {
    return <Redirect href="/swipe" />;
  }
  return <SwipeDeckScreen month={month} />;
}
