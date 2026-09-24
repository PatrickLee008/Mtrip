/**
 * 订单详情:状态/商品/金额/联系人 + 操作(余额支付/取消/退款/核销码)
 *
 * 支付本期只开通 mTrip 钱包余额(真扣款并落流水);Stripe / PayPal 置灰只弹 Coming soon。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { applyRefund, cancelOrder, fetchOrderDetail, fetchVerifyCode } from '@/api/order';
import { payOrder } from '@/api/pay';
import { apiTripPay } from '@/api/trip';
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
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import type { OrderDetail, VerifyCodeData } from '@/types/models';
import { formatDate, formatMoney } from '@/utils/format';
import { isNotEmpty } from '@/utils/validate';

export default function OrderDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>();
  const orderId = route.params.orderId;
  const showToast = useCommonStore((s) => s.showToast);
  const currency = useSiteStore((s) => s.currency);
  const profile = useUserStore((s) => s.profile);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const balance = Number(profile?.balance ?? 0);

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
      /* 待支付订单要按余额决定能不能付,本地缓存的资料可能是旧的,顺手刷一次 */
      if (data.order_status === ORDER_STATUS.PENDING) {
        void refreshProfile().catch(() => undefined);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [orderId, refreshProfile]);

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

  const comingSoon = () => showToast(t('home.comingSoon'));

  /**
   * 余额支付:前置比一次余额(后端同样会拦),成功后刷新本地余额。
   * Trip 内的预订后端只收整单支付(`trip/pay`),这里的 `pay_amount` 只是其中一笔,
   * 拿它比余额不准,所以 Trip 单跳过前置比较、交给后端按整单金额判断。
   */
  const payByBalance = async () => {
    if (acting) return;
    const tripId = Number(order.trip_id) || 0;
    if (tripId === 0 && balance < Number(order.pay_amount)) {
      showToast(t('order.balanceInsufficient'));
      return;
    }
    await act(async () => {
      if (tripId > 0) await apiTripPay({ tripId, payMethod: 3 });
      else await payOrder(orderId);
      void refreshProfile().catch(() => undefined);
    });
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
          <Text style={styles.balanceLine}>
            {t('order.walletBalance', { amount: formatMoney(balance, currency) })}
          </Text>
          <CustomButton
            title={t('order.payBalance')}
            loading={acting}
            onPress={() => void payByBalance()}
          />
          <View style={styles.actionGap} />
          {/* 未开通渠道:整块置灰,标一行 Coming soon,点按只提示(按钮高度固定,文案不并排以免顶破) */}
          <View style={styles.soonBlock}>
            <Text style={styles.soonLabel}>{t('home.comingSoon')}</Text>
            <CustomButton title={t('order.payStripe')} type="default" onPress={comingSoon} />
            <View style={styles.actionGap} />
            <CustomButton title={t('order.payPaypal')} type="default" onPress={comingSoon} />
          </View>
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
  balanceLine: {
    marginBottom: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  soonBlock: { opacity: 0.5 },
  soonLabel: { marginBottom: spacing.xs, fontSize: fontSize.xs, color: colors.textSecondary },
});
