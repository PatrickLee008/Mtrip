/**
 * 多币种价格文本:货币符号来自当前站点 currency
 */

import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { colors, fontSize } from '@/config/theme';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

interface Props {
  amount: number | string;
  /** 覆盖站点货币(如订单快照币种) */
  currency?: string;
  /** 尾缀,如"起" */
  suffix?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: TextStyle;
}

const SIZE_MAP = { sm: fontSize.sm, md: fontSize.price, lg: fontSize.xl } as const;

export default function PriceText({ amount, currency, suffix, size = 'md', style }: Props) {
  const siteCurrency = useSiteStore((s) => s.currency);
  return (
    <Text style={[styles.price, { fontSize: SIZE_MAP[size] }, style]}>
      {formatMoney(amount, currency ?? siteCurrency)}
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  price: { color: colors.price, fontWeight: '700' },
  suffix: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '400' },
});
