import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createStyles } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface HeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean;
}

export function Header({ title, subtitle, right, back = true }: HeaderProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {back && (
          <IconButton icon="chevron-back" label={t('common.back')} onPress={() => router.back()} />
        )}
      </View>
      <View style={styles.titles}>
        <AppText variant="heading" align="center" numberOfLines={1} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary" align="center" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    minHeight: 56,
  },
  side: {
    minWidth: 88,
    flexDirection: 'row',
  },
  right: {
    justifyContent: 'flex-end',
  },
  titles: {
    flex: 1,
    alignItems: 'center',
  },
}));
