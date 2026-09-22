/**
 * 一段住宿的复核内容(设计稿 Step 3 `1675:6404` 与 Stay 明细页 `1675:9677` 的 Main,逐块相同)
 *
 * 房型卡 → 入离/人数 → Add On Service(有加购才渲染)→ Price Breakdown → 取消政策 → 条款勾选。
 * 两个屏只差外层壳与吸底按钮,所以把这一段抽出来共用。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

import { TEMP_ROOM_COVERS } from '@/assets/tempImages';
import {
  AddOnServiceCard,
  CancellationCard,
  PriceBreakdownCard,
  RoomSummaryCard,
  StayDetailsGrid,
  type PriceRow,
} from '@/components/hotel/booking/ReviewCards';
import SelectedRoomsCard from '@/components/hotel/booking/SelectedRoomsCard';
import {
  formatMonthDayYear,
  formatWeekdayDate,
  freeCancelDeadline,
  nightsBetween,
  nightsLowerLabel,
} from '@/components/hotel/booking/bookingFormat';
import type { BookingStay } from '@/screens/hotel/bookingDemo';
import type { CartRoom } from '@/store/roomCartStore';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount, formatMoney } from '@/utils/format';

interface Props {
  stay: BookingStay;
  onComingSoon: () => void;
  /**
   * 购物车里的房型(新稿 2659:14990「Selected Rooms」)。
   * 不传或为空就不渲染这张卡 —— Stay 明细页与关怀模式仍是单房型,版式不变。
   */
  cartRooms?: CartRoom[];
  /** 「Edit Rooms」回购物车页;不传则不显示该入口 */
  onEditRooms?: () => void;
  /**
   * 多房间模式下的**整车**房费合计(Σ 单价 × 间数 × 晚数)。
   * 不传就按 `stay` 那一间算 —— Stay 明细页 / 关怀模式 / 演示模式走这条路,数值与从前一致。
   */
  roomTotal?: number;
  /** 顶部酒店卡的名称(新稿把房型卡换成了酒店卡);缺省则不渲染该卡 */
  hotelName?: string;
}

