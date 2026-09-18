/**
 * 关怀模式「实景预览」页(Figma `Hotel Details Lite` / Property Preview `2352:7051`)
 *
 * 信息页底部的入口落到这里。设计稿三段:
 *   QuickFilterTabs  按区域筛的横滑页签(全部 / 客房 / 泳池 / 餐厅 …)
 *   Video360Section  360°/视频区(一张大图 + 播放键)
 *   FacilitiesSection 设施照片墙(两列)
 *
 * **图片来源**:用 `/app/goods/detail` 的 `images`;不足时用设计稿临时图补位
 * (与结果页 / 房卡同一套 `tempCoverFor`)。
 *
 * **未实现**:360° 全景与视频播放本身 —— 项目没有引入全景/播放器依赖
 * (完整模式详情页的 360°/全景按钮同样是 comingSoon),这里点播放键也走 comingSoon。
 * 页签的「区域」后端没有字段,只作前端分组展示,切换不会改变图片集合 —— 故同样走 comingSoon。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { tempCoverFor } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import { liteShared } from '@/components/hotel/lite/liteShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import type { GoodsDetail } from '@/types/models';

/** 设计稿的四个区域页签(后端无对应字段,见文件头) */
const AREA_TABS = ['all', 'rooms', 'pool', 'dining'] as const;

export default function PropertyPreviewLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'PropertyPreviewLite'>>().params;
  const showToast = useCommonStore((s) => s.showToast);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<(typeof AREA_TABS)[number]>('all');

  const comingSoon = () => showToast(t('home.comingSoon'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchHotelDetail(params.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error || !detail) return <ErrorView message={error} onRetry={() => void load()} />;

  const images = detail.images ?? [];
  /** 设施墙至少铺 6 格,接口图不够就用临时图补位 */
  const tiles = Array.from({ length: Math.max(6, images.length) }, (_, i) =>
    images[i] ? { uri: images[i] } : tempCoverFor(i),
  );
  const heroSource = images[0] ? { uri: images[0] } : tempCoverFor(0);

  return (
    <View style={liteShared.root}>
      <SafeAreaView style={liteShared.safe} edges={['top']}>
        <View style={liteShared.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={liteShared.topTitle} numberOfLines={1}>
            {t('hotels.lite.preview.title')}
          </Text>
        </View>

        <ScrollView
          style={liteShared.flex}
          contentContainerStyle={liteShared.main}
          showsVerticalScrollIndicator={false}
        >
          {/* 区域页签 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tabs}>
              {AREA_TABS.map((key) => {
                const active = key === tab;
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.tab,
                      active && styles.tabActive,
                      pressed && liteShared.pressed,
                    ]}
                    onPress={() => {
                      setTab(key);
                      if (key !== 'all') comingSoon();
                    }}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {t(`hotels.lite.preview.tabs.${key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* 360°/视频 */}
          <View style={liteShared.card}>
            <Text style={liteShared.sectionTitle}>{t('hotels.lite.preview.video360')}</Text>
            <Pressable
              style={({ pressed }) => [styles.hero, pressed && liteShared.pressed]}
              onPress={comingSoon}
            >
              <Image source={heroSource} style={styles.heroImage} resizeMode="cover" />
              <View style={styles.playBtn}>
                <HomeIcon name="play" size={28} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={liteShared.body}>{t('hotels.lite.preview.video360Hint')}</Text>
          </View>

          {/* 设施照片墙 */}
          <View style={liteShared.card}>
            <Text style={liteShared.sectionTitle}>{t('hotels.lite.preview.facilities')}</Text>
            <View style={styles.grid}>
              {tiles.map((source, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [styles.tile, pressed && liteShared.pressed]}
                  onPress={comingSoon}
                >
                  <Image source={source} style={styles.tileImage} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.heading },
  tabTextActive: { color: '#FFFFFF' },

  hero: { width: '100%', height: 200, borderRadius: 24, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  playBtn: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -32,
    marginTop: -32,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  /* 两列:卡片内宽 = 屏宽 − 页边距 32 − 卡片内边距 48;这里用百分比避免再算一次像素 */
  tile: { width: '48%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden' },
  tileImage: { width: '100%', height: '100%' },
});
