/**
 * 酒店用户指引的七步插图(Figma section `Hotel Search Coach mark UI` `2150:4865`)
 *
 * 每一步只负责画「被讲解的那个东西」,遮罩 / 箭头 / 文案 / 底部控件都在 `HotelGuideOverlay`。
 *
 * **这些是插图,不是真实页面的挖洞高亮**:设计稿七张里,1~3 步高亮的是酒店搜索页本页元素,
 * 4~7 步高亮的是结果页 / 详情页 / 订房页 / 支付页的元素 —— 那几个页面当下并没有挂载,
 * 做不成真实高亮。设计稿本身也是「95% 黑遮罩 + 把元素副本画在遮罩之上」,
 * 所以七步统一成同一种做法:遮罩之上画一张该步的示例卡。
 *
 * **示例卡尽量复用现成组件与设计稿同源的演示数据,不新造**:
 *   步 4  `HotelResultCard` + `DEMO_RESULTS[0]`(就是稿上那家 The Heritage Bagan Hotel)
 *   步 5  `HotelRoomCard` + `DETAIL_ROOMS[0]`(稿上的 Standard Room / 4 Left / 1 Queen /
 *         32 sqft / MMK 195,000 与这条演示数据逐字段吻合),接线抄 `HotelRoomsTab` 的演示分支
 *   步 6  `FormInput`(订房第 2 步用的同一个)
 *   步 7  `PaymentMethodRow` + `TEMP_PAY_ICONS`(与 `BookingStepPayment` 同一套接线)
 *   步 1/2/3 是搜索卡里的三个字段,各自只有十几行,就地画(样式取自 `HotelsScreen`)
 *
 * 演示数据**不反映用户当前的搜索结果** —— 引导讲的是「长什么样、该看哪几个信息」。
 *
 * 关怀模式(`lite`)下:步 4/5 换成 Lite 版卡片,其余几步的字号跟着放大一档。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_PAY_ICONS, TEMP_ROOM_COVERS } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import HotelResultCard from '@/components/hotel/HotelResultCard';
import HotelRoomCard from '@/components/hotel/HotelRoomCard';
import PaymentMethodRow from '@/components/hotel/booking/PaymentMethodRow';
import { FormInput } from '@/components/hotel/booking/FormField';
import LiteHotelCard from '@/components/hotel/lite/LiteHotelCard';
import LiteRoomCard from '@/components/hotel/lite/LiteRoomCard';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import {
  DEMO_BADGE,
  DEMO_COVERS,
  DEMO_RATING_TIER,
  DEMO_RESULTS,
} from '@/screens/hotel/demoResults';
import { DETAIL_ROOMS, ROOM_FACILITY_ICONS } from '@/screens/hotel/detailDemo';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsSku } from '@/types/models';
import { formatMoney } from '@/utils/format';

/** 插图里的按钮一律不可点,回调给个空实现 */
const noop = () => undefined;

/** 设计稿这套 coach mark 讲的就是第一张演示卡 / 第一间演示房型 */
const DEMO_HOTEL = DEMO_RESULTS[0];
const DEMO_HOTEL_KEY = 'heritageBagan';
const DEMO_ROOM = DETAIL_ROOMS[0];

/** 关怀版房卡吃的是 `GoodsSku`,拿演示房型拼一条(字段与 `DETAIL_ROOMS[0]` 对齐) */
const DEMO_ROOM_SKU: GoodsSku = {
  id: -1,
  goods_id: -1,
  base_price: String(DEMO_ROOM.price),
  base_stock: DEMO_ROOM.left ?? 0,
  status: 1,
  sort: 0,
  max_guests: DEMO_ROOM.guests,
  breakfast: 1,
};

interface StepProps {
  lite: boolean;
}

/* ------------------------------------------------------------------ 01 目的地 */

function StepDestination({ lite }: StepProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.sheet}>
      <View style={[styles.field, styles.searchField, lite && styles.searchFieldLite]}>
        <HomeIcon name="search" size={lite ? 22 : 18} color={colors.primary} />
        <Text style={[styles.searchText, lite && styles.searchTextLite]} numberOfLines={1}>
          {t('hotels.searchPlaceholder')}
        </Text>
        <HomeIcon name="locationFilled" size={lite ? 24 : 20} color={colors.primary} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ 02 入离日期 */

