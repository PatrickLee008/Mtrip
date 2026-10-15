/**
 * 评价页的一行表情评分(Figma「Hotel Review」`800:2100` Category Item)
 *
 * 标签 Inter 500/14 + 右侧「n/5」Inter 600/12 主色;下面 5 个 32 的表情、间距 12。
 * 点第 i 个 = 评 i 分:前 i 个亮成「i 分对应的那张脸」,其余是浅色空脸(设计稿里 4/5 就是四张大笑脸 + 一张空脸)。
 * 分项评分允许再点一次当前分值取消(回到 0 = 没评);总体评分必填,不允许取消。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ReviewGlyph from '@/components/review/ReviewGlyph';
import { FACE_EMPTY, RATING_FACES } from '@/components/review/reviewAssets';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

const FACE_SIZE = 32;

interface Props {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  /** 允许再点一次取消(分项评分) */
  clearable?: boolean;
  readOnly?: boolean;
}

export default function ReviewEmojiRating({ label, value, onChange, clearable, readOnly }: Props) {
  return (
    <View style={styles.item}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.score}>{`${value}/5`}</Text>
      </View>
      <View style={styles.faces}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            disabled={readOnly || !onChange}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${n}/5`}
            onPress={() => onChange?.(clearable && value === n ? 0 : n)}
          >
            <ReviewGlyph glyph={n <= value ? RATING_FACES[value] : FACE_EMPTY} size={FACE_SIZE} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.14, color: colors.heading },
  score: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: colors.primary },
  faces: { flexDirection: 'row', gap: 12 },
});
