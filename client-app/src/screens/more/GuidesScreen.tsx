/**
 * 教程与指南(按 Figma M-Trip / More `2206:7544` Guides Tutorial Videos + `2206:7891` Guides 实现)
 *
 * 两张稿是同一页的两个页签,故合成一页 + Tutorials / Guides 两段页签:
 *   Tutorials(2206:7577):每张卡 = 160 高的封面(`#D0DAF2` 底 + 黑 30% 遮罩 + 56 白色圆形播放钮)
 *                        + 标题 Plus Jakarta Sans 600/20 + 说明/时长 Inter 400/16 `--text-2`
 *   Guides(2206:8245):每张卡只有一行标题 Inter 600/16 + 12×7.4 下拉箭头(折叠入口)
 *
 * 后端没有内容接口,视频与指南都取 moreDemo.ts 的设计稿值;
 * 播放与展开设计稿都没画二级页,统一走 comingSoon。
 * 标题字体设计稿用的是 Plus Jakarta Sans,App 只装了 Outfit / Inter 两套(见 config/typography),
 * 这里用同为几何无衬线的 Outfit 600 顶替,不为一处标题再引一套字体。
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_GUIDE_THUMBNAIL } from '@/assets/tempImages';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import HomeIcon from '@/components/home/HomeIcon';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import { GUIDE_ARTICLES, GUIDE_VIDEOS } from '@/screens/more/moreDemo';
import { useCommonStore } from '@/store/commonStore';

type GuideTab = 'tutorials' | 'guides';
const TABS: GuideTab[] = ['tutorials', 'guides'];

export default function GuidesScreen() {
  const { t } = useTranslation();
  const showToast = useCommonStore((s) => s.showToast);
  const [tab, setTab] = useState<GuideTab>('tutorials');

  const comingSoon = () => showToast(t('home.comingSoon'));

  return (
    <MorePageLayout title={t('more.guides.title')}>
      <SegmentedTabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        label={(item) => t(`more.guides.tabs.${item}`)}
      />

      {tab === 'tutorials'
        ? GUIDE_VIDEOS.map((video) => (
            <Pressable
              key={video}
              style={({ pressed }) => [moreShared.panel, styles.videoCard, pressed && moreShared.pressed]}
              onPress={comingSoon}
            >
              <View style={styles.cover}>
                <Image source={TEMP_GUIDE_THUMBNAIL} style={styles.coverImage} resizeMode="cover" />
                <View style={styles.coverMask}>
                  <View style={styles.playBtn}>
                    <HomeIcon name="play" width={14.667} height={18.667} color={colors.primary} />
                  </View>
                </View>
              </View>

              <View style={styles.videoText}>
                <Text style={styles.videoTitle}>{t(`more.guides.videos.${video}.title`)}</Text>
                <View style={styles.videoMetaRow}>
                  <Text style={styles.videoMeta} numberOfLines={1}>
                    {t(`more.guides.videos.${video}.desc`)}
                  </Text>
                  <Text style={styles.videoMeta}>
                    {t('more.guides.duration', { minutes: 2 })}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        : GUIDE_ARTICLES.map((article) => (
            <Pressable
              key={article}
              style={({ pressed }) => [moreShared.panel, pressed && moreShared.pressed]}
              onPress={comingSoon}
            >
              <View style={styles.articleRow}>
                <Text style={styles.articleTitle} numberOfLines={1}>
                  {t(`more.guides.articles.${article}`)}
                </Text>
                <HomeIcon name="chevronDown" width={12} height={7.4} color={colors.textSoft} />
              </View>
            </Pressable>
          ))}
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  videoCard: { gap: 12 },
  cover: {
    height: 160,
    borderRadius: 24,
    overflow: 'hidden',
    /* 设计稿封面底色,图片没铺满时透出来 */
    backgroundColor: '#D0DAF2',
  },
  coverImage: { width: '100%', height: '100%' },
  coverMask: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },

  videoText: { gap: 4 },
  /* 设计稿是 Plus Jakarta Sans 600/20 #111C2D,用 Outfit 600 顶替 */
  videoTitle: { fontFamily: fonts.outfitSemi, fontSize: 20, lineHeight: 28, color: '#111C2D' },
  videoMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  videoMeta: {
    flexShrink: 1,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textSoft,
  },

  articleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  articleTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 28,
    color: colors.heading,
  },
});
