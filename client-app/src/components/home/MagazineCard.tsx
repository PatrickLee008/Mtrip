/**
 * 杂志流文章卡(设计稿 13):192h 封面 r32 + 分类/标题/摘要/作者信息
 * showDivider 对应设计稿 370x1 #C4C5D7 的分隔线
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import CoverImage from '@/components/home/CoverImage';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  width: number;
  category: string;
  title: string;
  excerpt: string;
  meta: string;
  uri?: string | null;
  /** 无 uri 时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  showDivider?: boolean;
  onPress: () => void;
}

export default function MagazineCard({
  width,
  category,
  title,
  excerpt,
  meta,
  uri,
  coverSource,
  showDivider,
  onPress,
}: Props) {
  return (
    <View>
      <Pressable style={({ pressed }) => [pressed && styles.pressed]} onPress={onPress}>
        {/* 设计稿封面带 Effect/DS 弱投影,挂在外层 View 上(iOS 需不透明底) */}
        <View style={styles.cover}>
          <CoverImage
            uri={uri}
            fallback={coverSource}
            width={width}
            height={192}
            radius={radius.card}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.category}>{category}</Text>
          <Text style={styles.title} numberOfLines={3}>
            {title}
          </Text>
          <Text style={styles.excerpt} numberOfLines={2}>
            {excerpt}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92 },
  cover: { borderRadius: radius.card, backgroundColor: '#FFFFFF', ...shadows.subtle },
  body: { paddingTop: 12 },
  category: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 24,
    letterSpacing: 0.6,
    color: colors.primary,
  },
  title: {
    marginTop: 8,
    fontFamily: fonts.outfitSemi,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },
  excerpt: { marginTop: 8, fontFamily: fonts.inter, fontSize: 14, lineHeight: 20, color: colors.muted },
  meta: { marginTop: 16, fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.muted },
  divider: { height: 1, marginTop: 24, backgroundColor: colors.divider },
});
