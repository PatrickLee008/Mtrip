/**
 * 优惠中心「优惠活动」页签(设计稿 1325:2123 Promotion Page 的 Main)
 *
 * 自上而下:活动横幅 → 活动概览卡 → 三段券列表(每周/每月/酒店)→ 关于本活动 → 条款与条件 → 底部 CTA。
 * 设计稿实测的纵向间距:横幅↔概览卡 24;概览卡↔券列表 32;三段之间与关于/条款之间都是 40;
 * 段内标题↔卡片 16、卡片之间 16;卡内标题↔正文:关于 12、条款 16。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import CampaignBanner from '@/components/promotion/CampaignBanner';
import CampaignOverview from '@/components/promotion/CampaignOverview';
import CouponCard from '@/components/promotion/CouponCard';
import { promoShared } from '@/components/promotion/promoShared';
import { PROMO_SECTIONS, TERMS_KEYS, type DemoCoupon } from '@/screens/promotions/promoSections';

interface Props {
  onCouponPress: (coupon: DemoCoupon) => void;
  onCouponAction: (coupon: DemoCoupon) => void;
  onBookHotels: () => void;
}

export default function PromotionsTab({ onCouponPress, onCouponAction, onBookHotels }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <CampaignBanner />
      <CampaignOverview />

      <View style={styles.sections}>
        {PROMO_SECTIONS.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={promoShared.sectionTitle}>{t(`promotions.sections.${section.key}`)}</Text>
            <View style={styles.cards}>
              {section.coupons.map((coupon) => (
                <CouponCard
                  key={coupon.key}
                  coupon={coupon}
                  onPress={() => onCouponPress(coupon)}
                  onAction={() => onCouponAction(coupon)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* 关于本活动 */}
        <View style={[promoShared.panel, styles.aboutPanel]}>
          <Text style={promoShared.panelTitle}>{t('promotions.about.title')}</Text>
          <Text style={promoShared.body}>{t('promotions.about.body')}</Text>
        </View>

        {/* 条款与条件 */}
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
});
