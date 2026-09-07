/**
 * 优惠中心(按 Figma M-Trip / Promotion 1633:3300 重做)
 *
 * 设计稿这个 section 下是四张同页的稿:Promotion Page `1325:2123`(优惠活动)、
 * Promotion Page - Coupons `1429:2110`(我的优惠券)、How to use Overlay `1626:3207`、
 * Alert Overlay `1627:3239`。前两张只有 Main 的内容不同,故落成
 * 「一个壳(顶部栏 + 两段页签)+ 两个页签内容组件」,两个弹层共用 PromoDialog。
 * 券详情 `1625:2009` 是独立一页,见 CouponDetailScreen(路由 CouponDetail)。
 *
 * 设计稿实测:
 *   顶部栏 `--tab` 底 + Effect/DS 投影,px20 py16;标题 Outfit 600/24 主色,右侧 How To Use 12
 *   Main   px16 pt20 pb20,块间距 24
 *
 * 数据(C-M6.1):**登录后全部走 marketing-service 真实接口** ——
 * 活动 `/marketing/campaigns`、领券中心 `/marketing/coupon/available`、
 * 我的券 `/marketing/coupon/my`、领取 `/marketing/coupon/claim`、
 * 促销码兑换 `/marketing/coupon/redeem`。
 * promoSections.ts 的设计稿静态券**只留给未登录**(接口挂 UserAuthMiddleware,调了必 401),
 * 与「我的精选」对未登录/空态的处理一致 —— 登录后为空就给空态文案,不拿示例券冒充真实数据。
 *
 * 本页是常驻 Tab,刷新一律用 useFocusEffect(useEffect 只在挂载时跑一次,
 * 从券详情页领完券切回来会看到旧数据)。
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/request';
import {
  claimCoupon,
  fetchAvailableCoupons,
  fetchCampaigns,
  fetchMyCoupons,
  redeemPromoCode,
} from '@/api/marketing';
import { API_CODE } from '@/api/types';
import HomeIcon from '@/components/home/HomeIcon';
import PromoDialog from '@/components/promotion/PromoDialog';
import PromoTabs, { type PromoTab } from '@/components/promotion/PromoTabs';
import { promoShared } from '@/components/promotion/promoShared';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import CouponsTab from '@/screens/promotions/CouponsTab';
import PromotionsTab from '@/screens/promotions/PromotionsTab';
import { demoToCouponCard, toCouponCard } from '@/screens/promotions/couponFormat';
import {
  CLAIMED_COUPONS,
  HOW_TO_USE_STEPS,
  PROMO_SECTIONS,
} from '@/screens/promotions/promoSections';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import { useUserStore } from '@/store/userStore';
import type { CampaignItem, CouponView, MyCouponType } from '@/types/models';

/** 未登录时展示的设计稿示例券(三段合一,与登录后的两段列表结构对齐) */
const DEMO_COUPONS = PROMO_SECTIONS.flatMap((section) => section.coupons);

/** 促销码兑换失败:后端把原因拆成了独立错误码,这里逐码给文案 */
const REDEEM_ERROR_I18N: Record<number, string> = {
  [API_CODE.PROMO_CODE_NOT_FOUND]: 'promotions.promoCode.errors.notFound',
  [API_CODE.PROMO_CODE_EXPIRED]: 'promotions.promoCode.errors.expired',
  [API_CODE.PROMO_CODE_EXHAUSTED]: 'promotions.promoCode.errors.exhausted',
  [API_CODE.PROMO_CODE_DUPLICATED]: 'promotions.promoCode.errors.duplicated',
  [API_CODE.PROMO_CODE_INELIGIBLE]: 'promotions.promoCode.errors.ineligible',
};

