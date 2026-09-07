/**
 * 优惠券详情(按 Figma M-Trip / Promotion Page - Coupons `1625:2009` 实现)
 *
 * 自上而下:券信息卡(品类 + 有效期 + 金额 + 角标 + 券码框)→ 活动介绍 → 条款与条件 → 立即使用。
 *
 * 设计稿实测:
 *   券信息卡 与其余几张同壳,padding 24、gap 32;品类行 Inter 600/16 主色 + 20 图标
 *            金额 Inter 600/24(数字深色 + OFF 主色),角标同券卡的胶囊
 *   券码框   #E6EFF8 底、圆角 12、padding 16;码 Inter 700/24;右侧 40 白色圆钮内 14.17x16.67 复制图标
 *   两张文本卡 padding 24,标题 Heading 3(Inter 600/14 大写 tracking 1.4)
 *
 * 数据(C-M6.1):
 *   路由带 `receiveId`(我的券)或 `couponId`(未领取的券模板)时拉 `/marketing/coupon/detail`,
 *   字段口径与领券中心、我的券完全一致(后端 CouponView 统一产出)。
 *   两个参数都没有 = 未登录场景的设计稿走查,回落 promoSections.ts 的 COUPON_DETAIL 静态数据。
 *
 * 与设计稿的差异(均因设计稿没画、而真实券必须说清楚):
 *   - 「条款与条件」在有真实券时改为**由券数据生成的条目**(门槛/封顶/适用酒店房型/叠加规则),
 *     不再显示设计稿那四条与本券无关的通用文案。
 *   - 未领取的券底部按钮是「立即领取」而不是「立即使用」;不可领/不可用时按钮禁用并显示原因。
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { claimCoupon, fetchCouponDetail } from '@/api/marketing';
import HomeIcon from '@/components/home/HomeIcon';
import { promoShared } from '@/components/promotion/promoShared';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  actionOf,
  categoryOf,
  discountTitle,
  expiryText,
  reasonText,
  thresholdText,
} from '@/screens/promotions/couponFormat';
import { CATEGORY_ICONS, COUPON_DETAIL } from '@/screens/promotions/promoSections';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import type { CouponView } from '@/types/models';
import { formatMoney } from '@/utils/format';

export default function CouponDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CouponDetail'>>();
  const showToast = useCommonStore((s) => s.showToast);
  const currency = useSiteStore((s) => s.currency);

  const receiveId = route.params?.receiveId ?? 0;
  const couponId = route.params?.couponId ?? 0;
  const hasParams = receiveId > 0 || couponId > 0;

  const [coupon, setCoupon] = useState<CouponView | null>(null);
  const [loading, setLoading] = useState(hasParams);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    if (!hasParams) return;
    setLoading(true);
    try {
      const data = await fetchCouponDetail(
        receiveId > 0 ? { receiveId } : { couponId },
      );
      setCoupon(data);
    } catch {
      // request.ts 已 Toast;这里退回静态兜底,不留白屏
      setCoupon(null);
    } finally {
      setLoading(false);
    }
  }, [hasParams, receiveId, couponId]);

  // 领完券要立刻看到券码,故用 useFocusEffect 而非 useEffect
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** 展示值:有真实券用真实券,否则回落设计稿静态数据 */
  const view = useMemo(() => {
    if (coupon) {
      const action = actionOf(coupon.status);
      return {
        category: categoryOf(coupon),
        expiry: expiryText(coupon, t),
        amount: discountTitle(coupon, t, currency),
        badge: null as string | null,
        code: coupon.coupon_code,
        codeLabel: coupon.coupon_code ? t('promotions.coupon.codeLabel') : '',
        name: coupon.coupon_name,
        desc: coupon.remark || thresholdText(coupon, t, currency),
        terms: buildTerms(coupon, t, currency),
        action,
        actionLabel:
          action === 'claim'
            ? t('promotions.coupon.actions.claim')
            : action === 'use'
              ? t('promotions.detail.cta')
              : reasonText(coupon.unusableReason, t),
        disabled: action !== 'claim' && action !== 'use',
      };
    }
    return {
      category: COUPON_DETAIL.category,
      expiry: t('promotions.coupon.expiry', { date: COUPON_DETAIL.expiry }),
      amount: `${t('promotions.detail.amount')} ${t('promotions.detail.off')}`,
      badge: t(`promotions.coupon.badges.${COUPON_DETAIL.badge}`),
      code: COUPON_DETAIL.code,
      codeLabel: t('promotions.coupon.codeLabel'),
      name: t('promotions.detail.descriptionTitle'),
      desc: t('promotions.detail.body'),
      terms: COUPON_DETAIL.termsKeys.map((key) => t(`promotions.detail.terms.${key}`)),
      action: 'use' as const,
      actionLabel: t('promotions.detail.cta'),
      disabled: false,
    };
  }, [coupon, t, currency]);

  const copyCode = async () => {
    if (!view.code) return;
    await Clipboard.setStringAsync(view.code);
    showToast(t('promotions.coupon.copied'));
  };

  const onAction = async () => {
    if (view.action === 'claim' && coupon) {
      setClaiming(true);
      try {
        await claimCoupon(coupon.coupon_id);
        showToast(t('promotions.claimAlert.title'));
        await load();
      } catch {
        // 领取失败的原因由 request.ts 弹后端提示
      } finally {
        setClaiming(false);
      }
      return;
    }
    // 立即使用:跳酒店搜索(目前只有酒店品类可下单)
    navigation.navigate('Hotels');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && promoShared.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.title}>{t('promotions.detail.title')}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.main}
            showsVerticalScrollIndicator={false}
          >
            <View style={[promoShared.panel, styles.heroPanel]}>
              <View style={styles.heroHead}>
                <View style={styles.categoryRow}>
                  <HomeIcon name={CATEGORY_ICONS[view.category]} size={20} color={colors.primary} />
                  <Text style={styles.category}>
                    {t(`promotions.coupon.categories.${view.category}`)}
                  </Text>
                </View>

                <View style={styles.expiryRow}>
                  <HomeIcon name="clock" size={11.2} color={colors.textSoft} />
                  <Text style={styles.expiry}>{view.expiry}</Text>
                </View>

                <View style={styles.amountRow}>
                  <Text style={styles.amount}>{view.amount}</Text>
                </View>

                {view.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{view.badge}</Text>
                  </View>
                ) : null}
              </View>

              {/* 券码只有领取之后才有;未领取的券模板不展示空码框 */}
              {view.code ? (
                <View style={styles.codeBlock}>
                  <Text style={styles.codeLabel}>{view.codeLabel}</Text>
                  <View style={styles.codeBox}>
                    <Text style={styles.code}>{view.code}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.copyBtn, pressed && promoShared.pressed]}
                      accessibilityLabel={t('promotions.coupon.copy')}
                      onPress={() => void copyCode()}
                    >
                      <HomeIcon name="copy" width={14.167} height={16.667} color={colors.heading} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={[promoShared.panel, styles.textPanel]}>
              <Text style={promoShared.panelTitle}>{t('promotions.detail.descriptionTitle')}</Text>
              <Text style={promoShared.body}>{view.desc}</Text>
            </View>

            <View style={[promoShared.panel, styles.textPanel]}>
              <Text style={promoShared.panelTitle}>{t('promotions.terms.title')}</Text>
              <View style={styles.termsList}>
                {view.terms.map((item) => (
                  <View key={item} style={promoShared.bulletItem}>
                    <View style={promoShared.bulletDot} />
                    <Text style={[promoShared.body, styles.termsText]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                promoShared.cta,
                view.disabled && styles.ctaDisabled,
                pressed && !view.disabled && promoShared.pressed,
              ]}
              disabled={view.disabled || claiming}
              onPress={() => void onAction()}
            >
              {claiming ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={promoShared.ctaText}>{view.actionLabel}</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * 条款条目:全部由券字段如实生成(门槛 → 封顶 → 适用酒店 → 适用房型 → 叠加规则 → 有效期),
 * 与结账页解释「为什么不能用」的口径同源。
 */
function buildTerms(coupon: CouponView, t: TFunction, currency: string): string[] {
  const terms: string[] = [];
  terms.push(thresholdText(coupon, t, currency));
  if (coupon.coupon_type === 2 && coupon.max_discount > 0) {
    terms.push(
      t('promotions.detail.rules.maxDiscount', {
        amount: formatMoney(coupon.max_discount, currency),
      }),
    );
  }
  const hotels = coupon.applicable_hotels.map((h) => h.goods_name).filter(Boolean);
  if (hotels.length > 0) {
    terms.push(t('promotions.detail.rules.hotels', { list: hotels.join('、') }));
  } else if (coupon.goods_scope === 1) {
    terms.push(t('promotions.detail.rules.allHotels'));
  } else if (coupon.goods_scope === 0) {
    terms.push(t('promotions.detail.rules.allGoods'));
  }
  const rooms = coupon.applicable_rooms.map((r) => r.room_name).filter(Boolean);
  if (rooms.length > 0) {
    terms.push(t('promotions.detail.rules.rooms', { list: rooms.join('、') }));
  }
  terms.push(
    t(coupon.stackable === 1 ? 'promotions.detail.rules.stackable' : 'promotions.detail.rules.notStackable'),
  );
  if (coupon.valid_start && coupon.valid_end) {
    terms.push(
      t('promotions.detail.rules.period', {
        start: coupon.valid_start.slice(0, 10),
        end: coupon.valid_end.slice(0, 10),
      }),
    );
  }
  return terms;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },

  main: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 24,
  },
  loading: { paddingVertical: 40 },

  heroPanel: { gap: 32 },
  heroHead: { gap: 4, alignItems: 'flex-start' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  category: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 32,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expiry: { fontFamily: fonts.inter, fontSize: 11, lineHeight: 16.5, color: colors.textSoft },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  amount: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.heading },
  badge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.round,
    backgroundColor: colors.pageBg,
  },
  badgeText: { fontFamily: fonts.interBold, fontSize: 10, lineHeight: 15, color: colors.hot },

  codeBlock: { gap: 12.5 },
  codeLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSoft,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: radius.btn,
    /* 设计稿的券码底色,只在这一处出现,未进色板 */
    backgroundColor: '#E6EFF8',
  },
  code: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  copyBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    ...shadows.subtle,
  },

  textPanel: { gap: 16 },
  termsList: { gap: 12 },
  termsText: { flex: 1, minWidth: 0 },
  ctaDisabled: { opacity: 0.5 },
});
