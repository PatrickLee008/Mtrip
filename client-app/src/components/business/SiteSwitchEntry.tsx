/**
 * 站点切换入口:展示当前站点,点击进入站点选择页
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, radius, spacing } from '@/config/theme';
import { useSiteStore } from '@/store/siteStore';

export default function SiteSwitchEntry({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const siteName = useSiteStore((s) => s.siteName);
  const currency = useSiteStore((s) => s.currency);
  return (
    <Pressable style={({ pressed }) => [styles.entry, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.name} numberOfLines={1}>
        {siteName || t('site.title')}
      </Text>
      <Text style={styles.currency}>{currency}</Text>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: 220,
  },
  pressed: { opacity: 0.8 },
  icon: { fontSize: fontSize.sm, marginRight: spacing.xs },
  name: { flexShrink: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  currency: { marginLeft: spacing.sm, fontSize: fontSize.xs, color: colors.textSecondary },
  arrow: { marginLeft: spacing.xs, fontSize: fontSize.md, color: colors.textSecondary },
});
