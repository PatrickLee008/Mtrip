/**
 * 核销码展示:大号分组码 + 商品信息(线下出示)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontSize, radius, spacing } from '@/config/theme';
import type { VerifyCodeData } from '@/types/models';
import { formatDate } from '@/utils/format';

/** 16位核销码按4位分组便于口述:XXXX XXXX XXXX XXXX */
function groupCode(code: string): string {
  return code.replace(/(.{4})/g, '$1 ').trim();
}

export default function VerifyCodeView({ data }: { data: VerifyCodeData }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('order.verifyCode')}</Text>
      <Text style={styles.code}>{groupCode(data.verifyCode)}</Text>
      <View style={styles.divider} />
      <Text style={styles.goods} numberOfLines={2}>
        {data.goodsName}
      </Text>
      <Text style={styles.meta}>
        {data.skuName} × {data.quantity}
      </Text>
      {data.useDate ? <Text style={styles.meta}>{formatDate(data.useDate)}</Text> : null}
      <Text style={styles.orderNo}>
        {t('order.orderNo')}: {data.orderNo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    margin: spacing.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  title: { fontSize: fontSize.sm, color: colors.textSecondary },
  code: {
    marginTop: spacing.md,
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  divider: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  goods: { fontSize: fontSize.md, color: colors.text, fontWeight: '600', textAlign: 'center' },
  meta: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.textSecondary },
  orderNo: { marginTop: spacing.lg, fontSize: fontSize.xs, color: colors.textSecondary },
});
