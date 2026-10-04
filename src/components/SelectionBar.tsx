import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { createStyles } from '@/theme/ThemeProvider';
import { useFormat } from '@/utils/useFormat';

import { AppText } from './AppText';
import { Button } from './Button';

interface SelectionBarProps {
  count: number;
  total: number;
  bytes: number;
  busy?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onConfirm: () => void;
}

export function SelectionBar({
  count,
  total,
  bytes,
  busy,
  onSelectAll,
  onClear,
  onConfirm,
}: SelectionBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const format = useFormat();
  const allSelected = count > 0 && count === total;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.row}>
        <AppText variant="label" accessibilityLiveRegion="polite">
          {t('selection.summary', { count, size: format.bytes(bytes) })}
        </AppText>
        <Button
          label={allSelected ? t('selection.clear') : t('selection.selectAll')}
          variant="ghost"
          onPress={allSelected ? onClear : onSelectAll}
          disabled={total === 0}
          style={styles.compact}
        />
      </View>
      <Button
        label={t('selection.moveToTrash', { count })}
        icon="trash-outline"
        variant="danger"
        onPress={onConfirm}
        disabled={count === 0}
        loading={busy}
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  bar: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  compact: {
    paddingHorizontal: theme.spacing.sm,
    minHeight: 40,
  },
}));
