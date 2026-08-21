/**
 * 预订卡(设计稿 `Booking Card 3` node 289:1362)
 *
 * 设计稿实测:370 宽,底色 --tab #FEFEFE,1px 边框 --secondary #D9E1FB,圆角 32,
 * 投影 0/20 blur40 spread-10 rgba(15,41,77,0.08),内容整体外包 1px(边框内描边效果)。
 *   顶部:368x176 封面 + 右上角状态胶囊(check 图标 + 大写状态文案,Inter 400/11 字距 0.55)
 *   正文:padding 16、gap 12
 *     酒店名 Outfit 500/16 #0B1C30 → 地址(location 图标 + Inter 400/12 --text-2)→ 房型 Inter Medium 14 主色
 *     1px 分隔线
 *     两等分信息栏:图标 + 标签(Inter 400/10 大写 --text-2 透明度 .6)+ 值(Inter 700/12 --text #1B1D30)
 *     底部:主按钮(flex,py12,圆角 12,主色)+ 44x44 描边地图按钮
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  /** 卡片宽度(页面内容宽度) */
  width: number;
  title: string;
  coverUri?: string | null;
  /** 无 coverUri 时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  address?: string;
  /** 房型 / 票种 */
  skuName?: string;
  /** 状态胶囊文案(大写展示) */
  statusLabel: string;
  /** 状态胶囊底色,默认设计稿绿色 */
  statusColor?: string;
  /** 入离日期文案 */
  dates: string;
  /** 出行人文案 */
  travelers: string;
  /** 覆盖出行人栏标签(真实订单只有件数,此处传「数量」) */
  travelersLabel?: string;
  onPressDetail: () => void;
  onPressMap?: () => void;
}

export default function BookingCard({
  width,
  title,
  coverUri,
  coverSource,
  address,
  skuName,
  statusLabel,
  statusColor = colors.statusPaid,
  dates,
  travelers,
  travelersLabel,
  onPressDetail,
  onPressMap,
}: Props) {
  const { t } = useTranslation();
  const coverWidth = width - 2;
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.coverWrap}>
        <CoverImage
          uri={coverUri}
          fallback={coverSource}
          width={coverWidth}
          height={176}
          label={title}
        />
        <View style={[styles.status, { backgroundColor: statusColor }]}>
          <HomeIcon name="check" size={13} color="#FFFFFF" />
          <Text style={styles.statusText}>{statusLabel.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.headGroup}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {address ? (
            <View style={styles.addressRow}>
              <HomeIcon name="location" size={16} color={colors.textSoft} />
              <Text style={styles.address} numberOfLines={1}>
                {address}
              </Text>
            </View>
          ) : null}
          {skuName ? (
            <Text style={styles.sku} numberOfLines={1}>
              {skuName}
            </Text>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <HomeIcon name="calendar" size={16} color={colors.primary} />
            <View style={styles.metaText}>
              <Text style={styles.metaLabel}>{t('myPick.booking.dates')}</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {dates}
              </Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <HomeIcon name="travelers" size={18} color={colors.primary} />
            <View style={styles.metaText}>
              <Text style={styles.metaLabel}>
                {travelersLabel ?? t('myPick.booking.travelers')}
              </Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {travelers}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onPressDetail}
          >
            <Text style={styles.primaryBtnText}>{t('myPick.booking.viewDetails')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.mapBtn, pressed && styles.pressed]}
            onPress={onPressMap}
          >
            <HomeIcon name="map" size={18} color={colors.body} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    /* 设计稿 DS_AG:0/20 blur40 spread-10 rgba(15,41,77,0.08) */
    shadowColor: '#0F294D',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  coverWrap: { height: 176 },
  status: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 25,
    paddingHorizontal: 12,
    borderRadius: 999,
    /* 设计稿 Overlay+Shadow:0/4 blur6 spread-1 黑 10% */
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusText: {
    fontFamily: fonts.inter,
    fontSize: 11,
    lineHeight: 16.5,
    letterSpacing: 0.55,
    color: '#FFFFFF',
  },
  body: { padding: 16, gap: 12 },
  headGroup: { gap: 4 },
  title: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 16, color: '#0B1C30' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24 },
  address: { flex: 1, fontFamily: fonts.inter, fontSize: 12, color: colors.textSoft },
  sku: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  divider: { height: 1, backgroundColor: colors.divider },
  metaRow: { flexDirection: 'row', gap: 4 },
  metaCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { flex: 1 },
  metaLabel: {
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 15,
    textTransform: 'uppercase',
    color: colors.textSoft,
    opacity: 0.6,
  },
  metaValue: { fontFamily: fonts.interBold, fontSize: 12, lineHeight: 24, color: colors.heading },
  actions: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
  mapBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  pressed: { opacity: 0.85 },
});
