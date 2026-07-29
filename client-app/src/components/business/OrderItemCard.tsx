/**
 * 订单列表项卡片:商品快照 + 状态 + 金额
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import PriceText from '@/components/business/PriceText';
import { ORDER_STATUS, ORDER_STATUS_I18N } from '@/config/global';
import { colors, fontSize, radius, spacing } from '@/config/theme';
import type { OrderItemData } from '@/types/models';
import { formatDate } from '@/utils/format';

interface Props {
  order: OrderItemData;
  onPress: (order: OrderItemData) => void;
}

/** 状态颜色:待支付/退款中黄,已支付/已核销绿,取消/退款/过期灰 */
function statusColor(status: number): string {
  if (status === ORDER_STATUS.PENDING || status === ORDER_STATUS.REFUNDING) return colors.warning;
  if (status === ORDER_STATUS.PAID || status === ORDER_STATUS.USED) return colors.success;
  if (status === ORDER_STATUS.FINISHED) return colors.primary;
  return colors.textSecondary;
}

export default function OrderItemCard({ order, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(order)}
    >
      <View style={styles.header}>
        <Text style={styles.orderNo} numberOfLines={1}>
          {order.order_no}
        </Text>
        <Text style={[styles.status, { color: statusColor(order.order_status) }]}>
          {t(ORDER_STATUS_I18N[order.order_status] ?? '')}
        </Text>
      </View>
      <View style={styles.body}>
        <Image
          source={order.goods_image ? { uri: order.goods_image } : undefined}
          style={styles.cover}
          resizeMode="cover"
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {order.goods_name}
          </Text>
          <Text style={styles.sku} numberOfLines={1}>
            {order.sku_name} × {order.quantity}
          </Text>
          <Text style={styles.date}>
            {formatDate(order.use_date)}
            {order.end_date ? ` ~ ${formatDate(order.end_date)}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.totalLabel}>{t('order.totalAmount')}</Text>
        <PriceText amount={order.pay_amount} size="sm" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  pressed: { opacity: 0.9 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderNo: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary, marginRight: spacing.sm },
  status: { fontSize: fontSize.sm, fontWeight: '600' },
  body: { flexDirection: 'row' },
  cover: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.background },
  info: { flex: 1, marginLeft: spacing.md, justifyContent: 'space-between' },
  name: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
  sku: { fontSize: fontSize.xs, color: colors.textSecondary },
  date: { fontSize: fontSize.xs, color: colors.textSecondary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  totalLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginRight: spacing.xs },
});
