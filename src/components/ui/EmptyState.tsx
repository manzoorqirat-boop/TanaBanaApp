import { View, Text, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { colors, spacing, fontSize } from '../../theme/tokens';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/** Shown on empty lists ("No suppliers yet") and load-failure states. */
export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ?? <Inbox size={32} color={colors.textMuted} />}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="ghost" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[6],
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textStrong,
    marginTop: spacing[3],
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  action: { marginTop: spacing[4] },
});
