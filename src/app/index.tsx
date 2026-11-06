import { Redirect } from 'expo-router';

import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { useSettingsStore } from '@/stores/settings-store';

export default function Index() {
  const onboardingCompleted = useSettingsStore((state) => state.onboardingCompleted);
  if (!onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }
  return <DashboardScreen />;
}