export default function ReviewBody({
  stay,
  onComingSoon,
  cartRooms,
  onEditRooms,
  hotelName,
  roomTotal,
}: Props) {
  /** 购物车里有房型才走「酒店卡 + Selected Rooms」的新版式 */
  const hasCart = (cartRooms?.length ?? 0) > 0;
  const { t, i18n } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const nightsText = nightsLowerLabel(t, nights);
  const guests = stay.adults + stay.childCount;
  /** 房费与合计的口径:多房间看整车(`roomTotal`),单房型看这一段住宿 */
  const roomPrice = roomTotal ?? stay.roomPrice;
  const stayTotal = roomTotal ?? stay.total;

  /**
   * 价格明细分两套:
   *   演示数据 —— 按设计稿三行(原价划线 / 房费 / 服务费与税费 10%);
   *   真实商品 —— **只列后端真的会收的部分**。后端定价链路是「锁库存得出的房费 → 长住折扣 → 优惠券」,
   *     没有税费这一项,照设计稿凭空展示 10% 会与实际扣款对不上。
   */
  const rows: PriceRow[] = stay.demo
    ? [
        {
          key: 'original',
          label: t('hotels.booking.review.originalPrice', { nights: nightsText }),
          value: formatAmount(stay.originalPrice, currency),
          strike: true,
        },
        {
          key: 'room',
          label: t('hotels.booking.review.roomPrice', { nights: nightsText }),
          value: formatAmount(roomPrice, currency),
        },
        {
          key: 'taxes',
          label: t('hotels.booking.review.taxes', { percent: stay.taxPercent }),
          value: formatAmount(stay.taxes, currency),
        },
      ]
    : [
        {
          key: 'room',
          label: t('hotels.booking.review.roomPrice', { nights: nightsText }),
          value: formatAmount(roomPrice, currency),
        },
      ];

  /**
   * 券**不在这一步**(用户 2026-09-22 定的,与稿面 371:1887 一致):
   * 价格明细只列原价/房费/税费,选券挪到第 4 步的 COUPONS 卡。
   * 所以这里的合计就是明细合计,不再扣券。
   */
  const payable = stayTotal;

  return (
    <View style={styles.root}>
      {/**
       * 新稿 2659:12508 把顶部那张**房型**卡换成了**酒店**卡,房型明细挪进下面的
       * 「Selected Rooms」。所以购物车里有房型时走新版式;没有(Stay 明细页 / 关怀模式 /
       * 演示模式)仍是原来的单房型卡,老页面不受影响。
       */}
      {hasCart ? (
        <>
          {hotelName ? (
            <View style={styles.hotelCard}>
              <Text style={styles.hotelName}>{hotelName}</Text>
            </View>
          ) : null}
          <SelectedRoomsCard rooms={cartRooms ?? []} onEdit={onEditRooms ?? onComingSoon} />
        </>
      ) : (
        <RoomSummaryCard
          /* 真实房型没有封面图(接口 images 为空),沿用设计稿的临时房型图兜底 */
          cover={TEMP_ROOM_COVERS[stay.roomKey] ?? TEMP_ROOM_COVERS.deluxe}
          badge={t('hotels.booking.review.preferred')}
          name={stay.roomName ?? t(`hotels.detail.rooms.names.${stay.roomKey}`)}
          guestsLabel={t('hotels.booking.review.roomGuests', { guests })}
          bedLabel={t('hotels.detail.rooms.beds.king')}
          areaLabel={t('hotels.detail.rooms.area', {
            area: 40,
            unit: t('hotels.detail.rooms.units.sqm'),
          })}
        />
      )}

      <StayDetailsGrid
        rows={[
          {
            key: 'dates',
            icon: 'calendar',
            iconWidth: 18,
            iconHeight: 20,
            label: t('hotels.booking.review.checkInOut'),
            value: t('hotels.booking.review.checkInOutValue', {
              checkIn: formatWeekdayDate(stay.checkIn, i18n.language),
              checkOut: formatWeekdayDate(stay.checkOut, i18n.language),
            }),
          },
          {
            key: 'guests',
            icon: 'travelers',
            iconWidth: 22,
            iconHeight: 16,
            label: t('hotels.booking.review.guestsRooms'),
            /* 多房间模式下间数是车里的总间数,不是这一段住宿的计数器 */
            value: t('hotels.booking.review.guestsRoomsValue', {
              guests,
              rooms: hasCart
                ? (cartRooms ?? []).reduce((sum, room) => sum + room.quantity, 0)
                : stay.rooms,
            }),
          },
        ]}
      />

      {stay.addons.length ? (
        <AddOnServiceCard
          title={t('hotels.booking.review.addOnService')}
          chips={stay.addons.map((key) => t(`hotels.booking.addons.${key}.title`))}
        />
      ) : null}

      <PriceBreakdownCard
        title={t('hotels.booking.review.priceBreakdown')}
        rows={rows}
        totalLabel={t('hotels.booking.review.totalAmount')}
        /* 积分不是金额,不能走 formatAmount(会按币种补小数位),用语言环境的千分位 */
        pointsLabel={t('hotels.booking.review.earnPoints', {
          points: stay.points.toLocaleString(i18n.language),
        })}
        total={formatMoney(payable, currency)}
      />

      <View style={styles.policies}>
        <CancellationCard
          title={t('hotels.booking.review.cancellationPolicy')}
          desc={t('hotels.booking.review.cancellationDesc', {
            date: formatMonthDayYear(freeCancelDeadline(stay.checkIn), i18n.language),
          })}
        />
        {/**
         * 新稿 2659:13281 把「勾选同意」改成了一行**纯说明文字**(继续即视为同意),
         * 不再是下一步的门禁 —— `useBookingWizard` 里那段 `!agreed` 拦截已一并去掉。
         */}
        <Text style={styles.termsNote}>{t('hotels.booking.review.agreeNote')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  policies: { gap: 16 },

  /* 顶部酒店卡(新稿把房型卡换成酒店):稿面还有封面与地址,接口这一层没下发,先只放名称 */
  hotelCard: {
    width: '100%',
    padding: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  hotelName: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 28,
    color: colors.heading,
  },
  /* 条款说明(2659:13281):Inter 400/12,弱化在取消政策下方 */
  termsNote: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
  },
});
