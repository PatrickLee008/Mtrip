/**
 * 教程与指南(按 Figma M-Trip / More `2206:7544` Guides Tutorial Videos + `2206:7891` Guides 实现)
 *
 * 两张稿是同一页的两个页签,故合成一页 + Tutorials / Guides 两段页签:
 *   Tutorials(2206:7577):每张卡 = 160 高的封面(`#D0DAF2` 底 + 黑 30% 遮罩 + 56 白色圆形播放钮)
 *                        + 标题 Plus Jakarta Sans 600/20 + 说明/时长 Inter 400/16 `--text-2`
 *   Guides(2206:8245):每张卡只有一行标题 Inter 600/16 + 折叠入口箭头
 *
 * 数据:
 *   Tutorials 来自后台「教程管理」(GET /app/tutorial/list,按 X-Lang 返回「通用 + 当前语言」),
 *            点卡进 TutorialVideo 播放页;没配封面就用本地默认封面。
 *   Guides   目前只有「酒店预订指南」一篇,点开就是酒店搜索页问号入口的同一套七步用户指引(HotelGuideOverlay),
 *            关怀模式下用 lite 版。
 * 标题字体设计稿用的是 Plus Jakarta Sans,App 只装了 Outfit / Inter 两套(见 config/typography),
 * 这里用同为几何无衬线的 Outfit 600 顶替,不为一处标题再引一套字体。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchTutorials, type TutorialItem } from '@/api/tutorial';
import { TEMP_GUIDE_THUMBNAIL } from '@/assets/tempImages';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import HomeIcon from '@/components/home/HomeIcon';
import HotelGuideOverlay from '@/components/hotel/guide/HotelGuideOverlay';
import MorePageLayout from '@/components/more/MorePageLayout';
import { moreShared } from '@/components/more/moreShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { resolveMediaUri } from '@/utils/media';

type GuideTab = 'tutorials' | 'guides';
const TABS: GuideTab[] = ['tutorials', 'guides'];

export default function GuidesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const liteMode = useCommonStore((s) => s.liteMode);
  const [tab, setTab] = useState<GuideTab>('tutorials');
  const [videos, setVideos] = useState<TutorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    fetchTutorials()
      .then(setVideos)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openVideo = (video: TutorialItem) =>
    navigation.navigate('TutorialVideo', {
      id: video.id,
      category: video.category,
      title: video.title,
      description: video.description,
      videoUrl: video.video_url,
      coverUrl: video.cover_url,
    });

  return (
    <MorePageLayout title={t('more.guides.title')}>
      <SegmentedTabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        label={(item) => t(`more.guides.tabs.${item}`)}
      />

      {tab === 'tutorials' ? (
        loading ? (
          <ActivityIndicator style={styles.state} color={colors.primary} />
        ) : failed ? (
          <Pressable style={styles.state} onPress={load}>
            <Text style={styles.stateText}>{t('more.guides.loadFailed')}</Text>
          </Pressable>
        ) : videos.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.stateText}>{t('more.guides.empty')}</Text>
          </View>
        ) : (
          videos.map((video) => {
            const cover = resolveMediaUri(video.cover_url);
            return (
              <Pressable
                key={video.id}
                style={({ pressed }) => [moreShared.panel, styles.videoCard, pressed && moreShared.pressed]}
                onPress={() => openVideo(video)}
              >
                <View style={styles.cover}>
                  <Image
                    source={cover ? { uri: cover } : TEMP_GUIDE_THUMBNAIL}
                    style={styles.coverImage}
                    resizeMode="cover"
                  />
                  <View style={styles.coverMask}>
                    <View style={styles.playBtn}>
                      <HomeIcon name="play" width={14.667} height={18.667} color={colors.primary} />
                    </View>
                  </View>
                </View>

                <View style={styles.videoText}>
                  <Text style={styles.videoTitle}>{video.title}</Text>
                  <View style={styles.videoMetaRow}>
                    <Text style={styles.videoMeta} numberOfLines={1}>
                      {video.description}
                    </Text>
                    {video.duration_sec > 0 ? (
                      <Text style={styles.videoMeta}>
                        {t('more.guides.duration', { minutes: Math.max(1, Math.ceil(video.duration_sec / 60)) })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )
      ) : (
        <Pressable
          style={({ pressed }) => [moreShared.panel, pressed && moreShared.pressed]}
          onPress={() => setGuideOpen(true)}
        >
          <View style={styles.articleRow}>
            <Text style={styles.articleTitle} numberOfLines={1}>
              {t('more.guides.articles.hotelBooking')}
            </Text>
            <HomeIcon name="chevronDown" width={12} height={7.4} color={colors.textSoft} />
          </View>
        </Pressable>
      )}

      <HotelGuideOverlay visible={guideOpen} onClose={() => setGuideOpen(false)} lite={liteMode} />
    </MorePageLayout>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  stateText: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 22, color: colors.textSoft },

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
