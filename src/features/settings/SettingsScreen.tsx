import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import type { SimilarityLevel } from 'tazala-scanner';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { LARGE_VIDEO_OPTIONS_MB } from '@/config';
import { getDatabase } from '@/db/database';
import { resetSwipeDecisions } from '@/db/swipeRepository';
import { regroup, runScan } from '@/features/scan/scanService';
import { useLibraryStore } from '@/stores/libraryStore';
import { useScanStore } from '@/stores/scanStore';
import {
  useSettingsStore,
  type LanguagePreference,
  type LargeVideoMb,
  type ThemePreference,
} from '@/stores/settingsStore';
import { createStyles } from '@/theme/ThemeProvider';

import { OptionGroup } from './OptionGroup';

export function SettingsScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const scanning = useScanStore((state) => state.phase !== 'idle');

  const setSimilarity = async (level: SimilarityLevel) => {
    await settings.update('similarityLevel', level);
    await regroup();
  };

  const setVideoThreshold = async (value: LargeVideoMb) => {
    await settings.update('largeVideoMb', value);
    await useLibraryStore.getState().refresh();
  };

  const confirmRescan = () => {
    Alert.alert(t('settings.rescanTitle'), t('settings.rescanBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.rescanAction'),
        onPress: () => {
          void runScan({ full: true });
          router.back();
        },
      },
    ]);
  };

  const confirmResetSwipes = () => {
    Alert.alert(t('settings.resetSwipesTitle'), t('settings.resetSwipesBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.resetSwipesAction'),
        style: 'destructive',
        onPress: () => {
          void getDatabase()
            .then(resetSwipeDecisions)
            .then(() => useLibraryStore.getState().refresh());
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <Header title={t('settings.title')} />
      <View style={styles.flex}>
        <Screen scroll edges={['bottom']}>
          <OptionGroup<LanguagePreference>
            title={t('settings.language')}
            value={settings.language}
            onChange={(value) => void settings.update('language', value)}
            options={[
              { value: 'system', label: t('settings.languageSystem') },
              { value: 'ru', label: 'Русский' },
              { value: 'kk', label: 'Қазақша' },
              { value: 'en', label: 'English' },
            ]}
          />
          <OptionGroup<ThemePreference>
            title={t('settings.theme')}
            value={settings.theme}
            onChange={(value) => void settings.update('theme', value)}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
          />
          <OptionGroup<SimilarityLevel>
            title={t('settings.similarity')}
            description={t('settings.similarityDescription')}
            value={settings.similarityLevel}
            onChange={(value) => void setSimilarity(value)}
            options={[
              {
                value: 'low',
                label: t('settings.similarityLow'),
                description: t('settings.similarityLowHint'),
              },
              {
                value: 'medium',
                label: t('settings.similarityMedium'),
                description: t('settings.similarityMediumHint'),
              },
              {
                value: 'high',
                label: t('settings.similarityHigh'),
                description: t('settings.similarityHighHint'),
              },
            ]}
          />
          <OptionGroup<LargeVideoMb>
            title={t('settings.largeVideo')}
            value={settings.largeVideoMb}
            onChange={(value) => void setVideoThreshold(value)}
            options={LARGE_VIDEO_OPTIONS_MB.map((mb) => ({
              value: mb,
              label: t('settings.largeVideoOption', { mb }),
            }))}
          />
          <View style={styles.section}>
            <AppText variant="label" tone="secondary" accessibilityRole="header">
              {t('settings.library')}
            </AppText>
            <Button
              label={t('settings.rescan')}
              icon="refresh"
              variant="secondary"
              onPress={confirmRescan}
              disabled={scanning}
            />
            <Button
              label={t('settings.resetSwipes')}
              icon="swap-horizontal"
              variant="secondary"
              onPress={confirmResetSwipes}
            />
          </View>
          <View style={styles.section}>
            <AppText variant="label" tone="secondary" accessibilityRole="header">
              {t('settings.about')}
            </AppText>
            <Button
              label={t('privacy.title')}
              icon="shield-checkmark-outline"
              variant="secondary"
              onPress={() => router.push('/privacy')}
            />
            {__DEV__ ? (
              <Button
                label={t('benchmark.title')}
                icon="speedometer-outline"
                variant="ghost"
                onPress={() => router.push('/benchmark')}
              />
            ) : null}
            <AppText variant="caption" tone="tertiary" align="center">
              {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
            </AppText>
            <AppText variant="caption" tone="tertiary" align="center">
              {t('settings.free')}
            </AppText>
          </View>
        </Screen>
      </View>
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  flex: {
    flex: 1,
  },
  section: {
    gap: theme.spacing.sm,
  },
}));
