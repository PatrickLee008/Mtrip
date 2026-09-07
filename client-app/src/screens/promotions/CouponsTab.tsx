/**
 * 优惠中心「我的优惠券」页签(设计稿 1429:2110 Promotion Page - Coupons)
 *
 * 自上而下:促销码输入卡(标题 + 说明 + 输入框 + Add + Get More Coupons)→
 * 有效/已用/失效三分类 → 已领券列表。
 *
 * 设计稿实测:
 *   卡片   与其余几张同壳(`--tab` / 1px `--secondary` / 圆角 32 / padding 24),gap 24
 *   输入框 #EFF4FF 底、高 52、圆角 12、padding 16,行内 gap 12(同登录页字段)
 *   Add    主色、py16、圆角 12,Outfit 400/16;设计稿是 50% 透明的禁用态 = 没填码
 *   链接   主色 16/24 下划线居中
 *
 * 三分类是设计稿没有、后端 `/marketing/coupon/my?type=` 本来就支持的维度(C-M6.1 要求
 * 「实现有效/已用/失效分类」),样式沿用 promoShared 的段落标题 + 胶囊,不新造壳。
 */

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import CouponCard from '@/components/promotion/CouponCard';
import { promoShared } from '@/components/promotion/promoShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { CouponCardModel } from '@/screens/promotions/couponFormat';
import type { MyCouponType } from '@/types/models';

/** 设计稿没有分类栏,顺序按「先看能用的」排 */
export const MY_COUPON_TYPES: MyCouponType[] = ['available', 'used', 'expired'];

interface Props {
  loading: boolean;
  /** 促销码兑换请求进行中(按钮转圈并禁用,防重复提交) */
  redeeming: boolean;
  type: MyCouponType;
  onTypeChange: (type: MyCouponType) => void;
  cards: CouponCardModel[];
  isLogin: boolean;
  onCouponPress: (index: number) => void;
  onCouponAction: (index: number) => void;
  /** Add 促销码:父层负责调接口与刷新列表 */
  onAddCode: (code: string) => void;
  /** Get More Coupons:回到「优惠活动」页签 */
  onMoreCoupons: () => void;
}

export default function CouponsTab({
  loading,
  redeeming,
  type,
  onTypeChange,
  cards,
  isLogin,
  onCouponPress,
  onCouponAction,
  onAddCode,
  onMoreCoupons,
}: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const canAdd = code.trim().length > 0 && !redeeming;

  const submitCode = () => {
    if (!canAdd) return;
    onAddCode(code.trim());
    // 兑换成功与否都清空输入:失败时错误提示已经弹出来了,留着旧码只会被反复提交
    setCode('');
  };

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
              returnKeyType="done"
              onSubmitEditing={submitCode}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              promoShared.cta,
              !canAdd && styles.ctaDisabled,
              pressed && canAdd && promoShared.pressed,
            ]}
            disabled={!canAdd}
            onPress={submitCode}
          >
            {redeeming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={promoShared.ctaText}>{t('promotions.promoCode.add')}</Text>
            )}
          </Pressable>
        </View>

        <Pressable onPress={onMoreCoupons} hitSlop={6}>
          <Text style={styles.link}>{t('promotions.promoCode.more')}</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        <Text style={promoShared.sectionTitle}>{t('promotions.myCoupons.title')}</Text>

        <View style={styles.filters}>
          {MY_COUPON_TYPES.map((item) => {
            const active = item === type;
            return (
              <Pressable
                key={item}
                style={({ pressed }) => [
                  styles.filter,
                  active && styles.filterActive,
                  pressed && promoShared.pressed,
                ]}
                onPress={() => onTypeChange(item)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {t(`promotions.myCoupons.types.${item}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : cards.length === 0 ? (
          <Text style={styles.empty}>
            {isLogin ? t(`promotions.myCoupons.empty.${type}`) : t('promotions.loginHint')}
          </Text>
        ) : (
          <View style={styles.cards}>
            {cards.map((card, index) => (
              <CouponCard
                key={card.key}
                coupon={card}
                onPress={() => onCouponPress(index)}
                onAction={() => onCouponAction(index)}
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
  filters: { flexDirection: 'row', gap: 8 },
  filter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.primary },
  filterText: { fontFamily: fonts.inter, fontSize: 13, lineHeight: 20, color: colors.textSoft },
  filterTextActive: { color: '#FFFFFF' },

  cards: { gap: 16 },
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
