/**
 * 关怀模式「住客评价」页(Figma `Hotel Details Lite` / Hotel Details Reviews Page `2352:6648`)
 *
 * 信息页评价卡的「Read All Reviews」落到这里:评分总览 → 维度条 → 评论卡列表。
 *
 * 设计稿实测(评论卡 `2352:6730`):
 *   卡片   --tab 底,1px --secondary,圆角 24,padding 25,gap12,投影 0/20 blur20 rgba(15,41,77,.08)
 *   头部   48 圆头像 + (昵称 Inter 400/16 #141D23 / 日期·同行类型 Inter 500/12 #5C5F60)
 *          右侧评分药丸:底 rgba(66,104,244,.1)、1px rgba(32,77,218,.2)、圆角 32,
 *          分数 Inter 400/18/28 主色 + 「/10」Inter 500/12
 *   正文   标题 Inter 600/18/20 --text;内容 Inter 400/16/24 --text-2
 *   图墙   横滑,单图 192×128 圆角 32,间距 12
 *   商家回复 底 #ECF5FE、左边框 4px rgba(32,77,218,.3)、圆角 32、pl20 pr16 py16
 *   底行   上边框 rgba(196,197,215,.3),pt17:左「Helpful (12)」右「Report」,均 Inter 500/12 #5C5F60
 *
 * **数据仍是设计稿数值**:后端没有评价接口(完整模式 `HotelReviewsTab` 同此状态)。
 * 评分总览与维度条复用 `detailDemo` 的 `DETAIL_REVIEW_SUMMARY` / `DETAIL_REVIEW_SCORES`
 * (与完整模式同一份,避免两种模式给出不同的分数);三条评论正文照抄设计稿,
 * 落在 `hotels.lite.reviews.items.*`。Helpful / Report 没有接口,走 comingSoon。
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { tempCoverFor } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import { liteShared } from '@/components/hotel/lite/liteShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { DETAIL_REVIEW_SCORES, DETAIL_REVIEW_SUMMARY } from '@/screens/hotel/detailDemo';
import { useCommonStore } from '@/store/commonStore';

/** 设计稿三张评论卡:分数 + 是否带图墙 + 是否有商家回复(文案在 i18n) */
const REVIEWS = [
  { key: 'elena', score: 9.5, photos: 4, reply: true },
  { key: 'marco', score: 9.0, photos: 0, reply: false },
  { key: 'aye', score: 8.5, photos: 2, reply: false },
] as const;

export default function HotelReviewsLiteScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);

  const comingSoon = () => showToast(t('home.comingSoon'));

  return (
    <View style={liteShared.root}>
      <SafeAreaView style={liteShared.safe} edges={['top']}>
        <View style={liteShared.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={liteShared.topTitle} numberOfLines={1}>
            {t('hotels.detail.tabs.reviews')}
          </Text>
        </View>

        <ScrollView
          style={liteShared.flex}
          contentContainerStyle={liteShared.main}
          showsVerticalScrollIndicator={false}
        >
          {/* 总览 */}
          <View style={liteShared.card}>
            <View style={liteShared.row}>
              <Text style={styles.score}>{DETAIL_REVIEW_SUMMARY.score}</Text>
              <View style={liteShared.flexCol}>
                <Text style={liteShared.itemTitle}>{t('hotels.results.excellent')}</Text>
                <Text style={liteShared.body}>
                  {t('hotels.detail.reviews.basedOn', {
                    reviews: DETAIL_REVIEW_SUMMARY.total.toLocaleString(i18n.language),
                  })}
                </Text>
              </View>
            </View>

            {DETAIL_REVIEW_SCORES.map((row) => (
              <View key={row.key} style={styles.scoreRow}>
                <Text style={[liteShared.body, styles.scoreLabel]}>
                  {t(`hotels.detail.reviews.dimensions.${row.key}`)}
                </Text>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(row.score / DETAIL_REVIEW_SUMMARY.scoreMax) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.scoreValue}>{row.score}</Text>
              </View>
            ))}
          </View>

          {/* 评论卡 */}
          {REVIEWS.map((review, index) => (
            <View key={review.key} style={[liteShared.card, styles.reviewCard]}>
              <View style={liteShared.rowBetween}>
                <View style={liteShared.row}>
                  <Image source={tempCoverFor(index)} style={styles.avatar} resizeMode="cover" />
                  <View>
                    <Text style={styles.author}>
                      {t(`hotels.lite.reviews.items.${review.key}.author`)}
                    </Text>
                    <Text style={styles.meta}>
                      {t(`hotels.lite.reviews.items.${review.key}.meta`)}
                    </Text>
                  </View>
                </View>

                <View style={styles.scorePill}>
                  <Text style={styles.scorePillValue}>{review.score}</Text>
                  <Text style={styles.scorePillMax}>{t('hotels.lite.reviews.outOfTen')}</Text>
                </View>
              </View>

              <Text style={styles.reviewTitle}>
                {t(`hotels.lite.reviews.items.${review.key}.title`)}
              </Text>
              <Text style={liteShared.body}>
                {t(`hotels.lite.reviews.items.${review.key}.body`)}
              </Text>

              {review.photos > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.photos}>
                    {Array.from({ length: review.photos }).map((_, i) => (
                      <Image
                        key={i}
                        source={tempCoverFor(i + index)}
                        style={styles.photo}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                </ScrollView>
              ) : null}

              {review.reply ? (
                <View style={styles.reply}>
                  <View style={liteShared.row}>
                    <HomeIcon name="chatFilled" size={18} color={colors.primary} />
                    <Text style={styles.replyFrom}>{t('hotels.lite.reviews.replyFrom')}</Text>
                  </View>
                  <Text style={liteShared.body}>
                    {t(`hotels.lite.reviews.items.${review.key}.reply`)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.footer}>
                <Pressable
                  style={({ pressed }) => [liteShared.row, pressed && liteShared.pressed]}
                  onPress={comingSoon}
                  hitSlop={6}
                >
                  <HomeIcon name="thumbUp" size={18} color="#5C5F60" />
                  <Text style={styles.meta}>
                    {t('hotels.lite.reviews.helpful', { count: 12 - index * 4 })}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => pressed && liteShared.pressed}
                  onPress={comingSoon}
                  hitSlop={6}
                >
                  <Text style={styles.meta}>{t('hotels.lite.reviews.report')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  score: { fontFamily: fonts.interBold, fontSize: 40, lineHeight: 48, color: colors.primary },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreLabel: { width: 110 },
  bar: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.softBlue },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.primary },
  scoreValue: {
    width: 40,
    textAlign: 'right',
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },

  reviewCard: { padding: 25, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 999 },
  author: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#141D23' },
  meta: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: '#5C5F60' },

  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(32, 77, 218, 0.2)',
    backgroundColor: 'rgba(66, 104, 244, 0.1)',
  },
  scorePillValue: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 28, color: colors.primary },
  scorePillMax: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16, color: colors.primary },

  reviewTitle: { fontFamily: fonts.interSemi, fontSize: 18, lineHeight: 24, color: colors.heading },

  photos: { flexDirection: 'row', gap: 12 },
  photo: { width: 192, height: 128, borderRadius: 32 },

  reply: {
    gap: 8,
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 16,
    borderRadius: 32,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(32, 77, 218, 0.3)',
    backgroundColor: '#ECF5FE',
  },
  replyFrom: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: '#141D23' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 197, 215, 0.3)',
  },
});
