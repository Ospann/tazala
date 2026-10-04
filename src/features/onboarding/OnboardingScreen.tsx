import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Linking,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { runScan } from '@/features/scan/scanService';
import { hasLibraryAccess, usePermissionStore } from '@/stores/permissionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createStyles } from '@/theme/ThemeProvider';

interface Page {
  icon: IconName;
  title: string;
  body: string;
}

export function OnboardingScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);
  const request = usePermissionStore((state) => state.request);
  const updateSetting = useSettingsStore((state) => state.update);

  const pages: Page[] = [
    {
      icon: 'sparkles-outline',
      title: t('onboarding.intro.title'),
      body: t('onboarding.intro.body'),
    },
    {
      icon: 'lock-closed-outline',
      title: t('onboarding.privacy.title'),
      body: t('onboarding.privacy.body'),
    },
    {
      icon: 'images-outline',
      title: t('onboarding.access.title'),
      body: t('onboarding.access.body'),
    },
  ];
  const isLast = page === pages.length - 1;

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const finish = async () => {
    await updateSetting('onboardingCompleted', true);
    router.replace('/');
  };

  const requestAccess = async () => {
    setRequesting(true);
    try {
      const status = await request();
      if (hasLibraryAccess(status)) {
        await finish();
        void runScan();
      } else {
        setDenied(true);
      }
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEnabled={!requesting}
      >
        {pages.map((item) => (
          <View key={item.title} style={[styles.page, { width }]}>
            <View style={styles.illustration}>
              <Icon name={item.icon} size={64} color="primary" />
            </View>
            <AppText variant="title" align="center" accessibilityRole="header">
              {item.title}
            </AppText>
            <AppText tone="secondary" align="center">
              {item.body}
            </AppText>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('onboarding.pageOf', { page: page + 1, total: pages.length })}
        >
          {pages.map((item, index) => (
            <View key={item.title} style={[styles.dot, index === page && styles.dotActive]} />
          ))}
        </View>
        {denied && isLast ? (
          <View style={styles.denied}>
            <AppText tone="secondary" align="center">
              {t('permission.deniedBody')}
            </AppText>
            <Button
              label={t('permission.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
            <Button
              label={t('onboarding.continueWithout')}
              variant="ghost"
              onPress={() => void finish()}
            />
          </View>
        ) : isLast ? (
          <Button
            label={t('onboarding.allowAccess')}
            size="large"
            icon="images-outline"
            loading={requesting}
            onPress={() => void requestAccess()}
          />
        ) : (
          <Button label={t('common.next')} size="large" onPress={() => goTo(page + 1)} />
        )}
      </View>
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  illustration: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  denied: {
    gap: theme.spacing.sm,
  },
}));
