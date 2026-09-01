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

interface Props {
  stay: BookingStay;
  agreed: boolean;
  onToggleAgree: () => void;
  onComingSoon: () => void;
}

export default function ReviewBody({ stay, agreed, onToggleAgree, onComingSoon }: Props) {
  const { t, i18n } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const nightsText = nightsLowerLabel(t, nights);
  const guests = stay.adults + stay.childCount;

  const rows: PriceRow[] = [
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
  ];

  return (
    <View style={styles.root}>
      <RoomSummaryCard
        cover={TEMP_ROOM_COVERS[stay.roomKey]}
        badge={t('hotels.booking.review.preferred')}
        name={t(`hotels.detail.rooms.names.${stay.roomKey}`)}
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
        total={formatMoney(stay.total, currency)}
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
