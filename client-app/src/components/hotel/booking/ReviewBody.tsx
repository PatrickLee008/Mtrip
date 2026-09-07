/**
 * 一段住宿的复核内容(设计稿 Step 3 `1675:6404` 与 Stay 明细页 `1675:9677` 的 Main,逐块相同)
 *
 * 房型卡 → 入离/人数 → Add On Service(有加购才渲染)→ Price Breakdown → 取消政策 → 条款勾选。
 * 两个屏只差外层壳与吸底按钮,所以把这一段抽出来共用。
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_ROOM_COVERS } from '@/assets/tempImages';
import {
  AddOnServiceCard,
  CancellationCard,
  PriceBreakdownCard,
  RoomSummaryCard,
  StayDetailsGrid,
  TermsCheckbox,
  type PriceRow,
} from '@/components/hotel/booking/ReviewCards';
import {
  formatMonthDayYear,
  formatWeekdayDate,
  freeCancelDeadline,
  nightsBetween,
  nightsLowerLabel,
} from '@/components/hotel/booking/bookingFormat';
import type { BookingStay } from '@/screens/hotel/bookingDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount, formatMoney } from '@/utils/format';

/**
 * 结账优惠券区(C-M6)。不传 = 不显示券行 —— Stay 明细页与演示模式走这条路,行为与从前一致。
 */
export interface ReviewCouponState {
  /** 已应用的券;null = 当前没有应用任何券 */
  applied: { receiveId: number; name: string; discount: number } | null;
  /** 本单是否存在可用券(决定券行显示「选择」还是「暂无可用优惠券」) */
  hasUsable: boolean;
  loading: boolean;
  /** 打开选券弹窗 */
  onOpen: () => void;
}

interface Props {
  stay: BookingStay;
  agreed: boolean;
  onToggleAgree: () => void;
  onComingSoon: () => void;
  coupon?: ReviewCouponState;
}

export default function ReviewBody({
  stay,
  agreed,
  onToggleAgree,
  onComingSoon,
  coupon,
}: Props) {
  const { t, i18n } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const nightsText = nightsLowerLabel(t, nights);
  const guests = stay.adults + stay.childCount;

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
          value: formatAmount(stay.roomPrice, currency),
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
          value: formatAmount(stay.roomPrice, currency),
        },
      ];

  /**
   * 优惠券行(设计稿 `228:5118` 的价格明细里预留了折扣行 `869:2503`,当时是隐藏的会员折扣)。
   * 进入本步时已自动应用最优券,点这一行可以换一张或不用券。
   * 抵扣额来自服务端(`/coupon/match-list` 按本单算),不在前端估。
   */
  if (coupon) {
    rows.push(
      coupon.applied
        ? {
            key: 'coupon',
            label: t('hotels.booking.coupon.rowLabel'),
            note: coupon.applied.name,
            value: `- ${formatAmount(coupon.applied.discount, currency)}`,
            discount: true,
            actionLabel: t('hotels.booking.coupon.change'),
            onPress: coupon.onOpen,
          }
        : {
            key: 'coupon',
            label: t('hotels.booking.coupon.rowLabel'),
            note: coupon.loading
              ? t('common.loading')
              : coupon.hasUsable
                ? undefined
                : t('hotels.booking.coupon.none'),
            value: '—',
            /* 没有任何券时整行不可点,免得点开一个空弹窗 */
            actionLabel: coupon.hasUsable ? t('hotels.booking.coupon.select') : undefined,
            onPress: coupon.hasUsable ? coupon.onOpen : undefined,
          },
    );
  }

  /** 应付 = 明细合计 − 券抵扣(演示模式没有券,值不变) */
  const payable = Math.max(0, stay.total - (coupon?.applied?.discount ?? 0));

  return (
    <View style={styles.root}>
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
            value: t('hotels.booking.review.guestsRoomsValue', { guests, rooms: stay.rooms }),
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
        <TermsCheckbox
          checked={agreed}
          prefix={t('hotels.booking.review.agreePrefix')}
          terms={t('hotels.booking.review.terms')}
          separator={t('hotels.booking.review.agreeSeparator')}
          privacy={t('hotels.booking.review.privacy')}
          suffix={t('hotels.booking.review.agreeSuffix')}
          onToggle={onToggleAgree}
          onOpenTerms={onComingSoon}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  policies: { gap: 16 },
});
