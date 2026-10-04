import { Redirect } from 'expo-router';

import { BenchmarkScreen } from '@/features/benchmark/BenchmarkScreen';

export default function BenchmarkRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <BenchmarkScreen />;
}
