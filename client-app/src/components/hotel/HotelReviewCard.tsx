/**
 * 住客评价 · 单条评论卡(Figma M-Trip / `Hotel Details Reviews Page` `1133:3154` /
 * `1133:3188` / `1133:3215`,三张卡同一套壳)
 *
 * 设计稿实测(卡壳 EL-7b95f45c):
 *   卡      padding 24 / gap 12 / 圆角 24 / 底 `--tab` #FEFEFE / 1px `--secondary` #D9E1FB
 *            / 投影 Effect/DS(= shadows.subtle)
 *   头部    48 圆头像 + (昵称 Inter 400/16/24 #141D23 / 日期·同行类型 Inter 500/12/16 #5C5F60)
 *           右侧评分药丸:底 rgba(66,104,244,.1)、1px rgba(32,77,218,.2)、圆角 32,
 *           分数 Inter 400/18/28 主色 + 「/10」Inter 500/12/16 主色
 *   正文    Inter 400/16/24 `--text-2`
 *   图墙    横滑,单图 192×128 圆角 32,间距 12(稿面 EL-7f71f37d)
 *   商家回复 底 #ECF5FE、左边框 4px rgba(32,77,218,.3)、圆角 32、padding 16、gap 8,
 *           抬头「已核实物业」徽章 + 物业名 Inter 400/16/24 #141D23
 *   头像兜底 稿面第三张卡没有头像图:48 圆底 #E1E3E4 + 20 人形字形
 *
 * **稿面有、本卡不渲染的行**:评论标题(「Unforgettable Sunrise Views」)、日期后的同行类型
 * (「• Solo traveler」)、卡片底部的 Helpful (12) / Report —— 前两项 `goods_review` 表里
 * 根本没有对应列,后一项本页设计稿三张卡都没有(只有关怀模式那张有)。宁可不画,不编造。
 *
 * 分数口径:后端 `rating` 是 1-5,稿面是 /10,按 ×2 换算(与搜索结果页 9.3 同一口径)。
 * 稿面第三张卡写「10」而第二张写「8.0」,本身不一致;这里统一 `toFixed(1)`。
 */

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { HotelReview } from '@/api/goods';
import HomeIcon from '@/components/home/HomeIcon';
import { detailShared } from '@/components/hotel/detailShared';
import { formatReviewDate, reviewNickname, toTenPointScore } from '@/components/hotel/reviewFormat';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { resolveMediaUri } from '@/utils/media';

/** 稿面卡圆角 24(同总览卡,不是 detailShared 的 32) */
const CARD_RADIUS = 24;
/** 图墙单图展示框 192×128,圆角 32 */
const PHOTO_WIDTH = 192;
const PHOTO_HEIGHT = 128;
const PHOTO_RADIUS = 32;

interface Props {
  review: HotelReview;
  /** 商家回复的抬头,稿面是物业名(「Heritage Bagan Hotel」);拿不到时用通用文案 */
  propertyName?: string;
}

export default function HotelReviewCard({ review, propertyName }: Props) {
  const { t, i18n } = useTranslation();

  const nickname = reviewNickname(review, t);

  const meta = formatReviewDate(review.created_at, i18n.language);

  const avatarUri = resolveMediaUri(review.avatar);
  const photos = (Array.isArray(review.images) ? review.images : [])
    .map((uri) => resolveMediaUri(uri))
    .filter((uri): uri is string => uri !== null);

  const reply = typeof review.reply_content === 'string' ? review.reply_content.trim() : '';

  return (
    <View style={styles.card}>
      {/* 头部:头像 + 昵称/日期 + 评分药丸 */}
      <View style={styles.head}>
        <View style={styles.author}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
          ) : (
            /* 稿面第三张卡:没有头像图时是灰圆 + 人形字形 */
            <View style={[styles.avatar, styles.avatarFallback]}>
              <HomeIcon name="person" size={20} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.authorText}>
            <Text style={styles.nickname} numberOfLines={1}>
              {nickname}
            </Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
        </View>

        <View style={styles.scorePill}>
          <Text style={styles.scorePillValue}>{toTenPointScore(review.rating)}</Text>
          <Text style={styles.scorePillMax}>{t('hotels.reviewsPage.outOfTen')}</Text>
        </View>
      </View>

      {review.content ? <Text style={detailShared.body}>{review.content}</Text> : null}

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gallery}
          contentContainerStyle={styles.galleryContent}
        >
          {photos.map((uri, index) => (
            <Image
              /* 评价图片没有稳定 id,同一列表内顺序即身份 */
              key={`${review.id}-${index}`}
              source={{ uri }}
              style={styles.photo}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : null}

      {reply ? (
        <View style={styles.reply}>
          <View style={styles.replyHead}>
            <HomeIcon name="verifiedBadge" width={16.5} height={15.75} color={colors.primary} />
            <Text style={styles.replyFrom} numberOfLines={1}>
              {propertyName || t('hotels.reviewsPage.replyFrom')}
            </Text>
          </View>
          <Text style={detailShared.body}>{reply}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
    gap: 12,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    /* 稿面带 Effect/DS:本层不裁剪(overflow 会连阴影一起吃掉),圆角靠 border 自己出 */
    ...shadows.subtle,
  },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  avatar: { width: 48, height: 48, borderRadius: 999 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1E3E4' },
  authorText: { flexShrink: 1 },
  nickname: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#141D23' },
  meta: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: '#5C5F60' },

  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(32, 77, 218, 0.2)',
    backgroundColor: 'rgba(66, 104, 244, 0.1)',
  },
  scorePillValue: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 28, color: colors.primary },
  scorePillMax: {
    fontFamily: fonts.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },

  gallery: { height: PHOTO_HEIGHT },
  galleryContent: { flexDirection: 'row', gap: 12 },
  photo: { width: PHOTO_WIDTH, height: PHOTO_HEIGHT, borderRadius: PHOTO_RADIUS },

  reply: {
    gap: 8,
    padding: 16,
    borderRadius: 32,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(32, 77, 218, 0.3)',
    backgroundColor: '#ECF5FE',
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyFrom: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#141D23', flexShrink: 1 },
});
