import { router } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { Linking, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { runScan } from '@/features/scan/scanService';
import { hasLibraryAccess, usePermissionStore } from '@/stores/permissionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createStyles } from '@/theme/ThemeProvider';

import { AccessIllustration, IntroIllustration, PrivacyIllustration } from './Illustrations';

interface Page {
  Illustration: ComponentType<{ active: boolean }>;
  title: string;
  body: string;
}

export function OnboardingScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);
  const request = usePermissionStore((state) => state.request);
  const updateSetting = useSettingsStore((state) => state.update);

  const pages: Page[] = [
    {
      Illustration: IntroIllustration,
      title: t('onboarding.intro.title'),
      body: t('onboarding.intro.body'),
    },
    {
      Illustration: PrivacyIllustration,
      title: t('onboarding.privacy.title'),
      body: t('onboarding.privacy.body'),
    },
    {
      Illustration: AccessIllustration,
      title: t('onboarding.access.title'),
      body: t('onboarding.access.body'),
    },
  ];
  const isLast = page === pages.length - 1;

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
    onMomentumEnd: (event) => {
      scheduleOnRN(setPage, Math.round(event.contentOffset.x / width));
    },
  });

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
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={!requesting}
      >
        {pages.map((item, index) => (
          <ParallaxPage
            key={item.title}
            index={index}
            width={width}
            scrollX={scrollX}
            page={item}
            active={page === index}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('onboarding.pageOf', { page: page + 1, total: pages.length })}
        >
          {pages.map((item, index) => (
            <PageDot key={item.title} index={index} width={width} scrollX={scrollX} />
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

function ParallaxPage({
  index,
  width,
  scrollX,
  page,
  active,
}: {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  page: Page;
  active: boolean;
}) {
  const styles = useStyles();
  const { Illustration } = page;
  const illustrationStyle = useAnimatedStyle(() => {
    const offset = scrollX.get() - index * width;
    return {
      opacity: interpolate(Math.abs(offset), [0, width * 0.8], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: offset * 0.45 },
        { scale: interpolate(Math.abs(offset), [0, width], [1, 0.8], Extrapolation.CLAMP) },
      ],
    };
  });
  const textStyle = useAnimatedStyle(() => {
    const offset = scrollX.get() - index * width;
    return {
      opacity: interpolate(Math.abs(offset), [0, width * 0.6], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: offset * -0.15 }],
    };
  });
  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={[styles.illustration, illustrationStyle]}>
        <Illustration active={active} />
      </Animated.View>
      <Animated.View style={[styles.copy, textStyle]}>
        <AppText variant="title" align="center" accessibilityRole="header">
          {page.title}
        </AppText>
        <AppText tone="secondary" align="center">
          {page.body}
        </AppText>
      </Animated.View>
    </View>
  );
}

function PageDot({
  index,
  width,
  scrollX,
}: {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  const styles = useStyles();
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.get() / width - index);
    return {
      width: interpolate(distance, [0, 1], [24, 8], Extrapolation.CLAMP),
      opacity: interpolate(distance, [0, 1], [1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, styles.dotActive, style]} />;
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
    marginBottom: theme.spacing.xl,
  },
  copy: {
    gap: theme.spacing.lg,
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
