import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { createStyles } from '@/theme/ThemeProvider';

const sections = [
  'summary',
  'access',
  'processing',
  'storage',
  'network',
  'deletion',
  'contact',
] as const;

export function PrivacyScreen() {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <Header title={t('privacy.title')} />
      <View style={styles.flex}>
        <Screen scroll edges={['bottom']}>
          <AppText variant="caption" tone="tertiary">
            {t('privacy.updated')}
          </AppText>
          {sections.map((section) => (
            <View key={section} style={styles.section}>
              <AppText variant="bodyStrong" accessibilityRole="header">
                {t(`privacy.${section}.title`)}
              </AppText>
              <AppText tone="secondary">{t(`privacy.${section}.body`)}</AppText>
            </View>
          ))}
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
    gap: theme.spacing.xs,
  },
}));
