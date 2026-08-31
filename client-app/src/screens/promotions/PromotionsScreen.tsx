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
 * 后端还没有活动/优惠券接口,内容走 promoSections.ts 的设计稿静态数据;
 * 领取/使用/添加促销码一律 comingSoon,只有「领取」按设计稿弹一次成功提示。
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import PromoDialog from '@/components/promotion/PromoDialog';
import PromoTabs, { type PromoTab } from '@/components/promotion/PromoTabs';
import { promoShared } from '@/components/promotion/promoShared';
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import CouponsTab from '@/screens/promotions/CouponsTab';
import PromotionsTab from '@/screens/promotions/PromotionsTab';
import { HOW_TO_USE_STEPS, type DemoCoupon } from '@/screens/promotions/promoSections';
import { useCommonStore } from '@/store/commonStore';

export default function PromotionsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);

  const [tab, setTab] = useState<PromoTab>('promotions');
  const [howToUse, setHowToUse] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const comingSoon = () => showToast(t('home.comingSoon'));

  const onCouponAction = (coupon: DemoCoupon) => {
    // 设计稿只给了「领取」的成功弹层;「立即使用」要跳到可用商品,后端未接故走 comingSoon
    if (coupon.state === 'claim') {
      setClaimed(true);
      return;
    }
    comingSoon();
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
        >
          <PromoTabs value={tab} onChange={setTab} />

          {tab === 'promotions' ? (
            <PromotionsTab
              onCouponPress={() => navigation.navigate('CouponDetail')}
              onCouponAction={onCouponAction}
              onBookHotels={() => navigation.navigate('Hotels')}
            />
          ) : (
            <CouponsTab
              onCouponPress={() => navigation.navigate('CouponDetail')}
              onCouponAction={onCouponAction}
              onAddCode={comingSoon}
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
