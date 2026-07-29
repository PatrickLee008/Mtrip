/**
 * 通用按钮:主/次/危险三种类型,加载与禁用态
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/config/theme';

interface Props {
  title: string;
  onPress?: () => void;
  type?: 'primary' | 'default' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
}

export default function CustomButton({
  title,
  onPress,
  type = 'primary',
  disabled = false,
  loading = false,
  block = true,
}: Props) {
  const bg =
    type === 'primary' ? colors.primary : type === 'danger' ? colors.danger : colors.card;
  const fg = type === 'default' ? colors.text : '#fff';
  const dimmed = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: dimmed ? 0.5 : pressed ? 0.85 : 1 },
        type === 'default' && styles.bordered,
        block && styles.block,
      ]}
      disabled={dimmed}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.title, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  },
  block: { alignSelf: 'stretch' },
  bordered: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  title: { fontSize: fontSize.md, fontWeight: '600' },
});
