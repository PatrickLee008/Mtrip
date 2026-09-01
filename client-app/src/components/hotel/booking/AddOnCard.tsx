/**
 * 「Enhance Your Stay」加购卡(设计稿 1675:6218 早餐 / 1675:6235 接送 / 1675:7585 保险)
 *
 * 设计稿实测:卡壳 `--tab` 底 / 1px `--secondary` / 圆角 32 / overflow clip / 内边距 1px
 *   有封面的两张:封面高 182.25 铺满卡宽,正文 padding 24 gap 8
 *   保险那张没有封面(1675:7585),正文结构完全一样
 *   标题行 Inter 700/18 `--text` 与右侧价格 Inter 600/16 主色,两端对齐
 *   描述 Inter 500/14 tracking .14 `#747686`,下留 8
 *   按钮整宽、圆角 8、px16 py8:未选中是 `rgba(66,104,244,0.1)` 底 + 主色「+ Add to booking」,
 *   已选中(设计稿 1675:7580)换成主色实底 + 白色勾 +「Selected」
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  cover?: ImageSourcePropType | null;
  title: string;
  desc: string;
  price: string;
  selected: boolean;
  addLabel: string;
  selectedLabel: string;
  onToggle: () => void;
}

export default function AddOnCard({
  cover,
  title,
  desc,
  price,
  selected,
  addLabel,
  selectedLabel,
  onToggle,
}: Props) {
  return (
    <View style={styles.card}>
      {cover ? (
        <View style={styles.cover}>
          <Image source={cover} style={styles.coverImage} resizeMode="cover" />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.price}>{price}</Text>
        </View>
        <Text style={styles.desc}>{desc}</Text>

        <Pressable
          style={({ pressed }) => [
            selected ? bookingShared.primaryBtn : bookingShared.tintBtn,
            pressed && bookingShared.pressed,
          ]}
          onPress={onToggle}
        >
          {selected ? (
            <HomeIcon name="checkSlim" width={12.225} height={9.019} color="#FFFFFF" />
          ) : (
            <HomeIcon name="plus" size={10.5} color={colors.primary} />
          )}
          <Text style={selected ? bookingShared.primaryBtnText : bookingShared.tintBtnText}>
            {selected ? selectedLabel : addLabel}
          </Text>
        </Pressable>
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
  },
  cover: { height: 182.25, width: '100%', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },

  body: { padding: 24, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: {
    flexShrink: 1,
    fontFamily: fonts.interBold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.heading,
  },
  price: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },
  desc: {
    paddingBottom: 8,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.label,
  },
});
