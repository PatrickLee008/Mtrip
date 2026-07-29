/**
 * 状态视图三件套:空/加载/错误
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, spacing } from '@/config/theme';

export function LoadingView() {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>{t('common.loading')}</Text>
    </View>
  );
}

export function EmptyView({ text }: { text?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🗂️</Text>
      <Text style={styles.text}>{text ?? t('common.empty')}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>{message ?? 'Error'}</Text>
      {onRetry ? (
        <Pressable style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: { fontSize: 40, marginBottom: spacing.sm },
  text: { marginTop: spacing.sm, fontSize: fontSize.sm, color: colors.textSecondary },
  retry: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  retryText: { color: '#fff', fontSize: fontSize.sm },
});
