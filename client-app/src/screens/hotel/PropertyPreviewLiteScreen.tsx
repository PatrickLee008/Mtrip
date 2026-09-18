/**
 * 关怀模式「实景预览」页(Figma `Hotel Details Lite` / Property Preview `2352:7051`)
 *
 * 2026-09-18 按该帧**严格重做版式**。设计数据落档 `.figma-cache/2352-7051.txt`(整帧渲染图同目录 `2352-7051.png`)。
 * 页底是纯白 `#FFFFFF`,三段都**没有白卡外壳** —— 与同族另外三屏(`liteShared` 的 `#EBF0FF`
 * 页底 + 白卡)观感不同,这是照帧的结果,不是漏改。
 *
 * 稿面结构:
 *   顶栏 `2352:7107`     返回箭头 20 + "Back"(Inter 600/24 `#204DDA`);底色 `#FEFEFE` + Effect/DS。
 *                        稿中该栏是 y=54 的绝对定位、页面 content 上留 117px —— 在 RN 里等价于
 *                        `SafeAreaView(top)` + 常规流里的顶栏(54 状态栏 + 63 顶栏),不再绝对定位。
 *   QuickFilterTabs      "Property overview"(Inter 700/18/28 `#1B1D30`)→ 横滑缩略图页签
 *                        (Video/360 · Facilities · Rooms · Dining;标签 Inter 500/14/20 `#475569`)
 *   Video360Section      "Video/360"(Inter 700/20/28)→ 268.5 高圆角 20 大图,整图叠 `rgba(0,0,0,.1)`,
 *                        居中 64 毛玻璃圆内放 `view360`,圆下 8px 白字 "360°"(Inter 700/18/28 + 阴影)
 *   FacilitiesSection    "Facilities" → 小标 "Kids areas" → 223.75 高英雄图(圆角 20)
 *                        → 小标 "Pools & Gyms" → 两列网格(格底 `#F3F4F6` 圆角 8,内图 171 圆角 20)
 *
 * **3 处稿面无法直译,已取最接近值近似(推定值,拿到设计侧明确值后替换)**:
 *   1. 缩略图**宽度**:稿中 tab 帧是 hug、其内图帧是 fill,宽度没落值 → 取 120(高度 83.5 是稿面值)。
 *   2. 顶栏**箭头颜色**:稿中该 SVG 的 fill 为空(`fill_97d170e1: []`)→ 与 "Back" 文案同色 `#204DDA`。
 *   3. **毛玻璃圆** `backdrop-filter: blur(2px)` 与 "360°" 的**两层 text-shadow**:RN 都不支持 →
 *      blur 用 40% 白底 + 1px 60% 白描边近似;阴影取主导层 `0/4 blur3`(与 theme 里"多层取主导层"同一口径)。
 *
 * **图片来源**:仍走 `/app/goods/detail` 的 `images`,按下标取用、不足处用 `tempCoverFor(i)` 兜底
 * (360 用 [0]、四张页签用 [0..3]、设施英雄图用 [4]、网格用 [5][6])——各位置不重复用同一张。
 *
 * **未实现**(与完整模式详情页同一口径):360° 全景与视频播放本身;页签的「区域」筛选
 * (后端无区域字段,`facilities` 只是扁平 key 列表),点页签走 comingSoon。
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
import { PAGE_PADDING, colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import type { GoodsDetail } from '@/types/models';

/** 稿面的四个区域页签(后端无对应字段,见文件头) */
const AREA_TABS = ['video360', 'facilities', 'rooms', 'dining'] as const;

/** 设施网格两个格子的取图下标(避开 360 与页签已用掉的 [0..3]) */
const FACILITY_TILE_INDICES = [5, 6] as const;

