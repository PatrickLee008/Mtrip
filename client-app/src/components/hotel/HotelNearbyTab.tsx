/**
 * 酒店详情 · Nearby Attraction 页签(Figma M-Trip / Hotel Details Location 222:2910)
 *
 * 结构:
 *   标题行  Nearby Location(Outfit 600/24)+ 右「Get Directions」Inter 700/16 主色 + 15px 右上箭头
 *   地图    370x256 圆角 32(设计稿是一张去饱和的静态图 —— 未接地图 SDK,这里同样用静态图,点击走 comingSoon)
 *   交通卡  白底 / `--secondary` 描边 / 圆角 32 / padding 25 / gap 24,每条 48 圆底图标 + 名称 + 耗时
 *   景点卡  横滑,每张 min-width 280、白底描边圆角 32、padding 25,左 64 缩略图 + 名称/距离
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_ATTRACTION_COVERS, TEMP_NEARBY_MAP } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import { detailShared } from '@/components/hotel/detailShared';
import { PAGE_PADDING, colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { DETAIL_ATTRACTIONS, DETAIL_TRANSPORT } from '@/screens/hotel/detailDemo';

/** 设计稿交通图标底:主色徽章底 #1F4ED3 叠 10% */
const ICON_BG = 'rgba(31, 78, 211, 0.1)';
/** 设计稿景点卡名称/说明用的深色与灰色 */
const CARD_TITLE_COLOR = '#061C34';
const CARD_META_COLOR = '#585F6A';

interface Props {
  onComingSoon: () => void;
}

export default function HotelNearbyTab({ onComingSoon }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={detailShared.sectionTitle}>{t('hotels.detail.nearby.title')}</Text>
        <Pressable
          style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
          onPress={onComingSoon}
          hitSlop={8}
        >
          <Text style={styles.directionsText}>{t('hotels.detail.nearby.getDirections')}</Text>
          <HomeIcon name="arrowUpRight" size={15} color={colors.primary} />
        </Pressable>
      </View>

      {/* 地图:设计稿是静态截图,未接地图 SDK 前保持一致 */}
      <Pressable
        style={({ pressed }) => [styles.map, pressed && styles.pressed]}
        onPress={onComingSoon}
      >
        <Image source={TEMP_NEARBY_MAP} style={styles.mapImage} resizeMode="cover" />
      </Pressable>

      <View style={styles.transportCard}>
        {DETAIL_TRANSPORT.map((item) => (
          <View key={item.key} style={styles.transportRow}>
            <View style={styles.transportIcon}>
              <HomeIcon
                name={item.icon}
                width={item.width}
                height={item.height}
                color={colors.primary}
              />
            </View>
            <View>
              <Text style={styles.cardTitle}>
                {t(`hotels.detail.nearby.transport.${item.key}.name`)}
              </Text>
              <Text style={styles.cardMeta}>
                {t(`hotels.detail.nearby.transport.${item.key}.time`)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.attractionScroll}
        contentContainerStyle={styles.attractionRow}
      >
        {DETAIL_ATTRACTIONS.map((key) => (
          <Pressable
            key={key}
            style={({ pressed }) => [styles.attractionCard, pressed && styles.pressed]}
            onPress={onComingSoon}
          >
            <Image
              source={TEMP_ATTRACTION_COVERS[key]}
              style={styles.attractionThumb}
              resizeMode="cover"
            />
            <View style={styles.attractionText}>
              <Text style={styles.attractionName} numberOfLines={1}>
                {t(`hotels.detail.nearby.attractions.${key}.name`)}
              </Text>
              <Text style={styles.cardMeta}>
                {t(`hotels.detail.nearby.attractions.${key}.meta`)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  directions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  directionsText: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
    textAlign: 'center',
  },

  map: { height: 256, borderRadius: radius.card, overflow: 'hidden' },
  mapImage: { width: '100%', height: '100%' },

  transportCard: {
    gap: 24,
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.card,
    ...shadows.subtle,
  },
  transportRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  transportIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: ICON_BG,
  },
  cardTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: CARD_TITLE_COLOR,
  },
  cardMeta: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: CARD_META_COLOR,
  },

  /* 横滑条要铺满整宽:内容有 16 的横向内边距,这里负一个页面内边距再补回去 */
  attractionScroll: { marginHorizontal: -PAGE_PADDING },
  attractionRow: { flexDirection: 'row', gap: 16, paddingHorizontal: PAGE_PADDING },
  attractionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minWidth: 280,
    padding: 25,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.card,
    ...shadows.subtle,
  },
  attractionThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#DDE9FF',
  },
  attractionText: { flexShrink: 1 },
  attractionName: {
    fontFamily: fonts.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: CARD_TITLE_COLOR,
  },

  pressed: { opacity: 0.85 },
});
