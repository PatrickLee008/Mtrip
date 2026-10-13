/**
 * Step 1 · 日期确认(设计稿 1675:6069;加购已选 + 保险的状态是 1675:7406,同一组件的另一状态)
 *
 * 结构:摘要卡 → Selected Dates 日历 → Who's Coming? 人数卡 → Enhance Your Stay 加购卡 → Special Requests。
 *
 * 改日期只有一个入口:**常驻的 `BookingCalendar`**。顶部摘要卡的日期胶囊是纯展示。
 * 这里曾经还能点摘要卡拉起 `DatePickerSheet`(设计稿 1675:6806)—— 同一件事两个入口,
 * 日历就在下面一屏,弹层反而挡住它、还容易误触,已去掉。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import BookingCalendar from '@/components/hotel/booking/BookingCalendar';
import BookingSummaryBar from '@/components/hotel/booking/BookingSummaryBar';
import GuestCounterRow from '@/components/hotel/booking/GuestCounterRow';
import { AddOnsSection, SpecialRequestsSection } from '@/components/hotel/booking/StayExtras';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import {
  formatWeekdayDate,
  nightsBetween,
  nightsLabel,
} from '@/components/hotel/booking/bookingFormat';
import type { BookingAddonKey } from '@/screens/hotel/bookingDemo';

interface Props {
  checkIn: string;
  checkOut: string;
  adults: number;
  /** `children` 是 React 保留 prop 名(传数字会被当成子节点),这里改名 */
  childCount: number;
  rooms: number;
  addons: BookingAddonKey[];
  request: string;
  onChangeDates: (checkIn: string, checkOut: string) => void;
  onChangeAdults: (value: number) => void;
  onChangeChildCount: (value: number) => void;
  onToggleAddon: (key: BookingAddonKey) => void;
  onChangeRequest: (value: string) => void;
  /** 保险那张卡的「Add to booking」跳独立页,不在这里就地勾选 */
  onOpenInsurance: () => void;
}

export default function BookingStepDates({
  checkIn,
  checkOut,
  adults,
  childCount,
  rooms,
  addons,
  request,
  onChangeDates,
  onChangeAdults,
  onChangeChildCount,
  onToggleAddon,
  onChangeRequest,
  onOpenInsurance,
}: Props) {
  const { t, i18n } = useTranslation();

  const nights = nightsBetween(checkIn, checkOut);

  /** 日历里点日期:已成区间或点到入住日之前 → 重新起头;否则收尾 */
  const pickDate = (key: string) => {
    if (!checkIn || checkOut || key <= checkIn) {
      onChangeDates(key, '');
      return;
    }
    onChangeDates(checkIn, key);
  };

  return (
    <View style={styles.root}>
      <View style={styles.summaryGroup}>
        <BookingSummaryBar
          checkInLabel={formatWeekdayDate(checkIn, i18n.language)}
          checkOutLabel={checkOut ? formatWeekdayDate(checkOut, i18n.language) : '—'}
          nightsLabel={nightsLabel(t, nights)}
          guestsLabel={t('hotels.booking.dates.guestsRoomsValue', { adults, rooms })}
        />
        <BookingCalendar checkIn={checkIn} checkOut={checkOut} onPickDate={pickDate} />
      </View>

      <View style={styles.section}>
        <Text style={bookingShared.sectionTitle}>{t('hotels.booking.dates.whosComing')}</Text>
        <View style={bookingShared.panelPlain}>
          <GuestCounterRow
            title={t('hotels.booking.dates.adults')}
            hint={t('hotels.booking.dates.adultsHint')}
            value={adults}
            min={1}
            solidPlus
            onChange={onChangeAdults}
          />
          <GuestCounterRow
            title={t('hotels.booking.dates.children')}
            hint={t('hotels.booking.dates.childrenHint')}
            value={childCount}
            divider
            onChange={onChangeChildCount}
          />
        </View>
      </View>

      <AddOnsSection addons={addons} onToggleAddon={onToggleAddon} onOpenInsurance={onOpenInsurance} />

      <SpecialRequestsSection request={request} onChangeRequest={onChangeRequest} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  /* 摘要卡与日历之间设计稿是 16,不是区块间的 24 */
  summaryGroup: { gap: 16 },
  section: { gap: 16 },
});
