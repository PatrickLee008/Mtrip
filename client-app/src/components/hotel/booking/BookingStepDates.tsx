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
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_ADDON_COVERS } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import AddOnCard from '@/components/hotel/booking/AddOnCard';
import BookingCalendar from '@/components/hotel/booking/BookingCalendar';
import BookingSummaryBar from '@/components/hotel/booking/BookingSummaryBar';
import GuestCounterRow from '@/components/hotel/booking/GuestCounterRow';
import { bookingShared } from '@/components/hotel/booking/bookingShared';
import {
  formatWeekdayDate,
  nightsBetween,
  nightsLabel,
} from '@/components/hotel/booking/bookingFormat';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { BOOKING_ADDONS, type BookingAddonKey } from '@/screens/hotel/bookingDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatMoney } from '@/utils/format';

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
  const currency = useSiteStore((s) => s.currency);

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

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={bookingShared.sectionTitle}>{t('hotels.booking.dates.enhance')}</Text>
          <Text style={styles.optional}>{t('hotels.booking.dates.optional')}</Text>
        </View>
        <View style={styles.addonList}>
          {BOOKING_ADDONS.map((addon) => (
            <AddOnCard
              key={addon.key}
              cover={addon.cover ? TEMP_ADDON_COVERS[addon.key] : null}
              title={t(`hotels.booking.addons.${addon.key}.title`)}
              desc={t(`hotels.booking.addons.${addon.key}.desc`)}
              price={formatMoney(addon.price, currency)}
              selected={addons.includes(addon.key)}
              addLabel={t('hotels.booking.dates.addToBooking')}
              selectedLabel={t('hotels.booking.dates.selected')}
              onToggle={() => (addon.route ? onOpenInsurance() : onToggleAddon(addon.key))}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={bookingShared.sectionTitle}>{t('hotels.booking.dates.specialRequests')}</Text>
        <View style={styles.requestCard}>
          <Text style={bookingShared.note}>{t('hotels.booking.dates.requestLabel')}</Text>
          <View style={styles.textarea}>
            <TextInput
              style={styles.textareaInput}
              value={request}
              onChangeText={onChangeRequest}
              placeholder={t('hotels.booking.dates.requestPlaceholder')}
              placeholderTextColor="rgba(116, 118, 134, 0.5)"
              multiline
              textAlignVertical="top"
            />
          </View>
          <View style={styles.noteRow}>
            <HomeIcon name="infoSmall" size={13.333} color={colors.label} />
            <Text style={styles.noteText}>{t('hotels.booking.dates.requestNote')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  /* 摘要卡与日历之间设计稿是 16,不是区块间的 24 */
  summaryGroup: { gap: 16 },
  section: { gap: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optional: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  addonList: { gap: 24 },

  /* 特殊要求卡是纯白 + 更柔的投影(设计稿 0/8 blur15 黑 4%),不走共用壳 */
  requestCard: {
    gap: 8,
    padding: 24,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  textarea: {
    minHeight: 106,
    padding: 17,
    borderRadius: radius.btn,
    backgroundColor: 'rgba(229, 238, 255, 0.5)',
  },
  textareaInput: {
    flex: 1,
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    color: colors.heading,
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingTop: 3.5 },
  noteText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.label,
  },
});