export default function PropertyPreviewLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'PropertyPreviewLite'>>().params;
  const showToast = useCommonStore((s) => s.showToast);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  /** 按下标取后端图,不够时用设计稿临时图兜底(同一下标不重复取同一张) */
  const pick = (index: number) => (images[index] ? { uri: images[index] } : tempCoverFor(index));

  return (
    <View style={styles.page}>
      <SafeAreaView style={liteShared.flex} edges={['top']}>
        <View style={styles.appBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={20} color={colors.previewBack} />
          </Pressable>
          <Text style={styles.appBarText}>{t('hotels.lite.preview.back')}</Text>
        </View>

        <ScrollView
          style={liteShared.flex}
          contentContainerStyle={styles.main}
          showsVerticalScrollIndicator={false}
        >
          {/* QuickFilterTabs */}
          <View style={styles.sectionTabs}>
            <Text style={styles.overviewTitle}>{t('hotels.lite.preview.overview')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tabRow}>
                {AREA_TABS.map((key, index) => (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.tab, pressed && liteShared.pressed]}
                    onPress={comingSoon}
                  >
                    <Image source={pick(index)} style={styles.tabThumb} resizeMode="cover" />
                    <Text style={styles.tabLabel}>{t(`hotels.lite.preview.tabs.${key}`)}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Video360Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('hotels.lite.preview.video360')}</Text>
            {/* 阴影层与裁剪层分开:iOS 上 overflow:'hidden' 会把同一视图的 shadow 一起裁掉 */}
            <Pressable
              style={({ pressed }) => [styles.panoShadow, pressed && liteShared.pressed]}
              onPress={comingSoon}
            >
              <View style={styles.panoBox}>
                <Image source={pick(0)} style={styles.panoImage} resizeMode="cover" />
                <View style={styles.panoOverlay}>
                  <View style={styles.panoBadge}>
                    <HomeIcon name="view360" size={40} color="#FFFFFF" />
                  </View>
                  <Text style={styles.panoLabel}>360°</Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* FacilitiesSection */}
          <View style={styles.sectionFacilities}>
            <Text style={styles.sectionTitle}>{t('hotels.lite.preview.facilities')}</Text>
            <Text style={styles.groupLabel}>{t('hotels.lite.preview.facilityGroups.kids')}</Text>
            <View style={styles.facilityBody}>
              {/* 同 panoShadow:阴影层不裁剪,裁剪交给内层 */}
              <Pressable
                style={({ pressed }) => [styles.facilityHeroShadow, pressed && liteShared.pressed]}
                onPress={comingSoon}
              >
                <View style={styles.facilityHeroBox}>
                  <Image source={pick(4)} style={styles.facilityHero} resizeMode="cover" />
                </View>
              </Pressable>
              <Text style={styles.groupLabel}>{t('hotels.lite.preview.facilityGroups.pools')}</Text>
              <View style={styles.facilityGrid}>
                {FACILITY_TILE_INDICES.map((index) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [styles.facilityTile, pressed && liteShared.pressed]}
                    onPress={comingSoon}
                  >
                    <Image source={pick(index)} style={styles.facilityTileImage} resizeMode="cover" />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  /* 稿面页底是纯白 `#FFFFFF`(同族另外三屏用 liteShared 的 `#EBF0FF` 页底 + 白卡,本页照帧不走那一套) */
  page: { flex: 1, backgroundColor: '#FFFFFF' },

  /* 顶栏:稿面 `2352:7107` —— 底色 #FEFEFE + Effect/DS(0/1 blur2 黑 5%)= shadows.subtle */
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  /* 稿面 `2352:7111`:Inter SemiBold 24 —— 颜色不是 primary,见 theme.previewBack 注释 */
  appBarText: {
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 30,
    color: colors.previewBack,
  },

  /* Main:稿面 padding 0 0 40,内容 gap 24 */
  main: { paddingBottom: 40, gap: 24 },

  /* Section - QuickFilterTabs:稿面 padding 0 16,gap 16 */
  sectionTabs: { paddingHorizontal: PAGE_PADDING, gap: 16 },
  /* 稿面 `2352:7055`:Inter Bold 18/28 #1B1D30 */
  overviewTitle: {
    fontFamily: fonts.interBold,
    fontSize: 18,
    lineHeight: 28,
    color: colors.heading,
  },
  /* 稿面 `2352:7056`:row,gap 12 */
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /* 稿面 EL-378b8db1:标签容器是 column + alignItems center,标签要居中在缩略图正下方 */
  tab: { gap: 8, alignItems: 'center' },
  /** 高度 83.5 是稿面值;**宽度 120 是推定值**(稿中 tab 帧 hug、内层图帧 fill,宽度未落值) */
  tabThumb: { width: 120, height: 83.5, borderRadius: 8 },
  /* 稿面 `2352:7061`:Inter Medium 14/20 #475569,居中 */
  tabLabel: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.previewTabLabel,
    textAlign: 'center',
  },

  /* Video360Section / FacilitiesSection:稿面 padding 0 16 */
  section: { paddingHorizontal: PAGE_PADDING, gap: 16 },
  sectionFacilities: { paddingHorizontal: PAGE_PADDING, gap: 8 },
  /* 稿面 `2352:7079` / `2352:7094`:Inter Bold 20/28 #1B1D30 */
  sectionTitle: {
    fontFamily: fonts.interBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.heading,
  },

  /**
   * 稿面 `2352:7080`:圆角 20 + Effect/DS。
   * 阴影层与裁剪层必须分开 —— iOS 上 `overflow:'hidden'` 会把同一视图的 shadow 一起裁掉,
   * 两者写在同一个块里等于没有阴影(同族 `LiteHotelCard.card` 就有这个隐患,本页不跟)。
   */
  panoShadow: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  /** 只负责把大图裁成圆角 20(稿面 `2352:7081` 的图节点本身没写圆角,靠容器裁) */
  panoBox: { borderRadius: 20, overflow: 'hidden' },
  /* 稿面 `2352:7081`:高 268.5 */
  panoImage: { width: '100%', height: 268.5 },
  /* 稿面 `2352:7082`:铺满 + rgba(0,0,0,.1),内容居中 */
  panoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  /* 稿面 `2352:7084`:64 圆,rgba(255,255,255,.4) 底 + 1px rgba(255,255,255,.6) 描边 */
  panoBadge: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  /* 稿面 `2352:7089` 的 8px 上边距 + `2352:7091`:Inter Bold 18/28 白 + 两层投影取主导层 */
  panoLabel: {
    marginTop: 8,
    fontFamily: fonts.interBold,
    fontSize: 18,
    lineHeight: 28,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.07)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 3,
  },

  /* 稿面 `2352:7096` / `2352:7101`:Inter SemiBold 16/24 #8B8C91 */
  groupLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 24,
    color: colors.previewSubheading,
  },
  /* 稿面 `2352:7097`:padding 8px 0 0,gap 16 */
  facilityBody: { paddingTop: 8, gap: 16 },
  /* 稿面 `2352:7098`:圆角 20 + Effect/DS —— 同 panoShadow,阴影层不裁剪 */
  facilityHeroShadow: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  facilityHeroBox: { borderRadius: 20, overflow: 'hidden' },
  /* 稿面 `2352:7099`:高 223.75 */
  facilityHero: { width: '100%', height: 223.75 },
  /* 稿面 `2352:7102`:row,gap 16,两列 */
  facilityGrid: { flexDirection: 'row', gap: 16 },
  /**
   * 稿面 `2352:7103`:格底 `#F3F4F6` 圆角 8 —— 它只是图未铺满时的占位底,
   * 真实可见圆角来自下面那张图自己的 20,所以这里**不能** `overflow:'hidden'`:
   * 否则整格被父级裁成 8,与稿面 `2352:7104` 的 20 不符。
   */
  facilityTile: {
    flex: 1,
    height: 171,
    borderRadius: 8,
    backgroundColor: colors.previewTileBg,
  },
  /* 稿面 `2352:7104`:高 171,圆角 20(可见圆角以这层为准) */
  facilityTileImage: { width: '100%', height: '100%', borderRadius: 20 },
});
