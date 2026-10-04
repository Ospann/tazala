import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { runScan } from '@/features/scan/scanService';
import { hasLibraryAccess, usePermissionStore } from '@/stores/permissionStore';
import { createStyles } from '@/theme/ThemeProvider';

export function PermissionDenied() {
  const { t } = useTranslation();
  const request = usePermissionStore((state) => state.request);
  const status = usePermissionStore((state) => state.status);

  const onPress = async () => {
    if (status === 'undetermined') {
      const result = await request();
      if (hasLibraryAccess(result)) void runScan();
      return;
    }
    await Linking.openSettings();
  };

  return (
    <EmptyState
      icon="lock-closed-outline"
      title={t('permission.deniedTitle')}
      message={t('permission.deniedBody')}
      actionLabel={
        status === 'undetermined' ? t('onboarding.allowAccess') : t('permission.openSettings')
      }
      onAction={() => void onPress()}
    />
  );
}

export function LimitedAccessBanner() {
  const styles = useStyles();
  const { t } = useTranslation();
  const changeSelection = usePermissionStore((state) => state.changeSelection);

  const onPress = async () => {
    const status = await changeSelection();
    if (hasLibraryAccess(status)) void runScan();
  };

  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <Icon name="information-circle-outline" color="primary" />
        <AppText variant="bodyStrong" style={styles.flex}>
          {t('permission.limitedTitle')}
        </AppText>
      </View>
      <AppText variant="caption" tone="secondary">
        {t('permission.limitedBody')}
      </AppText>
      <View style={styles.actions}>
        <Button
          label={t('permission.changeSelection')}
          variant="secondary"
          onPress={() => void onPress()}
        />
        <Button
          label={t('permission.allowFull')}
          variant="ghost"
          onPress={() => void Linking.openSettings()}
        />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  banner: {
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primarySoft,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
}));
