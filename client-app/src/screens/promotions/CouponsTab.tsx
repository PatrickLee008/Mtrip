/**
 * 优惠中心「我的优惠券」页签(设计稿 1429:2110 Promotion Page - Coupons)
 *
 * 自上而下:促销码输入卡(标题 + 说明 + 输入框 + Add + Get More Coupons)→ 已领券列表。
 *
 * 设计稿实测:
 *   卡片   与其余几张同壳(`--tab` / 1px `--secondary` / 圆角 32 / padding 24),gap 24
 *   输入框 #EFF4FF 底、高 52、圆角 12、padding 16,行内 gap 12(同登录页字段)
 *   Add    主色、py16、圆角 12,Outfit 400/16;设计稿是 50% 透明的禁用态 = 没填码
 *   链接   主色 16/24 下划线居中
 *
 * 后端还没有优惠券接口,Add 只做本地校验后走 comingSoon;已领券用设计稿的静态数据。
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import CouponCard from '@/components/promotion/CouponCard';
import { promoShared } from '@/components/promotion/promoShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { CLAIMED_COUPONS, type DemoCoupon } from '@/screens/promotions/promoSections';

interface Props {
  onCouponPress: (coupon: DemoCoupon) => void;
  onCouponAction: (coupon: DemoCoupon) => void;
  /** Add 促销码(后端未接,由页面统一给提示) */
  onAddCode: (code: string) => void;
  /** Get More Coupons:回到「优惠活动」页签 */
  onMoreCoupons: () => void;
}

export default function CouponsTab({
  onCouponPress,
  onCouponAction,
  onAddCode,
  onMoreCoupons,
}: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const canAdd = code.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={[promoShared.panel, styles.codePanel]}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('promotions.promoCode.title')}</Text>
          <Text style={styles.subtitle}>{t('promotions.promoCode.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <HomeIcon name="ticketDiagonal20" size={20} color={colors.primary} />
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder={t('promotions.promoCode.placeholder')}
              placeholderTextColor={colors.textSoft}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              promoShared.cta,
              !canAdd && styles.ctaDisabled,
              pressed && canAdd && promoShared.pressed,
            ]}
            disabled={!canAdd}
            onPress={() => onAddCode(code.trim())}
          >
            <Text style={promoShared.ctaText}>{t('promotions.promoCode.add')}</Text>
          </Pressable>
        </View>

        <Pressable onPress={onMoreCoupons} hitSlop={6}>
          <Text style={styles.link}>{t('promotions.promoCode.more')}</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        <Text style={promoShared.sectionTitle}>{t('promotions.myCoupons.title')}</Text>
        {CLAIMED_COUPONS.length === 0 ? (
          <Text style={styles.empty}>{t('promotions.myCoupons.empty')}</Text>
        ) : (
          <View style={styles.cards}>
            {CLAIMED_COUPONS.map((coupon) => (
              <CouponCard
                key={coupon.key}
                coupon={coupon}
                onPress={() => onCouponPress(coupon)}
                onAction={() => onCouponAction(coupon)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  codePanel: { gap: 24, alignItems: 'center' },
  head: { alignItems: 'center', gap: 8, width: '100%' },
  title: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.heading,
  },
  subtitle: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
  },

  form: { width: '100%', gap: 32 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  /* minWidth 0 同登录页:web 端 <input> 的 min-width:auto 会撑破字段 */
  input: { flex: 1, minWidth: 0, fontFamily: fonts.inter, fontSize: 16, color: colors.heading },
  ctaDisabled: { opacity: 0.5 },

  link: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.primary,
    textDecorationLine: 'underline',
  },

  list: { gap: 16 },
  cards: { gap: 16 },
  empty: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSoft,
    paddingVertical: 24,
  },
});
