/**
 * 关怀模式酒店搜索页(Figma section `Hotel Search Lite` `2312:6435`)
 *
 * 对应设计稿四张:
 *   Search 14 `2312:6436` 默认态 / Search 15 `2312:6582` 搜索框聚焦 /
 *   Search 16 `2312:6653` 输入中(建议列表)/ Search 18 `2492:9680` 已选目的地
 * 四张是**同一页的四个状态**,所以落成一个组件 + 一个 `focused` 状态,不拆四个页面。
 *
 * 与完整模式 `HotelsScreen`(91:200)的关系:同一条搜索链路,但关怀版把每个元素放大一档
 * (标题 24→32、搜索框文字 16→24、CTA 16→24),并且**只留搜索卡** ——
 * 完整版卡下面的阶梯折扣卡 / 促销卡 / 广告位在关怀稿里全部没有,不要补。
 *
 * 设计稿实测:
 *   页面   底色 --background;顶部大图 402x268 贴在状态栏下方,Main 自 y=174 起(与大图重叠)
 *   顶部栏 绝对定位,px20 py16;左右各一枚黑 40% 药丸(圆角 20):返回(图标 32)/「how do I book ?」
 *   搜索卡 --tab 底,1px #E6EEFF,圆角 24,padding 25,内部 gap 16,投影 0/20 blur20 rgba(15,41,77,.08)
 *   标题   Inter Bold 32 主色,居中
 *   搜索框 #EFF4FF 圆角 12,高 64,p12,gap12:20 放大镜 + 输入(Inter 600/24,占位 --text-2)+ 20 麦克风
 *   日期   两列各占一半,高 60,p12,gap8:24 日历图标 + (标签 Inter 600/12 --text-2 / 值 Inter 600/16)
 *   入住人 整宽,同日期行的排版
 *   公民   20 复选框 + Inter 400/12 --text-2 + 20 info
 *   CTA    主色圆角 12,py16,Outfit 400/24 白色
 *
 * 未接通的能力一律 comingSoon(与完整模式同口径):语音搜索、Nearby、Search on Map、
 * 「how do I book ?」、Myanmar Citizen 的说明。**最近搜索是真的**:存本地(最多 3 条),
 * 选中即回填目的地。
 */

import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import HotelGuideOverlay from '@/components/hotel/guide/HotelGuideOverlay';
import DatePickerSheet, {
  DateRangeValue,
  defaultDateRange,
} from '@/components/hotel/DatePickerSheet';
import GuestRoomSheet, {
  DEFAULT_GUEST_ROOM,
  type GuestRoomValue,
} from '@/components/hotel/lite/GuestRoomSheet';
import { STORAGE_KEYS } from '@/config/global';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';
import { storage } from '@/utils/storage';

const HERO = require('../../../assets/images/hotels/hero.png');

/** 设计稿大图 402x268 贴状态栏下沿,Main 自 y=174 起 */
const HERO_HEIGHT = 268;
const MAIN_TOP = 174;
/** 最近搜索最多留几条(设计稿画了 3 条) */
const RECENT_MAX = 3;

