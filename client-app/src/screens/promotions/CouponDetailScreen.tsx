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
 * 后端没有券详情接口,内容取 promoSections.ts 的 COUPON_DETAIL 静态数据;「立即使用」走 comingSoon。
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { promoShared } from '@/components/promotion/promoShared';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { CATEGORY_ICONS, COUPON_DETAIL } from '@/screens/promotions/promoSections';
import { useCommonStore } from '@/store/commonStore';

export default function CouponDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const showToast = useCommonStore((s) => s.showToast);

  const copyCode = async () => {
    await Clipboard.setStringAsync(COUPON_DETAIL.code);
    showToast(t('promotions.coupon.copied'));
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

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
        >
          <View style={[promoShared.panel, styles.heroPanel]}>
            <View style={styles.heroHead}>
              <View style={styles.categoryRow}>
                <HomeIcon
                  name={CATEGORY_ICONS[COUPON_DETAIL.category]}
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.category}>{t('promotions.campaign.category')}</Text>
              </View>

              <View style={styles.expiryRow}>
                <HomeIcon name="clock" size={11.2} color={colors.textSoft} />
                <Text style={styles.expiry}>
                  {t('promotions.coupon.expiry', { date: COUPON_DETAIL.expiry })}
                </Text>
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.amount}>{t('promotions.detail.amount')}</Text>
                <Text style={styles.amountOff}>{t('promotions.detail.off')}</Text>
              </View>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {t(`promotions.coupon.badges.${COUPON_DETAIL.badge}`)}
                </Text>
              </View>
            </View>

            <View style={styles.codeBlock}>
              <Text style={styles.codeLabel}>{t('promotions.coupon.codeLabel')}</Text>
              <View style={styles.codeBox}>
                <Text style={styles.code}>{COUPON_DETAIL.code}</Text>
                <Pressable
                  style={({ pressed }) => [styles.copyBtn, pressed && promoShared.pressed]}
                  accessibilityLabel={t('promotions.coupon.copy')}
                  onPress={() => void copyCode()}
                >
                  <HomeIcon name="copy" width={14.167} height={16.667} color={colors.heading} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={[promoShared.panel, styles.textPanel]}>
            <Text style={promoShared.panelTitle}>{t('promotions.detail.descriptionTitle')}</Text>
            <Text style={promoShared.body}>{t('promotions.detail.body')}</Text>
          </View>

          <View style={[promoShared.panel, styles.textPanel]}>
            <Text style={promoShared.panelTitle}>{t('promotions.terms.title')}</Text>
            <View style={styles.termsList}>
              {COUPON_DETAIL.termsKeys.map((key) => (
                <View key={key} style={promoShared.bulletItem}>
                  <View style={promoShared.bulletDot} />
                  <Text style={[promoShared.body, styles.termsText]}>
                    {t(`promotions.detail.terms.${key}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [promoShared.cta, pressed && promoShared.pressed]}
            onPress={() => showToast(t('home.comingSoon'))}
          >
            <Text style={promoShared.ctaText}>{t('promotions.detail.cta')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
  amountOff: { fontFamily: fonts.interSemi, fontSize: 24, lineHeight: 32, color: colors.primary },
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
});
