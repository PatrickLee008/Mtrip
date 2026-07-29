/**
 * 确认订单:日期/数量/联系人 → 创建订单(状态待支付)后进订单详情支付
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchGoodsDetail } from '@/api/goods';
import { createOrder } from '@/api/order';
import PriceText from '@/components/business/PriceText';
import CustomButton from '@/components/common/CustomButton';
import CustomInput from '@/components/common/CustomInput';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import PageLayout from '@/components/layout/PageLayout';
import { GOODS_TYPE } from '@/config/global';
import { colors, fontSize, radius, spacing } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import type { GoodsDetail, GoodsSku } from '@/types/models';
import { formatDate } from '@/utils/format';
import { isMobile, isNotEmpty } from '@/utils/validate';

/** 今天起第 offset 天(本地时区) */
function dayAfter(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return formatDate(d);
}

/** 两个日期间隔晚数 */
function nightsBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(Math.round(ms / 86400000), 0);
}

export default function OrderConfirmScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderConfirm'>>();
  const { goodsId, skuId } = route.params;
  const showToast = useCommonStore((s) => s.showToast);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [useDate, setUseDate] = useState(dayAfter(1));
  const [endDate, setEndDate] = useState(dayAfter(2));
  const [quantity, setQuantity] = useState(1);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGoodsDetail(goodsId);
      setDetail(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [goodsId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sku: GoodsSku | undefined = detail?.skus.find((s) => s.id === skuId);
  const isHotel = detail?.goods_type === GOODS_TYPE.HOTEL;

  /** 预估总价:酒店=基础价×晚数×间数,门票=基础价×数量(实际以后端日历价为准) */
  const estimated = useMemo(() => {
    if (!sku) return 0;
    const unit = Number(sku.base_price);
    if (isHotel) return unit * nightsBetween(useDate, endDate) * quantity;
    return unit * quantity;
  }, [sku, isHotel, useDate, endDate, quantity]);

  if (loading) return <LoadingView />;
  if (error || !detail || !sku) return <ErrorView message={error} onRetry={() => void load()} />;

  const submit = async () => {
    if (!isNotEmpty(contactName)) {
      showToast(t('order.contactName'));
      return;
    }
    if (!isMobile(contactPhone)) {
      showToast(t('user.invalidMobile'));
      return;
    }
    if (isHotel && nightsBetween(useDate, endDate) < 1) {
      showToast(t('order.endDate'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await createOrder({
        goodsId,
        skuId,
        quantity,
        useDate,
        endDate: isHotel ? endDate : undefined,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        remark: remark.trim() || undefined,
      });
      showToast(t('common.success'));
      navigation.replace('OrderDetail', { orderId: result.orderId });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <View style={styles.flex}>
        <PageLayout scrollable edges={[]} padded>
          <View style={styles.card}>
            <Text style={styles.goodsName} numberOfLines={2}>
              {detail.goods_name}
            </Text>
            <Text style={styles.skuName}>{sku.room_name ?? sku.ticket_name ?? `#${sku.id}`}</Text>
          </View>

          <View style={styles.card}>
            <CustomInput
              label={t('order.useDate')}
              value={useDate}
              onChangeText={setUseDate}
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />
            {isHotel ? (
              <CustomInput
                label={t('order.endDate')}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                maxLength={10}
              />
            ) : null}
            <Text style={styles.label}>{t('order.quantity')}</Text>
            <View style={styles.stepper}>
              <Pressable
                style={[styles.stepBtn, quantity <= 1 && styles.stepDisabled]}
                disabled={quantity <= 1}
                onPress={() => setQuantity((q) => Math.max(q - 1, 1))}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>{quantity}</Text>
              <Pressable style={styles.stepBtn} onPress={() => setQuantity((q) => q + 1)}>
                <Text style={styles.stepText}>＋</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <CustomInput
              label={t('order.contactName')}
              value={contactName}
              onChangeText={setContactName}
              maxLength={50}
            />
            <CustomInput
              label={t('order.contactPhone')}
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              maxLength={20}
            />
            <CustomInput
              label={t('order.remark')}
              value={remark}
              onChangeText={setRemark}
              multiline
              maxLength={200}
            />
          </View>
        </PageLayout>
        <View style={styles.footer}>
          <View style={styles.totalWrap}>
            <Text style={styles.totalLabel}>{t('order.totalAmount')}</Text>
            <PriceText amount={estimated} />
          </View>
          <View style={styles.submitWrap}>
            <CustomButton title={t('order.submitOrder')} loading={submitting} onPress={() => void submit()} />
          </View>
        </View>
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  goodsName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  skuName: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.textSecondary },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  stepDisabled: { opacity: 0.4 },
  stepText: { fontSize: fontSize.lg, color: colors.text },
  stepValue: {
    minWidth: 48,
    textAlign: 'center',
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  totalWrap: { flexDirection: 'row', alignItems: 'flex-end', flex: 1 },
  totalLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing.xs },
  submitWrap: { width: 140 },
});