export default function HotelsLiteScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showToast = useCommonStore((s) => s.showToast);

  const [keyword, setKeyword] = useState('');
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [range, setRange] = useState<DateRangeValue>(defaultDateRange);
  const [guests, setGuests] = useState<GuestRoomValue>(DEFAULT_GUEST_ROOM);
  const [citizen, setCitizen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const comingSoon = () => showToast(t('home.comingSoon'));

  /* 最近搜索存本地,每次回到本页重新读(在结果页里也可能刚写过) */
  useFocusEffect(
    useCallback(() => {
      void storage
        .getObject<string[]>(STORAGE_KEYS.HOTEL_RECENT)
        .then((rows) => setRecent(Array.isArray(rows) ? rows.slice(0, RECENT_MAX) : []));
    }, []),
  );

  const formatDay = (key: string) => {
    if (!key) return t('hotels.lite.pickDate');
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(i18n.language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const guestLabel = t('hotels.lite.guestSummary', {
    adults: guests.adults,
    rooms: guests.rooms,
  });

  /** 把这次搜的目的地记进最近搜索(去重、最多 3 条) */
  const rememberKeyword = (kw: string) => {
    if (!kw) return;
    const next = [kw, ...recent.filter((r) => r !== kw)].slice(0, RECENT_MAX);
    setRecent(next);
    void storage.setObject(STORAGE_KEYS.HOTEL_RECENT, next);
  };

  const search = () => {
    const kw = keyword.trim();
    rememberKeyword(kw);
    setFocused(false);
    navigation.navigate('HotelResultsLite', {
      ...(kw ? { keyword: kw } : {}),
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      flexDays: range.flexDays,
      citizen,
      rooms: guests.rooms,
      adults: guests.adults,
      children: guests.children,
    });
  };

  return (
    <View style={styles.root}>
      <Image source={HERO} style={styles.hero} resizeMode="cover" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* 顶部栏:两枚黑 40% 药丸 */}
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={32} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.pill, styles.helpPill, pressed && styles.pressed]}
            onPress={() => setGuideOpen(true)}
            hitSlop={8}
          >
            <Text style={styles.helpText}>{t('hotels.lite.howToBook')}</Text>
            <HomeIcon name="questionCircle" size={32} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>{t('hotels.lite.title')}</Text>

            {/* 目的地:聚焦后卡片下方展开 Nearby / Search on Map / 最近搜索 */}
            <View style={styles.field}>
              <HomeIcon name="search" size={20} color={colors.primary} />
              <TextInput
                style={styles.searchInput}
                value={keyword}
                onChangeText={setKeyword}
                onFocus={() => setFocused(true)}
                placeholder={t(focused ? 'hotels.lite.searchFocusHint' : 'hotels.lite.searchHint')}
                placeholderTextColor={colors.textSoft}
                returnKeyType="search"
                onSubmitEditing={search}
              />
              <Pressable onPress={comingSoon} hitSlop={8}>
                <HomeIcon name="mic" size={20} color={colors.primary} />
              </Pressable>
            </View>

            {focused ? (
              <View style={styles.panel}>
                {/* 输入中:先给「用这个词搜」的建议行(没有地点库,故不编造联想词) */}
                {keyword.trim() ? (
                  <Pressable
                    style={({ pressed }) => [styles.panelRow, pressed && styles.pressed]}
                    onPress={search}
                  >
                    <HomeIcon name="search" size={20} color={colors.primary} />
                    <Text style={styles.panelText} numberOfLines={1}>
                      {keyword.trim()}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.panelRow, pressed && styles.pressed]}
                  onPress={comingSoon}
                >
                  <HomeIcon name="location" size={20} color={colors.primary} />
                  <Text style={styles.panelText}>{t('hotels.lite.nearby')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.panelRow, pressed && styles.pressed]}
                  onPress={comingSoon}
                >
                  <HomeIcon name="map" size={20} color={colors.primary} />
                  <Text style={styles.panelText}>{t('hotels.lite.searchOnMap')}</Text>
                </Pressable>

                {recent.length ? (
                  <View style={styles.recent}>
                    <Text style={styles.recentTitle}>{t('hotels.lite.recentSearch')}</Text>
                    {recent.map((item) => (
                      <Pressable
                        key={item}
                        style={({ pressed }) => [styles.panelRow, pressed && styles.pressed]}
                        onPress={() => {
                          setKeyword(item);
                          setFocused(false);
                        }}
                      >
                        <HomeIcon name="clock" size={20} color={colors.primary} />
                        <Text style={styles.panelText} numberOfLines={1}>
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* 入住 / 离店:两列共用一个日期浮层 */}
            <View style={styles.dateRow}>
              <Pressable
                style={({ pressed }) => [styles.field, styles.dateField, pressed && styles.pressed]}
                onPress={() => {
                  setFocused(false);
                  setDateOpen(true);
                }}
              >
                <HomeIcon name="calendar2" size={24} color={colors.primary} />
                <View style={styles.flexCol}>
                  <Text style={styles.fieldLabel}>{t('hotels.lite.checkIn')}</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {formatDay(range.checkIn)}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.field, styles.dateField, pressed && styles.pressed]}
                onPress={() => {
                  setFocused(false);
                  setDateOpen(true);
                }}
              >
                <HomeIcon name="calendar2" size={24} color={colors.primary} />
                <View style={styles.flexCol}>
                  <Text style={styles.fieldLabel}>{t('hotels.lite.checkOut')}</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {formatDay(range.checkOut)}
                  </Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.field, styles.guestField, pressed && styles.pressed]}
              onPress={() => {
                setFocused(false);
                setGuestOpen(true);
              }}
            >
              <HomeIcon name="people" size={24} color={colors.primary} />
              <View style={styles.flexCol}>
                <Text style={styles.fieldLabel}>{t('hotels.lite.guests')}</Text>
                <Text style={styles.fieldValue} numberOfLines={1}>
                  {guestLabel}
                </Text>
              </View>
            </Pressable>

            <View style={styles.citizenRow}>
              <Pressable
                style={({ pressed }) => [styles.citizen, pressed && styles.pressed]}
                onPress={() => setCitizen((v) => !v)}
                hitSlop={6}
              >
                <HomeIcon
                  name={citizen ? 'checkboxIndeterminate' : 'checkbox'}
                  size={20}
                  color={citizen ? colors.primary : colors.softBlue}
                />
                <Text style={styles.citizenText}>{t('hotels.myanmarCitizen')}</Text>
              </Pressable>
              <Pressable onPress={comingSoon} hitSlop={8}>
                <HomeIcon name="infoCircle" size={20} color={colors.textSoft} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={search}
            >
              <Text style={styles.ctaText}>{t('hotels.lite.search')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      <DatePickerSheet
        visible={dateOpen}
        value={range}
        onClose={() => setDateOpen(false)}
        onConfirm={(value) => {
          setRange(value);
          setDateOpen(false);
        }}
      />
      <GuestRoomSheet
        visible={guestOpen}
        value={guests}
        onClose={() => setGuestOpen(false)}
        onConfirm={(value) => {
          setGuests(value);
          setGuestOpen(false);
        }}
      />

      {/* 顶栏「how do I book ?」的落地页:与完整模式同一套引导,字号放大一档 */}
      <HotelGuideOverlay visible={guideOpen} onClose={() => setGuideOpen(false)} lite />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  /**
   * 必须显式给 `width: '100%'`,不能只靠 `left:0 + right:0` 拉伸 ——
   * react-native-web 的 `Image` 会把 `require()` 资源的固有尺寸(hero.png 是 1024×683)
   * 写成显式 `width`,而 CSS 里 `width` 一有值就压过 `right`,H5 端整张图会按 1024 铺开,
   * 把页面横向撑出 600+ px(原生 RN 下 left/right 能拉伸,所以只在 H5 露出来)。
   */
  hero: { position: 'absolute', left: 0, top: 0, width: '100%', height: HERO_HEIGHT },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  /* 设计稿还叠了 4px 背景模糊,RN 无原生 backdrop-blur(未引入 expo-blur),只保留底色 */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  helpPill: { gap: 4, paddingHorizontal: 12 },
  helpText: { fontFamily: fonts.inter, fontSize: 24, lineHeight: 28, color: '#FFFFFF' },

  main: {
    paddingTop: MAIN_TOP - 68,
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 20,
    gap: 24,
  },

  card: {
    width: '100%',
    padding: 25,
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6EEFF',
    backgroundColor: colors.surface,
    shadowColor: 'rgba(15, 41, 77, 1)',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
    elevation: 6,
  },
  title: {
    fontFamily: fonts.interBold,
    fontSize: 32,
    lineHeight: 40,
    color: colors.primary,
    textAlign: 'center',
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 64,
    padding: 12,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  /* minWidth 0 同项目既有输入框:web 端 <input> 的 min-width:auto 会把右侧麦克风挤出去 */
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },

  panel: { gap: 12 },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  panelText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 28,
    color: colors.heading,
  },
  recent: { gap: 12, paddingTop: 4 },
  recentTitle: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dateField: { flex: 1, minWidth: 0, height: 60, gap: 8 },
  guestField: { height: 60, gap: 8 },
  flexCol: { flex: 1, minWidth: 0 },
  fieldLabel: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  fieldValue: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },

  citizenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  citizen: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  citizenText: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 24, color: colors.textSoft },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: { fontFamily: fonts.outfit, fontSize: 24, lineHeight: 28, color: '#FFFFFF' },

  pressed: { opacity: 0.85 },
});
