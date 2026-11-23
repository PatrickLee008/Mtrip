/**
 * 酒店搜索页(按 Figma M-Trip / Search 1 91:200 重做)
 *
 * 结构:顶部大图 → 悬浮顶部栏(返回 / 筛选)→ 搜索筛选卡 → 阶梯折扣卡 → 促销卡 → 广告位。
 * 搜索卡内容:标题 → 目的地搜索 → 入住/离店(两列)→ 入住人 → Myanmar Citizen(+ 说明 i)→ Search CTA。
 *
 * 设计稿实测:
 *   大图     402x268,顶部对齐;Main 从页面 y=174 起(即大图下方 148px 处与其重叠)
 *   搜索卡   --tab 底,1px #E6EEFF 描边,圆角 32,padding 25,内部 gap 16
 *            投影 0/20 blur20 rgba(15,41,77,0.08)
 *   字段     #EFF4FF,圆角 12,padding 12;搜索框高 64,日期/入住人高 60
 *   CTA      主色,py16,圆角 12,Outfit 400/16
 *   折扣卡   --tab 底,1px --secondary 描边,圆角 32,padding 24,gap 16;四行整体 50% 透明
 *   广告位   320:180 比例,白底,1px --secondary 描边,圆角 32
 *
 * 入住/离店拉起 DatePickerSheet(695:1428),选中的区间与弹性天数随 Search 带到结果页,
 * 结果页据此只列有房的酒店。
 *
 * 未实现的能力(设计稿有、当前没有对应依赖或接口),一律走 comingSoon:
 *   目的地定位、入住人选择
 * Search 提交后以结果页 HotelResults(设计稿 1695:6325)替换本页,带上关键词/日期/公民身份(返回直接回首页)。
 * 顶部栏筛选按钮拉起 HotelFilterSheet(408:1824);点 Show Results 即带着当前搜索卡条件
 * 与所选筛选跳结果页,之后点 Search 也会带上同一份筛选。
 */

import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import SupportChatFab from '@/components/chat/SupportChatFab';
import HomeIcon from '@/components/home/HomeIcon';
import PromoCard from '@/components/home/PromoCard';
import DatePickerSheet, {
  DateRangeValue,
  defaultDateRange,
} from '@/components/hotel/DatePickerSheet';
import HotelFilterSheet, {
  DEFAULT_HOTEL_FILTER,
  HotelFilterValue,
} from '@/components/hotel/HotelFilterSheet';
import HotelGuideOverlay from '@/components/hotel/guide/HotelGuideOverlay';
import GuestRoomSheet, { DEFAULT_GUEST_ROOM } from '@/components/hotel/lite/GuestRoomSheet';
import { CitizenCheck, GuidePill } from '@/components/hotel/HotelSearchBits';
import { GOODS_TYPE } from '@/config/global';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { useCommonStore } from '@/store/commonStore';

const HERO = require('../../../assets/images/hotels/hero.png');

/** 设计稿大图 402x268,Main 从 y=174 开始(状态栏 54 之下 120),故与大图重叠 148 */
const HERO_HEIGHT = 268;
const MAIN_OVERLAP = HERO_HEIGHT - 120;

/** 设计稿示例是「今天 → 两天后」,先按同样的默认值展示 */
const DEFAULT_NIGHTS = 2;

