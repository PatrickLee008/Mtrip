/**
 * 收藏餐厅卡(设计稿 `Card 1` node 1383:2539 / `Card 2` node 1383:2559)
 *
 * 设计稿实测:322 宽,底色 --tab #FEFEFE,1px 边框 --secondary #D9E1FB,圆角 32,
 * 投影 Effect/DS 0/1 blur2 黑 5%。
 *   图片区 322x128:右上 24x24 黑 25% 圆底收藏心;左下 gap 8 的胶囊组(高 26)
 *     Premium choice = 主色底白字;折扣 = 白 90% 底 + 主色描边;免配送 = --secondary 底 + 主色描边
 *   正文 padding 20、gap 4:名称 Outfit 600/16 + 星形评分;下一行 距离 / 时长 / 配送费
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts, text } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

export const RESTAURANT_CARD_WIDTH = 322;
const COVER_WIDTH = RESTAURANT_CARD_WIDTH - 2;
/** 设计稿配送时长文字色 */
const DURATION_COLOR = '#204DDA';

interface Props {
  name: string;
  rating: number;
  distance: string;
  duration: string;
  /** 配送费;不传表示免配送费(图上与正文都展示 Free Delivery) */
  deliveryFee?: number;
  coverUri?: string | null;
  /** 无 coverUri 时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  premium?: boolean;
  /** 折扣胶囊文案,如 15% Off */
  discountLabel?: string;
  favorited?: boolean;
  onPress?: () => void;
  onToggleFavorite?: () => void;
}

export default function SavedRestaurantCard({
  name,
  rating,
  distance,
  duration,
  deliveryFee,
  coverUri,
  coverSource,
  premium,
  discountLabel,
  favorited = true,
  onPress,
  onToggleFavorite,
}: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);
  const freeDelivery = deliveryFee === undefined;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.coverWrap}>
        <CoverImage
          uri={coverUri}
          fallback={coverSource}
          width={COVER_WIDTH}
          height={128}
          label={name}
        />

        <Pressable style={styles.heart} onPress={onToggleFavorite} hitSlop={8}>
          <HomeIcon name={favorited ? 'heartFilled' : 'heart'} size={16} color="#FFFFFF" />
        </Pressable>

        <View style={styles.badges}>
          {premium ? (
            <View style={[styles.pill, styles.pillSolid]}>
              <Text style={[styles.pillText, styles.pillTextSolid]}>
                {t('myPick.savedRestaurants.premium')}
              </Text>
            </View>
          ) : null}
          {discountLabel ? (
            <View style={[styles.pill, styles.pillOutlined]}>
              <Text style={styles.pillText}>{discountLabel}</Text>
            </View>
          ) : null}
          {freeDelivery ? (
            <View style={[styles.pill, styles.pillTinted]}>
              <Text style={styles.pillText}>{t('myPick.savedRestaurants.freeDelivery')}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[text.cardTitle, styles.name]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.rating}>
            <HomeIcon name="star" size={15} color={colors.warning} />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.metaLeft}>
            <Text style={styles.distance}>{distance}</Text>
            <Text style={styles.duration}>{duration}</Text>
          </View>
          {freeDelivery ? (
            <Text style={styles.delivery}>{t('myPick.savedRestaurants.freeDelivery')}</Text>
          ) : (
            <View style={styles.deliveryRow}>
              <HomeIcon name="motorcycle" size={16} color={colors.primary} />
              <Text style={styles.delivery}>{formatMoney(deliveryFee ?? 0, currency)}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: RESTAURANT_CARD_WIDTH,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    /* 设计稿 Effect/DS:0/1 blur2 黑 5% */
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pressed: { opacity: 0.92 },
  coverWrap: { height: 128 },
  heart: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  badges: { position: 'absolute', left: 16, bottom: 16, flexDirection: 'row', gap: 8 },
  pill: {
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillSolid: { backgroundColor: colors.primary },
  pillOutlined: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  pillTinted: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.softBlue },
  pillText: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: colors.primary },
  pillTextSolid: { color: '#FFFFFF' },
  body: { padding: 20, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, marginRight: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.cardTitle },
  metaLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  distance: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  duration: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: DURATION_COLOR },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  delivery: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: colors.primary },
});
