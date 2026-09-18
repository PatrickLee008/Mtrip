/**
 * 关怀模式酒店详情族的吸底价格栏(Figma `2540:18477`,信息页 / 政策页 / 评价页共用)
 *
 * **哪几页有、哪几页没有**(按设计稿逐帧核过,别照着"统一加"改):
 *   有  信息页 `2540:17300` / 政策页 `2540:17944` / 评价页 `2540:18286` / 房型详情 `2540:18120`
 *   无  **主详情页 `2540:16882`** —— 那一帧的 Mobile Bottom Bar 是 `hidden=true`,
 *       它的房型列表里每张卡自带 Select,再挂一条"Choose room"是重复入口;
 *   无  实景预览 `2540:18495` —— 稿里根本没有这个节点。
 * 房型详情页早就有自己的「Book This Room」底栏,不用这一份。
 *
 * 设计稿实测:
 *   白底、上边框 1px rgba(196,197,215,.3)、px20 pt17 pb16、两端对齐
 *   左  「Start at」Inter 600/12/16 --text
 *       金额 Inter 600/20/24 主色
 *       「-15% TODAY」Inter 700/10/15 #BA1A1A(= colors.emergencyFg)
 *   右  主色按钮 **圆角 24**、px32 py16,「Choose room」Inter 700/20/24 白
 *
 * ⚠️ **那行折扣是设计稿写死的数值**(`DETAIL_DEMO.discountPercent`,完整模式
 * `HotelDetailScreen` 也是这么画的):后端没有"今日折扣"字段。两种模式口径保持一致,
 * 接通真实促销字段时两边一起改;不想显示就不传 `discountPercent`。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

/** 栏高(pt17 + pb16 + 按钮 56),页面用它算滚动区的底部留白 */
export const LITE_DETAIL_BAR_HEIGHT = 89;

interface Props {
  /** 起价;<=0 时整行金额不画(接口没给价就不编一个) */
  priceFrom: number;
  /** 「-N% TODAY」的 N;不传就不画那一行 */
  discountPercent?: number | null;
  onPress: () => void;
}

export default function LiteDetailBottomBar({ priceFrom, discountPercent, onPress }: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  return (
    <SafeAreaView style={styles.bar} edges={['bottom']}>
      <View style={styles.inner}>
        <View>
          <Text style={styles.startAt}>{t('hotels.detail.startAt')}</Text>
          {priceFrom > 0 ? (
            <Text style={styles.price}>{formatMoney(priceFrom, currency)}</Text>
          ) : null}
          {discountPercent ? (
            <Text style={styles.discount}>
              {t('hotels.detail.discountToday', { percent: discountPercent })}
            </Text>
          ) : null}
        </View>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={onPress}
        >
          <Text style={styles.ctaText}>{t('hotels.lite.chooseRoomCta')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
    backgroundColor: '#FFFFFF',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 16,
  },
  pressed: { opacity: 0.85 },

  startAt: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.heading },
  price: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.primary },
  discount: {
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 15,
    color: colors.emergencyFg,
  },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.interBold,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
