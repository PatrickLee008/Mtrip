/**
 * 取消预订(Figma `1205:2159` Cancel Booking 退款摘要 → `1205:2480` Cancel Booking2 取消原因)
 *
 * **一个路由内两步**(与订房向导同一做法):
 *   step 1 `summary` —— 截止提示 + 预订摘要 + REFUND SUMMARY(取消费/退款额/退款去向/到账时效)
 *                       → 「Proceed With Cancellation」进第 2 步 /「Keep My Booking」放弃
 *   step 2 `reason`  —— REASON FOR CANCELLATION 单选 + 政策提示 → 吸底「Back / Continue」提交
 * 先看钱、再选原因、最后提交:金额在承诺之前给到,且符合 PRD
 * 「must select one cancellation reason before confirming」(line 711-712)。
 *
 * **取消粒度按 PRD:按 booking(一单),不是按 Trip**
 *   - PRD §1.1 line 110「Users may cancel individual hotel bookings」
 *   - line 142「Refund applies only to the cancelled or failed booking」
 *   - line 145「Other hotel bookings under the same Trip shall not be affected」
 *   所以本页永远只处理**一个 `orderId`**;多房间/多酒店要取消多间就各进各的详情页取消。
 *
 * **金额一律由服务端给**(`order/refund/quote`):取消费 = 实付 − 按退改规则可退;
 * 退款额 = 可退 − 平台费(PRD 模块 11:结账不收平台费,取消时才从可退额里扣)。
 * 前端不自己算 —— 与订房流程「抵扣额一律服务端给」同一条约定。
 *
 * 提交走 `order/refund/apply`(已支付订单的退款申请);**待支付订单不该走到这里**
 * (那种是 `order/cancel`,由订单详情页处理),所以入口只在已支付的预订上给。
 *
 * 设计稿实测:
 *   页面   `--background` 底;顶栏悬浮 y=54:← +「Cancel Booking」Outfit 600/24 主色(无右侧按钮)
 *   Main   pt16 px16 gap32 pb108
 *   截止卡 `rgba(255,218,214,.2)` 底 + 左 4px `--tertiary` 描边 + 圆角 24 + pl28/pr24/py24;
 *          20x24 图标 + 标题 Inter 600/14 `--tertiary` + 说明 Inter 400/16 `#434655`
 *   摘要   标题 Inter 600/20 +(共用)`BookingSummaryCard`
 *   退款卡 `--tab` 1px `--secondary` 圆角 24 p25 gap16:标题 Inter 600/20 大写;
 *          两行键值(取消费为 `#BA1A1A` 负数)→ 1px `rgba(196,197,215,.3)` 线 →
 *          Refund Amount 18/27 + 金额(货币 20/30 常规 + 数字 800 20/30 主色);
 *          两张 `#ECF5FE` 圆角 20 p16 提示块(退款去向 / 到账时效)
 *   按钮   主色整宽 py16 圆角 12「Proceed With Cancellation」/ 1px 主色描边「Keep My Booking」(字 `#204DDA`)
 *   底部   「Need help? Contact Support」Inter 500/12,后半段主色下划线
 *   原因步 单选卡:白底圆角 16 p16,20 方框(选中实心主色)+ Inter 400/16;
 *          政策提示卡 `#DDE5FF` 底 + 左 4px 主色 + 圆角 16;
 *          吸底 Back(描边)/ Continue(主色)
 *
 * ⚠️ 稿面第 2 步的原因是**写死的 5 条**(含拼写 "Trave dates changed"),后端 `reason` 收自由文本,
 *   这里按稿给 5 个选项 + i18n 文案(拼写已修正),提交时把选中项的英文原文发上去。
 * ⚠️ 稿面底部画了底部 Tab 栏,本页是 stack 页不在 Tab 内,没有那一条。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { applyRefund, fetchOrderDetail, fetchRefundQuote, type RefundQuote } from '@/api/order';
import { tempCoverFor } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import BookingSummaryCard from '@/components/order/BookingSummaryCard';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import type { OrderDetail } from '@/types/models';
import { formatDate, formatMoney } from '@/utils/format';

/** 稿面写死的 5 条取消原因;`value` 是提交给后端的英文原文,`key` 只用于 i18n */
const REASONS = [
  { key: 'plans', value: 'Change of plans' },
  { key: 'dates', value: 'Travel dates changed' },
  { key: 'price', value: 'Found better price elsewhere' },
  { key: 'health', value: 'Health issues / Emergency' },
  { key: 'others', value: 'Others' },
] as const;

