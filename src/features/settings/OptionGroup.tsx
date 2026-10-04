import { Pressable, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { createStyles } from '@/theme/ThemeProvider';

export interface Option<T extends string | number> {
  value: T;
  label: string;
  description?: string;
}

interface OptionGroupProps<T extends string | number> {
  title: string;
  description?: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function OptionGroup<T extends string | number>({
  title,
  description,
  options,
  value,
  onChange,
}: OptionGroupProps<T>) {
  const styles = useStyles();
  return (
    <View style={styles.section} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <AppText variant="label" tone="secondary" accessibilityRole="header">
        {title}
      </AppText>
      {description ? (
        <AppText variant="caption" tone="tertiary">
          {description}
        </AppText>
      ) : null}
      <View style={styles.card}>
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={
                option.description ? `${option.label}. ${option.description}` : option.label
              }
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.divider,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.text}>
                <AppText>{option.label}</AppText>
                {option.description ? (
                  <AppText variant="caption" tone="secondary">
                    {option.description}
                  </AppText>
                ) : null}
              </View>
              {selected ? (
                <Icon name="checkmark-circle" color="primary" />
              ) : (
                <Icon name="ellipse-outline" color="border" />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  section: {
    gap: theme.spacing.sm,
  },
  card: {
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 52,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  text: {
    flex: 1,
    gap: 2,
  },
}));
