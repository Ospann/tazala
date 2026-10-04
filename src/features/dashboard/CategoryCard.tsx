import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import type { CategorySummary } from '@/db/categoriesRepository';
import { createStyles } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

import { categoryIcons } from './categoryMeta';

interface CategoryCardProps {
  summary: CategorySummary;
  pending: boolean;
  onPress: () => void;
}

export function CategoryCard({ summary, pending, onPress }: CategoryCardProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const format = useFormat();
  const title = t(`categories.${summary.kind}.title`);
  const isGroup = summary.kind === 'similar' || summary.kind === 'duplicates';
  const countLabel = pending
    ? t('dashboard.analyzing')
    : summary.count === 0
      ? t('dashboard.nothingFound')
      : isGroup
        ? t('dashboard.groupCount', { count: summary.groupCount, items: summary.count })
        : t('dashboard.itemCount', { count: summary.count });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${countLabel}${summary.count > 0 ? `, ${format.bytes(summary.bytes)}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Icon name={categoryIcons[summary.kind]} color="primary" />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" tone="secondary">
          {countLabel}
        </AppText>
      </View>
      {summary.count > 0 ? (
        <AppText variant="label" tone="accent">
          {format.bytes(summary.bytes)}
        </AppText>
      ) : null}
      <Icon name="chevron-forward" size={18} color="textTertiary" />
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
}));
