/**
 * 订单详情:状态/商品/金额/联系人 + 操作(支付mock/取消/退款/核销码)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { applyRefund, cancelOrder, fetchOrderDetail, fetchVerifyCode } from '@/api/order';
import { payOrder } from '@/api/pay';
import PriceText from '@/components/business/PriceText';
import VerifyCodeView from '@/components/business/VerifyCodeView';
import CustomButton from '@/components/common/CustomButton';
import CustomInput from '@/components/common/CustomInput';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import PageLayout from '@/components/layout/PageLayout';
import { ORDER_STATUS, ORDER_STATUS_I18N } from '@/config/global';
import { colors, fontSize, radius, spacing } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import type { OrderDetail, VerifyCodeData } from '@/types/models';
import { formatDate } from '@/utils/format';
import { isNotEmpty } from '@/utils/validate';

export default function OrderDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const orderId = route.params.orderId;
  const showToast = useCommonStore((s) => s.showToast);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyCodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOrderDetail(orderId);
      setOrder(data);
      setError('');
      // 已支付/已核销订单拉核销码
      if (data.order_status === ORDER_STATUS.PAID || data.order_status === ORDER_STATUS.USED) {
        try {
          setVerifyData(await fetchVerifyCode(orderId));
        } catch {
          setVerifyData(null);
        }
      } else {
        setVerifyData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error || !order) return <ErrorView message={error} onRetry={() => void load()} />;

  const act = async (fn: () => Promise<unknown>) => {
    if (acting) return;
    setActing(true);
    try {
      await fn();
      showToast(t('common.success'));
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setActing(false);
    }
  };

  const submitRefund = () => {
    if (!isNotEmpty(refundReason)) {
      showToast(t('order.refundReason'));
      return;
    }
    void act(async () => {
      await applyRefund({ orderId, reason: refundReason.trim() });
      setShowRefundForm(false);
      setRefundReason('');
    });
  };

  const status = order.order_status;

  return (
    <PageLayout scrollable padded>
      <View style={styles.statusCard}>
        <Text style={styles.statusText}>{t(ORDER_STATUS_I18N[status] ?? '')}</Text>
        <Text style={styles.orderNo}>
          {t('order.orderNo')}: {order.order_no}
        </Text>
      </View>

      {verifyData ? <VerifyCodeView data={verifyData} /> : null}

      <View style={styles.card}>
        <Text style={styles.goodsName} numberOfLines={2}>
          {order.goods_name}
        </Text>
        <Text style={styles.meta}>
          {order.sku_name} × {order.quantity}
        </Text>
        <Text style={styles.meta}>
          {t('order.useDate')}: {formatDate(order.use_date)}
          {order.end_date ? ` ~ ${formatDate(order.end_date)}` : ''}
        </Text>
      </View>

      <View style={styles.card}>
        <Row label={t('order.contactName')} value={order.contact_name} />
        <Row label={t('order.contactPhone')} value={order.contact_phone} />
        {order.remark ? <Row label={t('order.remark')} value={order.remark} /> : null}
        <Row label={t('order.createdAt')} value={formatDate(order.created_at, true)} />
      </View>

      <View style={styles.card}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>{t('order.totalAmount')}</Text>
          <PriceText amount={order.pay_amount} />
        </View>
      </View>

      {status === ORDER_STATUS.PENDING ? (
        <View style={styles.actions}>
          <CustomButton
            title={t('order.payStripe')}
            loading={acting}
            onPress={() => void act(() => payOrder(orderId, 1))}
          />
          <View style={styles.actionGap} />
          <CustomButton
            title={t('order.payPaypal')}
            loading={acting}
            onPress={() => void act(() => payOrder(orderId, 2))}
          />
          <View style={styles.actionGap} />
          <CustomButton
            title={t('order.cancelOrder')}
            type="default"
            disabled={acting}
            onPress={() => void act(() => cancelOrder(orderId))}
          />
        </View>
      ) : null}

      {status === ORDER_STATUS.PAID ? (
        <View style={styles.actions}>
          {showRefundForm ? (
            <View style={styles.card}>
              <CustomInput
                label={t('order.refundReason')}
                value={refundReason}
                onChangeText={setRefundReason}
                multiline
                maxLength={200}
              />
              <CustomButton title={t('common.submit')} loading={acting} onPress={submitRefund} />
              <View style={styles.actionGap} />
              <CustomButton
                title={t('common.cancel')}
                type="default"
                onPress={() => setShowRefundForm(false)}
              />
            </View>
          ) : (
            <CustomButton
              title={t('order.applyRefund')}
              type="danger"
              disabled={acting}
              onPress={() => setShowRefundForm(true)}
            />
          )}
        </View>
      ) : null}
    </PageLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  statusText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '700' },
  orderNo: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  goodsName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  meta: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  rowLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing.md },
  rowValue: { flex: 1, fontSize: fontSize.sm, color: colors.text, textAlign: 'right' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  actions: { marginBottom: spacing.xl },
  actionGap: { height: spacing.md },
});