export default function HotelsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const longStay = useRoute<RouteProp<RootStackParamList, 'Hotels'>>().params?.longStay;
  const showToast = useCommonStore((s) => s.showToast);

  const [keyword, setKeyword] = useState('');
  const [citizen, setCitizen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [filter, setFilter] = useState<HotelFilterValue>(DEFAULT_HOTEL_FILTER);
  const [dateOpen, setDateOpen] = useState(false);
  const [guests, setGuests] = useState(DEFAULT_GUEST_ROOM);
  const [guestOpen, setGuestOpen] = useState(false);
  const [range, setRange] = useState<DateRangeValue>(() => defaultDateRange(DEFAULT_NIGHTS));

  const comingSoon = () => showToast(t('home.comingSoon'));

  /* 设计稿的日期形如 Wed, Jun 3;跟随当前语言,zh-CN 会渲染成中文写法 */
  const formatDay = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(i18n.language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * 跳搜索结果页(设计稿 1695:6325),把当前搜索卡的条件一起带过去。
   * 用 replace 而不是 navigate:结果页标题、大图、搜索卡都与本页相同且可继续改条件,
   * 本页若留在栈里,结果页点返回会落回这页,看起来像返回键没反应(QA CA_TC_026);
   * 替换后结果页返回直接回首页。
   */
  const search = (next: HotelFilterValue = filter) => {
    const kw = keyword.trim();
    navigation.replace('HotelResults', {
      ...(kw ? { keyword: kw } : {}),
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      flexDays: range.flexDays,
      citizen,
      longStay,
      ...(longStay ? guests : {}),
      filter: next,
    });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={HERO} style={styles.hero} resizeMode="cover" />

          <View style={styles.main}>
            {/* 01 搜索筛选卡 */}
            <View style={styles.searchCard}>
              <Text style={styles.searchTitle}>{t(longStay ? 'hotels.longStay.title' : 'hotels.title')}</Text>

              <View style={[styles.field, styles.searchField]}>
                <HomeIcon name="search" size={18} color={colors.primary} />
                <TextInput
                  style={styles.searchInput}
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder={t('hotels.searchPlaceholder')}
                  placeholderTextColor={colors.textSoft}
                  returnKeyType="search"
                  onSubmitEditing={() => search()}
                />
                <Pressable onPress={comingSoon} hitSlop={8}>
                  <HomeIcon name="locationFilled" size={20} color={colors.primary} />
                </Pressable>
              </View>

              <View style={styles.dateRow}>
                {(['checkIn', 'checkOut'] as const).map((field) => (
                  <Pressable
                    key={field}
                    style={({ pressed }) => [
                      styles.field,
                      styles.dateField,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setDateOpen(true)}
                  >
                    <HomeIcon name="calendar" size={20} color={colors.primary} />
                    <View>
                      <Text style={styles.fieldLabel}>
                        {t(field === 'checkIn' ? 'hotels.checkIn' : 'hotels.checkOut')}
                      </Text>
                      <Text style={styles.fieldValue}>{formatDay(range[field])}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [styles.field, styles.guestField, pressed && styles.pressed]}
                onPress={() => setGuestOpen(true)}
              >
                <HomeIcon name="travelers" size={22} color={colors.primary} />
                <View>
                  <Text style={styles.fieldLabel}>{t('hotels.guests')}</Text>
                  <Text style={styles.fieldValue}>
                    {t('hotels.guestsValue', { adults: guests.adults, rooms: guests.rooms })}
                  </Text>
                </View>
              </Pressable>

              <CitizenCheck value={citizen} onChange={setCitizen} />

              <Pressable
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
                onPress={() => search()}
              >
                <Text style={styles.ctaText}>{t('hotels.search')}</Text>
              </Pressable>
            </View>

            {/* 03 新用户促销(与首页同一张卡) */}
            <PromoCard
              onPress={() =>
                navigation.navigate('GoodsList', {
                  goodsType: GOODS_TYPE.HOTEL,
                  title: t('home.promo.category'),
                })
              }
            />

            {/* 04 广告位 */}
            <View style={styles.adSlot}>
              <Text style={styles.adTitle}>{t('hotels.adTitle')}</Text>
              <Text style={styles.adSize}>{t('hotels.adSize')}</Text>
            </View>
          </View>
        </ScrollView>

        {/* 顶部栏悬浮在大图上,不随内容滚动 */}
        <View style={styles.topBar} pointerEvents="box-none">
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="hotelTopBarGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#hotelTopBarGrad)" />
          </Svg>

          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <HomeIcon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.topRight}>
            {/* 用户指引(Coach mark 2150:4865) */}
            <GuidePill onPress={() => setGuideOpen(true)} />
            <Pressable
              style={({ pressed }) => [styles.roundBtn, styles.filterBtn, pressed && styles.pressed]}
              onPress={() => setFilterOpen(true)}
              hitSlop={8}
            >
              <HomeIcon name="filter" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* 平台客服入口「Chat with us」(PRD 模块 13;QA Home_TC_001 从 Hotel 页进入) */}
      <SupportChatFab bottom={28} />

      <HotelGuideOverlay visible={guideOpen} onClose={() => setGuideOpen(false)} />
      <GuestRoomSheet visible={guestOpen} value={guests} onClose={() => setGuestOpen(false)} onConfirm={(next) => {
        setGuests(next);
        setGuestOpen(false);
      }} />

      {/* 日期选择器:选中的区间回填搜索卡,Search 时带到结果页 */}
      <DatePickerSheet
        maxNights={longStay ? 30 : undefined}
        visible={dateOpen}
        value={range}
        onClose={() => setDateOpen(false)}
        onConfirm={(next) => {
          setRange(next);
          setDateOpen(false);
        }}
      />

      <HotelFilterSheet
        visible={filterOpen}
        value={filter}
        scope={{
          keyword: keyword.trim() || undefined,
          citizen: citizen ? 1 : undefined,
          checkIn: range.checkIn,
          checkOut: range.checkOut,
          flexDays: range.flexDays || undefined,
        }}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          setFilter(next);
          setFilterOpen(false);
          search(next);
        }}
        onComingSoon={comingSoon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  scroll: { paddingBottom: 32 },

  hero: { width: '100%', height: HERO_HEIGHT },
  main: {
    marginTop: -MAIN_OVERLAP,
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 20,
    gap: 24,
  },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  roundBtn: {
    padding: 8,
    borderRadius: 20,
    /* 设计稿还叠了 4px 背景模糊,RN 无原生 backdrop-blur(未引入 expo-blur),只保留底色 */
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  filterBtn: { borderRadius: 999 },
  /** 顶栏右侧:指引胶囊 + 筛选,间距 10 */
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#E6EEFF',
    padding: 25,
    gap: 16,
    /* 设计稿 0/20 blur20 rgba(15,41,77,0.08) */
    shadowColor: '#0F294D',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
    elevation: 4,
  },
  searchTitle: {
    fontFamily: fonts.interBold,
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  searchField: { height: 64 },
  searchInput: {
    flex: 1,
    /**
     * 必须显式给 0:web 端 TextInput 是 <input>,flex 子项默认 min-width:auto
     * 会拿输入框的固有宽度当收缩下限,flex:1 压不下去,右侧定位针会被挤出圆角框外
     */
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    color: colors.heading,
  },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1, height: 60 },
  guestField: { height: 60 },
  fieldLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
  },
  fieldValue: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },


  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.outfit,
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  tierCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
    padding: 24,
    gap: 16,
    /* 设计稿 Effect/DS:0/1 blur2 黑 5% */
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tierTitle: {
    fontFamily: fonts.interBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSoft,
  },
  /* 设计稿四行都是 50% 透明(尚未生效的档位) */
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
    opacity: 0.5,
  },
  tierNights: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  tierOff: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  adSlot: {
    width: '100%',
    aspectRatio: 320 / 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },
  adTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
  },
  adSize: {
    fontFamily: fonts.interSemi,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
