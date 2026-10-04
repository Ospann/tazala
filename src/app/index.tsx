import { Redirect } from 'expo-router';

import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { useSettingsStore } from '@/stores/settingsStore';

export default function Index() {
  const onboardingCompleted = useSettingsStore((state) => state.onboardingCompleted);
  if (!onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }
  return <DashboardScreen />;
}