export default function CancelBookingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CancelBooking'>>();
  const insets = useSafeAreaInsets();
  const currency = useSiteStore((s) => s.currency);
  const showToast = useCommonStore((s) => s.showToast);

  const { orderId } = route.params;
  const [step, setStep] = useState<'summary' | 'reason' | 'review'>('summary');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [quote, setQuote] = useState<RefundQuote | null>(null);
  const [reason, setReason] = useState<string>('');
  /** 稿面 `1205:2378`「Additional Comments (Optional)」;提交时拼在原因后面一起发 */
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, q] = await Promise.all([fetchOrderDetail(orderId), fetchRefundQuote(orderId)]);
      setOrder(detail);
      setQuote(q);
      setError('');
    } catch (e) {
      /* 后端会明确告诉为什么不能退(如「仅已支付且未使用的订单可预览退款」),原样展示 */
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      /* 备注拼在原因后面 —— 后端 `reason` 是一段自由文本(500 字上限),没有单独的备注字段 */
      const text = comments.trim() ? `${reason} - ${comments.trim()}` : reason;
      const { refundNo } = await applyRefund({ orderId, reason: text });
      /* 取消成功页(`1205:2679`);用 replace,免得返回又回到取消流程里 */
      navigation.replace('BookingCancelled', {
        orderId,
        refundNo,
        refundAmount: quote?.refundAmount ?? 0,
        hotelName: order?.goods_name,
        dateRange,
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingView />;
  if (error || !order || !quote) return <ErrorView message={error} onRetry={() => void load()} />;

  const dateRange = order.use_date
    ? `${formatDate(order.use_date)}${order.end_date ? ` - ${formatDate(order.end_date)}` : ''}`
    : '-';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.main,
          { paddingTop: insets.top + 80, paddingBottom: (step === 'reason' ? 120 : 32) + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {step === 'summary' ? (
          <>
            {/* 截止提示 1205:2307 —— 取消费 > 0 才出(免费取消期内不吓唬用户) */}
            {quote.cancellationFee > 0 ? (
              <View style={styles.deadline}>
                <HomeIcon name="infoCircle" width={20} height={24} color={colors.hot} />
                <View style={styles.flexCol}>
                  <Text style={styles.deadlineTitle}>{t('order.cancel.deadlineTitle')}</Text>
                  <Text style={styles.deadlineDesc}>{t('order.cancel.deadlineDesc')}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.group}>
              <Text style={styles.sectionTitle}>{t('order.cancel.bookingDetails')}</Text>
              <BookingSummaryCard
                cover={tempCoverFor(0)}
                hotelName={order.goods_name}
                dateRange={dateRange}
                amount={formatMoney(quote.payAmount, currency)}
              />
            </View>

            {/* 退款摘要 1205:2208 —— 三个数字全部来自服务端试算 */}
            <View style={styles.refundCard}>
              <Text style={styles.refundTitle}>{t('order.cancel.refundSummary')}</Text>
              <View style={styles.refundRows}>
                <Row label={t('order.cancel.originalAmount')} value={formatMoney(quote.payAmount, currency)} />
                <Row
                  label={t('order.cancel.cancellationFee')}
                  value={`-${formatMoney(quote.cancellationFee, currency)}`}
                  danger
                />
                {quote.platformFee > 0 ? (
                  <Row
                    label={t('order.cancel.platformFee')}
                    value={`-${formatMoney(quote.platformFee, currency)}`}
                    danger
                  />
                ) : null}
                <View style={styles.refundDivider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t('order.cancel.refundAmount')}</Text>
                  <Text style={styles.totalValue}>{formatMoney(quote.refundAmount, currency)}</Text>
                </View>
              </View>

              <Note
                icon="wallet"
                title={t('order.cancel.refundMethod')}
                desc={t('order.cancel.refundMethodDesc')}
              />
              <Note
                icon="clock"
                title={t('order.cancel.refundTimeline')}
                desc={t('order.cancel.refundTimelineDesc')}
              />
            </View>

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => setStep('reason')}
              >
                <Text style={styles.primaryBtnText}>{t('order.cancel.proceed')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.ghostBtnText}>{t('order.cancel.keep')}</Text>
              </Pressable>
            </View>

            <Text style={styles.help}>
              {t('order.cancel.needHelp')}
              <Text style={styles.helpLink} onPress={() => showToast(t('home.comingSoon'))}>
                {t('order.cancel.contactSupport')}
              </Text>
            </Text>
          </>
        ) : (
          <>
            {/* 取消原因 1205:2480 —— PRD 要求提交前必须选一条 */}
            <Text style={styles.reasonTitle}>{t('order.cancel.reasonTitle')}</Text>
            <View style={styles.reasonList}>
              {REASONS.map((item) => {
                const checked = reason === item.value;
                return (
                  <Pressable
                    key={item.key}
                    style={({ pressed }) => [styles.reasonRow, pressed && styles.pressed]}
                    onPress={() => setReason(item.value)}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                      {checked ? <View style={styles.checkboxDot} /> : null}
                    </View>
                    <Text style={styles.reasonText}>{t(`order.cancel.reasons.${item.key}`)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Additional Comments(选填)1205:2378 —— 稿面在选中 Others 时最有用,但任何原因都可填 */}
            <View style={styles.commentsGroup}>
              <Text style={styles.commentsLabel}>{t('order.cancel.commentsLabel')}</Text>
              <TextInput
                style={styles.commentsInput}
                value={comments}
                onChangeText={setComments}
                placeholder={t('order.cancel.commentsPlaceholder')}
                placeholderTextColor={colors.textSoft}
                multiline
                maxLength={400}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.policyCard}>
              <View style={styles.policyIcon}>
                <HomeIcon name="infoSmall" size={13} color="#FFFFFF" />
              </View>
              <View style={styles.flexCol}>
                <Text style={styles.policyTitle}>{t('order.cancel.policyTitle')}</Text>
                <Text style={styles.policyDesc}>{t('order.cancel.policyDesc')}</Text>
              </View>
            </View>
          </>
        )}

        {step === 'review' ? (
          <>
            {/* Review Cancellation 572:4670 */}
            <View style={styles.reviewHeader}>
              <View style={styles.reviewBadge}>
                <HomeIcon name="calendar2" size={44} color={colors.primary} />
              </View>
              <Text style={styles.reviewTitle}>{t('order.cancel.reviewTitle')}</Text>
              <Text style={styles.reviewDesc}>{t('order.cancel.reviewDesc')}</Text>
            </View>

            <View style={styles.group}>
              <Text style={styles.sectionTitle}>{t('order.cancel.bookingDetails')}</Text>
              <BookingSummaryCard
                cover={tempCoverFor(0)}
                hotelName={order.goods_name}
                dateRange={dateRange}
                amount={formatMoney(quote.payAmount, currency)}
              />
            </View>

            <View style={styles.refundCard}>
              <Text style={styles.refundTitle}>{t('order.cancel.refundSummary')}</Text>
              <View style={styles.refundRows}>
                <Row label={t('order.cancel.originalAmount')} value={formatMoney(quote.payAmount, currency)} />
                <Row
                  label={t('order.cancel.cancellationFee')}
                  value={`-${formatMoney(quote.cancellationFee, currency)}`}
                  danger
                />
                <View style={styles.refundDivider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t('order.cancel.refundAmount')}</Text>
                  <Text style={styles.totalValue}>{formatMoney(quote.refundAmount, currency)}</Text>
                </View>
              </View>
              {/* 稿面这一页把退款去向与时效并成一条(`1205:2404`) */}
              <Note icon="wallet" title={t('order.cancel.refundMethod')} desc={t('order.cancel.refundNote')} />
            </View>

            {/* Final Notice 1205:2663 —— 这句「不可撤销 + 罚金不退」是这一页存在的理由 */}
            <View style={styles.finalNotice}>
              <HomeIcon name="alert" width={22} height={21} color="#856404" />
              <View style={styles.flexCol}>
                <Text style={styles.finalTitle}>{t('order.cancel.finalNoticeTitle')}</Text>
                <Text style={styles.finalDesc}>
                  {t('order.cancel.finalNoticeDesc', {
                    fee: formatMoney(quote.cancellationFee + quote.platformFee, currency),
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.dangerBtn, submitting && styles.disabled, pressed && styles.pressed]}
                disabled={submitting}
                onPress={() => void submit()}
              >
                <Text style={styles.primaryBtnText}>
                  {submitting ? t('common.loading') : t('order.cancel.confirm')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.ghostBtnText}>{t('order.cancel.keep')}</Text>
              </Pressable>
            </View>

            <Text style={styles.terms}>{t('order.cancel.terms')}</Text>
          </>
        ) : null}
      </ScrollView>

      {/* 原因步的吸底 Back / Continue(稿面 `1205:2665`) */}
      {step === 'reason' ? (
        <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => setStep('summary')}
          >
            <HomeIcon name="arrowLeft" size={16} color={colors.primary} />
            <Text style={styles.backText}>{t('order.cancel.back')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              (!reason || submitting) && styles.disabled,
              pressed && !!reason && styles.pressed,
            ]}
            disabled={!reason || submitting}
            /* 稿面第 2 步的 Continue 只是进确认页,真正提交在 `review` 那一步 */
            onPress={() => setStep('review')}
          >
            <Text style={styles.continueText}>
              {submitting ? t('common.loading') : t('order.cancel.continue')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* 悬浮顶栏 1205:2243(声明在滚动容器之后) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.topBack, pressed && styles.pressed]}
          onPress={() =>
            step === 'review' ? setStep('reason') : step === 'reason' ? setStep('summary') : navigation.goBack()
          }
          hitSlop={8}
        >
          <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          <Text style={styles.topTitle}>{t('order.cancel.title')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 退款摘要里的一行键值 */
function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, danger && styles.rowValueDanger]}>{value}</Text>
    </View>
  );
}

/** `#ECF5FE` 提示块(退款去向 / 到账时效) */
function Note({ icon, title, desc }: { icon: 'wallet' | 'clock'; title: string; desc: string }) {
  return (
    <View style={styles.note}>
      <HomeIcon name={icon} size={20} color={colors.heading} />
      <View style={styles.flexCol}>
        <Text style={styles.noteTitle}>{title}</Text>
        <Text style={styles.noteDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  main: { paddingHorizontal: PAGE_PADDING, gap: 32 },
  flexCol: { flex: 1, minWidth: 0 },
  group: { gap: 8 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },

  /* ---- 悬浮顶栏 ---- */
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  topBack: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  topTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },

  /* ---- 截止提示 ---- */
  deadline: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingLeft: 28,
    paddingRight: 24,
    paddingVertical: 24,
    borderRadius: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.hot,
    backgroundColor: 'rgba(255, 218, 214, 0.2)',
  },
  deadlineTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.hot,
  },
  deadlineDesc: { paddingTop: 4, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.muted },

  sectionTitle: {
    paddingHorizontal: 4,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },

  /* ---- 退款摘要 ---- */
  refundCard: {
    width: '100%',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  refundTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    textTransform: 'uppercase',
    color: colors.heading,
  },
  refundRows: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.muted },
  rowValue: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#0B1C30' },
  rowValueDanger: { color: '#BA1A1A' },
  refundDivider: { height: 1, backgroundColor: 'rgba(196, 197, 215, 0.3)' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  totalLabel: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 27, color: '#0B1C30' },
  /* 稿面货币是常规字重、数字 ExtraBold;项目没装 Inter 800 → 用 700 顶替 */
  totalValue: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 30, color: colors.primary },

  note: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#ECF5FE',
  },
  noteTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  noteDesc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 24, color: colors.textSoft },

  /* ---- 摘要步的按钮 ---- */
  actions: { width: '100%', gap: 16 },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghostBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#204DDA',
  },
  help: {
    paddingTop: 8,
    textAlign: 'center',
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.heading,
  },
  helpLink: { fontFamily: fonts.interSemi, color: colors.primary, textDecorationLine: 'underline' },

  /* ---- 原因步 ---- */
  reasonTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    textTransform: 'uppercase',
    color: colors.heading,
  },
  reasonList: { gap: 12 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: '#F4F6FF',
  },
  checkboxOn: { borderColor: colors.primary },
  checkboxDot: { width: 12, height: 12, borderRadius: 2, backgroundColor: colors.primary },
  reasonText: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.heading },

  policyCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: '#DDE5FF',
  },
  policyIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  policyTitle: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.heading },
  policyDesc: { paddingTop: 2, fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.muted },

  /* ---- Additional Comments(1205:2378)---- */
  commentsGroup: { gap: 8 },
  commentsLabel: { fontFamily: fonts.interSemi, fontSize: 14, lineHeight: 20, color: colors.textSoft },
  commentsInput: {
    minHeight: 120,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },

  /* ---- Review Cancellation(572:4670)---- */
  reviewHeader: { alignItems: 'center', gap: 12 },
  /* 稿面是一枚等距 3D 图标模块;项目没有那张图 → 主色 10% 圆角方块 + 日历字形顶替 */
  reviewBadge: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  reviewTitle: {
    width: '100%',
    fontFamily: fonts.interBold,
    fontSize: 28,
    lineHeight: 40,
    textAlign: 'center',
    color: colors.heading,
  },
  reviewDesc: {
    width: '100%',
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },
  finalNotice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFD666',
    backgroundColor: '#FFF9E6',
  },
  finalTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#856404',
  },
  finalDesc: { paddingTop: 4, fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#856404' },
  /* 稿面确认按钮是 --tertiary 红底(`1205:2415`),与「保留预订」形成明确分量差 */
  dangerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.hot,
  },
  terms: {
    textAlign: 'center',
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
  },

  /* ---- 原因步吸底 ---- */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 16,
    backgroundColor: colors.surface,
  },
  backBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  backText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  continueBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  continueText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
});