function StepDates({ lite }: StepProps) {
  const { t } = useTranslation();
  /* 设计稿写死 Wed, Jun 3 → Fri, Jun 5;引导是静态插图,不跟随用户已选日期 */
  const cells = [
    { key: 'checkIn', label: t('hotels.checkIn'), value: 'Wed, Jun 3' },
    { key: 'checkOut', label: t('hotels.checkOut'), value: 'Fri, Jun 5' },
  ];
  return (
    /* 设计稿这一张的两格是直接浮在遮罩上的,没有白卡托底 */
    <View style={styles.dateRow}>
      {cells.map((cell) => (
        <View
          key={cell.key}
          style={[styles.field, styles.dateField, lite && styles.dateFieldLite]}
        >
          <HomeIcon name="calendar" size={lite ? 24 : 20} color={colors.primary} />
          <View>
            <Text style={[styles.fieldLabel, lite && styles.fieldLabelLite]}>{cell.label}</Text>
            <Text style={[styles.fieldValue, lite && styles.fieldValueLite]}>{cell.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ 03 住客 */

function StepGuests({ lite }: StepProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.sheet}>
      <View style={[styles.field, styles.guestField, lite && styles.dateFieldLite]}>
        <HomeIcon name="travelers" size={lite ? 26 : 22} color={colors.primary} />
        <View>
          <Text style={[styles.fieldLabel, lite && styles.fieldLabelLite]}>
            {t('hotels.guests')}
          </Text>
          <Text style={[styles.fieldValue, lite && styles.fieldValueLite]}>
            {t('hotels.guestsValue', { adults: 2, rooms: 1 })}
          </Text>
        </View>
      </View>

      <View style={styles.citizenRow}>
        <HomeIcon name="checkboxIndeterminate" size={lite ? 24 : 20} color={colors.primary} />
        <Text style={[styles.citizenText, lite && styles.citizenTextLite]}>
          {t('hotels.myanmarCitizen')}
        </Text>
        <HomeIcon name="infoCircle" size={lite ? 24 : 20} color={colors.textSoft} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ 04 选酒店 */

function StepHotel({ lite }: StepProps) {
  const { t } = useTranslation();
  const goods = {
    ...DEMO_HOTEL,
    goods_name: t(`hotels.results.demo.${DEMO_HOTEL_KEY}.name`),
    address: t(`hotels.results.demo.${DEMO_HOTEL_KEY}.address`),
  };
  const badge = DEMO_BADGE[DEMO_HOTEL_KEY];
  const tier = DEMO_RATING_TIER[DEMO_HOTEL_KEY];

  if (lite) {
    return (
      <LiteHotelCard
        goods={goods}
        coverSource={DEMO_COVERS[DEMO_HOTEL_KEY]}
        onPress={noop}
        onToggleFavorite={noop}
      />
    );
  }
  return (
    <HotelResultCard
      goods={goods}
      coverSource={DEMO_COVERS[DEMO_HOTEL_KEY]}
      ratingTier={tier ? t(`hotels.results.${tier}`) : null}
      badge={badge ? { text: t(badge.textKey), tone: badge.tone } : null}
      onPress={noop}
      onToggleFavorite={noop}
    />
  );
}

/* ------------------------------------------------------------------ 05 选房 */

function StepRoom({ lite }: StepProps) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  if (lite) {
    return (
      <LiteRoomCard
        sku={{ ...DEMO_ROOM_SKU, room_name: t(`hotels.detail.rooms.names.${DEMO_ROOM.key}`) }}
        coverSource={TEMP_ROOM_COVERS[DEMO_ROOM.key]}
        badge={t('hotels.detail.rooms.bestseller')}
        onSeeRoom={noop}
        onChoose={noop}
      />
    );
  }
  return (
    <HotelRoomCard
      gradientKey={`guide-${DEMO_ROOM.key}`}
      cover={TEMP_ROOM_COVERS[DEMO_ROOM.key]}
      photoCount={t('hotels.detail.photoCount', { index: 2, total: 12 })}
      name={t(`hotels.detail.rooms.names.${DEMO_ROOM.key}`)}
      leftLabel={DEMO_ROOM.left ? t('hotels.detail.rooms.left', { rooms: DEMO_ROOM.left }) : null}
      seeDetailsLabel={t('hotels.detail.rooms.seeDetails')}
      guestsLabel={t('hotels.detail.rooms.guests', { guests: DEMO_ROOM.guests })}
      bedLabel={t(`hotels.detail.rooms.beds.${DEMO_ROOM.bed}`)}
      bedCount={DEMO_ROOM.bedCount}
      areaLabel={t('hotels.detail.rooms.area', {
        area: DEMO_ROOM.area,
        unit: t(`hotels.detail.rooms.units.${DEMO_ROOM.areaUnit}`),
      })}
      facilities={DEMO_ROOM.facilities.map((key) => ({
        key,
        icon: ROOM_FACILITY_ICONS[key].icon,
        size: ROOM_FACILITY_ICONS[key].size,
        label: t(`hotels.detail.rooms.facilities.${key}`),
      }))}
      strike={DEMO_ROOM.strike ? formatMoney(DEMO_ROOM.strike, currency) : null}
      promo={DEMO_ROOM.promoKey ? t(DEMO_ROOM.promoKey) : null}
      price={formatMoney(DEMO_ROOM.price, currency)}
      perNightLabel={DEMO_ROOM.perNight ? t('hotels.detail.rooms.perNight') : null}
      selectLabel={t('hotels.detail.rooms.choose')}
      /* 引导页只是张示意卡:恒为未选态(显示 Choose),加减器不会出现 */
      quantity={0}
      onChangeQuantity={noop}
      bestsellerLabel={t('hotels.detail.rooms.bestseller')}
      favorite={DEMO_ROOM.favorite}
      viewer={DEMO_ROOM.viewer}
      onPress={noop}
      onToggleFavorite={noop}
      onSelect={noop}
      onOpenViewer={noop}
    />
  );
}

/* ------------------------------------------------------------------ 06 填资料 */

function StepDetails() {
  const { t } = useTranslation();
  /* 只画三栏:设计稿那张卡是四栏 + 提示 + Save Info,整卡近 450 高,
     叠上箭头与文案后在小屏上放不下,砍掉手机号那栏(它的说明价值与姓名重复) */
  return (
    <View style={styles.sheet}>
      <FormInput
        label={t('hotels.booking.guests.firstName')}
        required
        editable={false}
        placeholder={t('hotels.booking.guests.firstNamePlaceholder')}
      />
      <FormInput
        label={t('hotels.booking.guests.lastName')}
        required
        editable={false}
        placeholder={t('hotels.booking.guests.lastNamePlaceholder')}
      />
      <FormInput
        label={t('hotels.booking.guests.email')}
        required
        editable={false}
        placeholder={t('hotels.booking.guests.emailPlaceholder')}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ 07 付款 */

function StepPayment() {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);
  return (
    <View style={styles.payList}>
      <Text style={styles.payGroup}>{t('hotels.booking.payment.popular')}</Text>
      <PaymentMethodRow
        icon={TEMP_PAY_ICONS.mmqr}
        iconInset
        title={t('hotels.booking.payment.methods.mmqr.title')}
        desc={t('hotels.booking.payment.methods.mmqr.desc')}
        onPress={noop}
      />
      <PaymentMethodRow
        icon={TEMP_PAY_ICONS.kbzpay}
        title={t('hotels.booking.payment.methods.kbzpay.title')}
        desc={t('hotels.booking.payment.methods.kbzpay.desc')}
        onPress={noop}
      />
      <Text style={styles.payGroup}>{t('hotels.booking.payment.other')}</Text>
      <PaymentMethodRow
        icon={TEMP_PAY_ICONS.wallet}
        deepTile
        title={t('hotels.booking.payment.methods.wallet.title')}
        /* 钱包是本期唯一开通的渠道,插图里给它勾上 */
        desc={t('hotels.booking.payment.methods.wallet.desc', {
          amount: formatMoney(250_000, currency),
        })}
        checked
        onPress={noop}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ 步骤表 */

export interface GuideStep {
  /** i18n 键后缀:`hotels.guide.steps.<id>.title` / `.desc` */
  id: string;
  Illustration: (props: StepProps) => React.ReactElement;
}

export const GUIDE_STEPS: GuideStep[] = [
  { id: 's1', Illustration: StepDestination },
  { id: 's2', Illustration: StepDates },
  { id: 's3', Illustration: StepGuests },
  { id: 's4', Illustration: StepHotel },
  { id: 's5', Illustration: StepRoom },
  { id: 's6', Illustration: StepDetails },
  { id: 's7', Illustration: StepPayment },
];

const styles = StyleSheet.create({
  /** 字段类插图的白卡托底(设计稿 1/3/6 步有,2/7 步没有) */
  sheet: {
    width: '100%',
    padding: 16,
    gap: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },

  /* 以下字段样式取自 `screens/hotel/HotelsScreen.tsx` 的搜索卡 */
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.btn,
    backgroundColor: colors.tintBg,
  },
  searchField: { height: 64, justifyContent: 'space-between' },
  searchFieldLite: { height: 72 },
  searchText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    color: colors.textSoft,
  },
  searchTextLite: { fontSize: 24 },

  dateRow: { flexDirection: 'row', gap: 12, width: '100%' },
  dateField: { flex: 1, height: 60 },
  dateFieldLite: { height: 72 },
  guestField: { height: 60 },
  fieldLabel: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.textSoft },
  fieldLabelLite: { fontSize: 16, lineHeight: 20 },
  fieldValue: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  fieldValueLite: { fontSize: 20, lineHeight: 28 },

  citizenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  citizenText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 24,
    color: colors.textSoft,
  },
  citizenTextLite: { fontSize: 18, lineHeight: 26 },

  payList: { width: '100%', gap: 12 },
  payGroup: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
});
