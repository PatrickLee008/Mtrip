/**
 * 优惠中心「优惠活动」页签(设计稿 1325:2123 Promotion Page 的 Main)
 *
 * 自上而下:活动横幅 → 活动概览卡 → 券列表 → 关于本活动 → 条款与条件 → 底部 CTA。
 * 设计稿实测的纵向间距:横幅↔概览卡 24;概览卡↔券列表 32;两段之间与关于/条款之间都是 40;
 * 段内标题↔卡片 16、卡片之间 16。
 *
 * 数据(C-M6.1):
 *   登录后走真实接口 —— 横幅/概览取 `/marketing/campaigns` 的首个展示中活动,
 *   券列表取 `/marketing/coupon/available`(领券中心)。设计稿把券分「每周/每月/酒店」三段,
 *   后端没有这个分组维度,故改为「可领取 / 已领完或不可领」两段 —— 不拿分组名硬套。
 *   未登录(接口挂 UserAuthMiddleware,调了必 401)才回落 promoSections.ts 的设计稿示例券。
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import CampaignBanner from '@/components/promotion/CampaignBanner';
import CampaignOverview from '@/components/promotion/CampaignOverview';
import CouponCard from '@/components/promotion/CouponCard';
import { promoShared } from '@/components/promotion/promoShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { CouponCardModel } from '@/screens/promotions/couponFormat';
import { TERMS_KEYS } from '@/screens/promotions/promoSections';
import type { CampaignItem } from '@/types/models';

export interface PromotionsTabProps {
  loading: boolean;
  /** 当前展示的活动(未登录 / 站点无活动时为 null,组件自行回落设计稿文案) */
  campaign: CampaignItem | null;
  /** 已经转好的卡片模型;回调按下标回到父层的原始 CouponView 列表 */
  cards: CouponCardModel[];
  /** 未登录:整页走设计稿示例券,按钮点了引导登录 */
  isLogin: boolean;
  onCouponPress: (index: number) => void;
  onCouponAction: (index: number) => void;
  onBookHotels: () => void;
}

export default function PromotionsTab({
  loading,
  campaign,
  cards,
  isLogin,
  onCouponPress,
  onCouponAction,
  onBookHotels,
}: PromotionsTabProps) {
  const { t } = useTranslation();

  // 可领 / 不可领两段(不可领的沉到下面,与设计稿「已过期券排在后面」的观感一致)
  const claimable = cards.filter((card) => card.action === 'claim');
  const others = cards.filter((card) => card.action !== 'claim');
  const sections: { key: 'claimable' | 'unavailable'; cards: CouponCardModel[] }[] = [
    { key: 'claimable', cards: claimable },
    { key: 'unavailable', cards: others },
  ];

  return (
    <View style={styles.root}>
      <CampaignBanner title={campaign?.title} banner={campaign?.banner} />
      <CampaignOverview
        name={campaign?.title}
        desc={campaign?.subtitle}
        period={campaignPeriod(campaign)}
      />

      <View style={styles.sections}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : cards.length === 0 ? (
          <Text style={styles.empty}>
            {isLogin ? t('promotions.empty') : t('promotions.loginHint')}
          </Text>
        ) : (
          sections
            .filter((section) => section.cards.length > 0)
            .map((section) => (
              <View key={section.key} style={styles.section}>
                <Text style={promoShared.sectionTitle}>
                  {t(`promotions.sections.${section.key}`)}
                </Text>
                <View style={styles.cards}>
                  {section.cards.map((card) => {
                    const index = cards.indexOf(card);
                    return (
                      <CouponCard
                        key={card.key}
                        coupon={card}
                        onPress={() => onCouponPress(index)}
                        onAction={() => onCouponAction(index)}
                      />
                    );
                  })}
                </View>
              </View>
            ))
        )}

        {/* 关于本活动:有真实活动时用它的副标题,否则回落设计稿文案 */}
        <View style={[promoShared.panel, styles.aboutPanel]}>
          <Text style={promoShared.panelTitle}>{t('promotions.about.title')}</Text>
          <Text style={promoShared.body}>{campaign?.subtitle || t('promotions.about.body')}</Text>
        </View>

        {/* 条款与条件:平台通用条款,不随活动变 */}
        <View style={[promoShared.panel, styles.termsPanel]}>
          <Text style={promoShared.panelTitle}>{t('promotions.terms.title')}</Text>
          <View style={styles.termsList}>
            {TERMS_KEYS.map((key) => (
              <View key={key} style={promoShared.bulletItem}>
                <View style={promoShared.bulletDot} />
                <Text style={[promoShared.body, styles.termsText]}>
                  {t(`promotions.terms.items.${key}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [promoShared.cta, pressed && promoShared.pressed]}
        onPress={onBookHotels}
      >
        <Text style={promoShared.ctaText}>{t('promotions.campaign.cta')}</Text>
      </Pressable>
    </View>
  );
}

/** 活动期间:「2026-07-01 - 2026-07-31」;缺任一端则不显示(交给设计稿回落文案) */
function campaignPeriod(campaign: CampaignItem | null): string | undefined {
  if (!campaign?.start_time || !campaign?.end_time) return undefined;
  return `${campaign.start_time.slice(0, 10)} - ${campaign.end_time.slice(0, 10)}`;
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  /* 概览卡↔券列表设计稿是 32,root 已给 24,这里补 8 */
  sections: { marginTop: 8, gap: 40 },
  section: { gap: 16 },
  cards: { gap: 16 },
  aboutPanel: { gap: 12 },
  termsPanel: { gap: 16 },
  termsList: { gap: 12 },
  termsText: { flex: 1, minWidth: 0 },
  loading: { paddingVertical: 24 },
  empty: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: 24,
  },
});