export default function PromotionsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);
  const isLogin = useUserStore((s) => s.isLogin);
  const currency = useSiteStore((s) => s.currency);

  const [tab, setTab] = useState<PromoTab>('promotions');
  const [howToUse, setHowToUse] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [campaign, setCampaign] = useState<CampaignItem | null>(null);
  const [available, setAvailable] = useState<CouponView[]>([]);
  const [myType, setMyType] = useState<MyCouponType>('available');
  const [mine, setMine] = useState<CouponView[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isLogin) {
        setCampaign(null);
        setAvailable([]);
        setMine([]);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [campaigns, availablePage, minePage] = await Promise.all([
          fetchCampaigns(),
          fetchAvailableCoupons({ page: 1, pageSize: 50 }),
          fetchMyCoupons(myType, { page: 1, pageSize: 50 }),
        ]);
        // 设计稿只有一张活动横幅,取排序最前的展示中活动
        setCampaign(campaigns[0] ?? null);
        setAvailable(availablePage.list);
        setMine(minePage.list);
      } catch {
        // request.ts 已经统一 Toast 过一次,这里只负责把页面退回空态
        setCampaign(null);
        setAvailable([]);
        setMine([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLogin, myType],
  );

  /* 常驻 Tab:获焦即重拉(领完券从详情页返回、或在别处登录后切回来都要刷新) */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** 只重拉「我的券」(领取 / 兑换 / 切分类之后) */
  const reloadMine = useCallback(
    async (type: MyCouponType) => {
      if (!isLogin) return;
      setLoading(true);
      try {
        const page = await fetchMyCoupons(type, { page: 1, pageSize: 50 });
        setMine(page.list);
      } catch {
        setMine([]);
      } finally {
        setLoading(false);
      }
    },
    [isLogin],
  );

  const availableCards = useMemo(
    () =>
      isLogin
        ? available.map((view) => toCouponCard(view, t, currency))
        : DEMO_COUPONS.map((demo) => demoToCouponCard(demo, t)),
    [isLogin, available, t, currency],
  );

  const myCards = useMemo(
    () =>
      isLogin
        ? mine.map((view) => toCouponCard(view, t, currency))
        : CLAIMED_COUPONS.map((demo) => demoToCouponCard(demo, t)),
    [isLogin, mine, t, currency],
  );

  const requireLogin = () => {
    showToast(t('promotions.loginHint'));
    navigation.navigate('Login');
  };

  /** 领券:成功后弹设计稿的成功浮层,并刷新两个列表(已领的券要立刻出现在「我的券」) */
  const claim = async (view: CouponView) => {
    try {
      await claimCoupon(view.coupon_id);
      setClaimed(true);
      await load();
    } catch {
      // 领取失败(领完/限领/已下架)的原因由 request.ts 弹出后端提示
    }
  };

  /** 立即使用:跳酒店搜索 —— 目前只有酒店品类可下单,其余品类同样落到酒店入口 */
  const useCoupon = () => navigation.navigate('Hotels');

  const onAvailableAction = (index: number) => {
    if (!isLogin) return requireLogin();
    const view = available[index];
    if (!view) return;
    if (view.status === 'claimable') {
      void claim(view);
      return;
    }
    // 已领过的券在领券中心不会出现「立即使用」,其余状态按钮本身是禁用的
    useCoupon();
  };

  const onMineAction = (index: number) => {
    if (!isLogin) return requireLogin();
    const view = mine[index];
    if (!view) return;
    if (view.status === 'available') {
      useCoupon();
    }
  };

  const openDetail = (view?: CouponView) => {
    if (!view) {
      // 未登录:详情页没有可查的真实券,回落设计稿静态详情
      navigation.navigate('CouponDetail', undefined);
      return;
    }
    navigation.navigate(
      'CouponDetail',
      view.receive_id > 0 ? { receiveId: view.receive_id } : { couponId: view.coupon_id },
    );
  };

  /** 促销码兑换:成功切到「我的券」并高亮有效分类;失败按错误码给具体原因 */
  const addCode = async (code: string) => {
    if (!isLogin) return requireLogin();
    setRedeeming(true);
    try {
      const result = await redeemPromoCode(code);
      showToast(t('promotions.promoCode.success', { name: result.couponName }));
      setMyType('available');
      await Promise.all([load(), reloadMine('available')]);
    } catch (e) {
      const key = e instanceof ApiError ? REDEEM_ERROR_I18N[e.code] : undefined;
      // 有专属文案就覆盖 request.ts 弹过的后端中文提示;没有则不再重复弹
      if (key) showToast(t(key));
    } finally {
      setRedeeming(false);
    }
  };

  const changeMyType = (type: MyCouponType) => {
    setMyType(type);
    void reloadMine(type);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('promotions.title')}</Text>
          <Pressable onPress={() => setHowToUse(true)} hitSlop={8}>
            <Text style={styles.howToUse}>{t('promotions.howToUse')}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
        >
          <PromoTabs value={tab} onChange={setTab} />

          {tab === 'promotions' ? (
            <PromotionsTab
              loading={loading && available.length === 0}
              campaign={campaign}
              cards={availableCards}
              isLogin={isLogin}
              onCouponPress={(index) => openDetail(isLogin ? available[index] : undefined)}
              onCouponAction={onAvailableAction}
              onBookHotels={() => navigation.navigate('Hotels')}
            />
          ) : (
            <CouponsTab
              loading={loading && mine.length === 0}
              redeeming={redeeming}
              type={myType}
              onTypeChange={changeMyType}
              cards={myCards}
              isLogin={isLogin}
              onCouponPress={(index) => openDetail(isLogin ? mine[index] : undefined)}
              onCouponAction={onMineAction}
              onAddCode={(code) => void addCode(code)}
              onMoreCoupons={() => setTab('promotions')}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* 使用说明(设计稿 1626:3207):有序列表,序号由代码拼 */}
      <PromoDialog visible={howToUse} onClose={() => setHowToUse(false)}>
        <Text style={styles.dialogTitle}>{t('promotions.howToUseSheet.title')}</Text>
        <View style={styles.steps}>
          {HOW_TO_USE_STEPS.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <Text style={[promoShared.body, styles.stepIndex]}>{`${index + 1}.`}</Text>
              <Text style={[promoShared.body, styles.stepText]}>
                {t(`promotions.howToUseSheet.steps.${step}`)}
              </Text>
            </View>
          ))}
        </View>
      </PromoDialog>

      {/* 领券成功(设计稿 1627:3239) */}
      <PromoDialog visible={claimed} onClose={() => setClaimed(false)}>
        <View style={styles.alertBody}>
          <HomeIcon name="checkmarkCircle" size={60} color={colors.primary} />
          <Text style={styles.alertTitle}>{t('promotions.claimAlert.title')}</Text>
          <Text style={styles.alertDesc}>{t('promotions.claimAlert.desc')}</Text>
        </View>
      </PromoDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary,
  },
  howToUse: {
    fontFamily: fonts.outfitSemi,
    fontSize: 12,
    textAlign: 'right',
    color: colors.primary,
  },

  main: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 24,
  },

  dialogTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  steps: { gap: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepIndex: { lineHeight: 26, width: 20 },
  stepText: { flex: 1, minWidth: 0, lineHeight: 26 },

  alertBody: { alignItems: 'center', gap: 16 },
  alertTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: colors.primary,
  },
  alertDesc: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.heading,
  },
});
