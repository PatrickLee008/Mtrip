/**
 * 关怀模式 Step 3 · 复核确认(推导自 `Booking Flow` `759:9777` 的 Booking step 3 `228:5118`)
 *
 * 房型卡 → 入离/人数 → Add On Service(有加购才渲染)→ Price Breakdown(含优惠券行)→
 * 取消政策 → 条款勾选。字号按 `liteBookingShared` 放大一档。
 *
 * **与完整模式 `ReviewBody` 的唯一结构差异:没有「Add More Stay」** ——
 * 后端一次 `create` 只收一个 sku,真实模式点它本来就只弹 Coming soon,
 * 关怀版不给这条死路(完整模式保留不变)。
 *
 * 价格明细分两套,口径与 `ReviewBody` 逐行一致:
 *   演示数据 —— 设计稿三行(原价划线 / 房费 / 服务费与税费);
 *   真实商品 —— 只列后端真的会收的房费;**不画 Tax & Service Fees**,
 *   后端定价链路(锁库存房费 → 长住折扣 → 优惠券)里没有税费,画上去会与实付对不上。
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TEMP_ROOM_COVERS } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import type { ReviewCouponState } from '@/components/hotel/booking/ReviewBody';
import { CARD_HEADING, TINT_CHIP, TINT_DEEP } from '@/components/hotel/booking/bookingShared';
import {
  formatMonthDayYear,
  formatWeekdayDate,
  freeCancelDeadline,
  nightsBetween,
  nightsLowerLabel,
} from '@/components/hotel/booking/bookingFormat';
import { liteBooking } from '@/components/hotel/booking/lite/liteBookingShared';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { BookingStay } from '@/screens/hotel/bookingDemo';
import { useSiteStore } from '@/store/siteStore';
import { formatAmount, formatMoney } from '@/utils/format';

/** 明细表的一行 */
interface Row {
  key: string;
  label: string;
  value: string;
  /** 划线原价 */
  strike?: boolean;
  /** 折扣行(优惠券):金额走主色,与房费区分开,不会被读成又一笔收费 */
  discount?: boolean;
  /** 标签下的次级说明(券名、或「暂无可用优惠券」) */
  note?: string;
  /** 右下角操作链接(选择 / 更换);给了就整行可点 */
  actionLabel?: string;
  onPress?: () => void;
}

interface Props {
  stay: BookingStay;
  agreed: boolean;
  onToggleAgree: () => void;
  onComingSoon: () => void;
  coupon?: ReviewCouponState;
}

export default function LiteStepReview({
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

  const rows: Row[] = stay.demo
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

  /* 进入本步时已自动应用最优券,点这一行可以换一张或不用券。抵扣额来自服务端,不在前端估 */
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
      {/* 房型卡:真实房型接口没有封面图,沿用设计稿的临时房型图兜底 */}
      <View style={liteBooking.cardPlain}>
        <Image
          source={TEMP_ROOM_COVERS[stay.roomKey] ?? TEMP_ROOM_COVERS.deluxe}
          style={styles.roomCover}
          resizeMode="cover"
        />
        <View style={styles.roomBody}>
          <View style={styles.roomTitleRow}>
            <Text style={[liteBooking.itemTitle, liteBooking.flexCol]} numberOfLines={2}>
              {stay.roomName ?? t(`hotels.detail.rooms.names.${stay.roomKey}`)}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('hotels.booking.review.preferred')}</Text>
            </View>
          </View>
          <View style={styles.specs}>
            <Spec icon="people" text={t('hotels.booking.review.roomGuests', { guests })} />
            <Spec icon="bedSize" text={t('hotels.detail.rooms.beds.king')} />
          </View>
        </View>
      </View>

      {/* 入离 / 人数 */}
      <View style={liteBooking.card}>
        <DetailRow
          icon="calendar"
          iconWidth={22}
          iconHeight={24}
          label={t('hotels.booking.review.checkInOut')}
          value={t('hotels.booking.review.checkInOutValue', {
            checkIn: formatWeekdayDate(stay.checkIn, i18n.language),
            checkOut: formatWeekdayDate(stay.checkOut, i18n.language),
          })}
        />
        <View style={liteBooking.divider} />
        <DetailRow
          icon="travelers"
          iconWidth={26}
          iconHeight={20}
          label={t('hotels.booking.review.guestsRooms')}
          value={t('hotels.booking.review.guestsRoomsValue', { guests, rooms: stay.rooms })}
        />
      </View>

      {stay.addons.length ? (
        <View style={liteBooking.card}>
          <Text style={liteBooking.cardTitle}>{t('hotels.booking.review.addOnService')}</Text>
          <View style={styles.chips}>
            {stay.addons.map((key) => (
              <View key={key} style={styles.chip}>
                <Text style={styles.chipText}>{t(`hotels.booking.addons.${key}.title`)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 价格明细 */}
      <View style={liteBooking.cardWhite}>
        <Text style={liteBooking.cardTitle}>{t('hotels.booking.review.priceBreakdown')}</Text>
        <View style={styles.table}>
          {rows.map((row, i) => {
            const body = (
              <View style={styles.tableRow}>
                <View style={liteBooking.flexCol}>
                  <Text style={liteBooking.body}>{row.label}</Text>
                  {row.note ? <Text style={liteBooking.note}>{row.note}</Text> : null}
                  {row.actionLabel ? (
                    <Text style={styles.rowAction}>{row.actionLabel}</Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    row.strike && styles.rowStrike,
                    row.discount && styles.rowDiscount,
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            );
            return (
              <View key={row.key} style={i > 0 ? styles.tableRowBorder : undefined}>
                {row.onPress ? (
                  <Pressable
                    style={({ pressed }) => (pressed ? liteBooking.pressed : undefined)}
                    onPress={row.onPress}
                  >
                    {body}
                  </Pressable>
                ) : (
                  body
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.totalRow}>
          <Text style={liteBooking.overline}>{t('hotels.booking.review.totalAmount')}</Text>
          <View style={styles.pointsChip}>
            {/* 积分不是金额,不能走 formatAmount(会按币种补小数位),用语言环境的千分位 */}
            <Text style={styles.pointsText}>
              {t('hotels.booking.review.earnPoints', {
                points: stay.points.toLocaleString(i18n.language),
              })}
            </Text>
          </View>
        </View>
        <Text style={styles.total}>{formatMoney(payable, currency)}</Text>
      </View>

      {/* 取消政策 */}
      <View style={styles.cancelCard}>
        <Text style={styles.cancelTitle}>{t('hotels.booking.review.cancellationPolicy')}</Text>
        <Text style={liteBooking.body}>
          {t('hotels.booking.review.cancellationDesc', {
            date: formatMonthDayYear(freeCancelDeadline(stay.checkIn), i18n.language),
          })}
        </Text>
      </View>

      {/* 条款勾选 */}
      <Pressable
        style={({ pressed }) => [styles.terms, pressed && liteBooking.pressed]}
        onPress={onToggleAgree}
      >
        <HomeIcon
          name={agreed ? 'checkboxIndeterminate' : 'checkbox'}
          size={28}
          color={agreed ? colors.primary : colors.softBlue}
        />
        <Text style={[liteBooking.body, liteBooking.flexCol]}>
          {t('hotels.booking.review.agreePrefix')}
          <Text style={styles.termsLink} onPress={onComingSoon}>
            {t('hotels.booking.review.terms')}
          </Text>
          {t('hotels.booking.review.agreeSeparator')}
          <Text style={styles.termsLink} onPress={onComingSoon}>
            {t('hotels.booking.review.privacy')}
          </Text>
          {t('hotels.booking.review.agreeSuffix')}
        </Text>
      </Pressable>
    </View>
  );
}

function Spec({ icon, text }: { icon: 'people' | 'bedSize'; text: string }) {
  return (
    <View style={styles.spec}>
      <HomeIcon name={icon} size={20} color={colors.textSoft} />
      <Text style={liteBooking.note}>{text}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  iconWidth,
  iconHeight,
  label,
  value,
}: {
  icon: 'calendar' | 'travelers';
  iconWidth: number;
  iconHeight: number;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailTile}>
        <HomeIcon name={icon} width={iconWidth} height={iconHeight} color={colors.primary} />
      </View>
      <View style={liteBooking.flexCol}>
        <Text style={liteBooking.note}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },

  /* ---- 房型卡 ---- */
  roomCover: { width: '100%', height: 200 },
  roomBody: { padding: 24, gap: 12 },
  roomTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: TINT_CHIP,
  },
  badgeText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 20, color: colors.primary },
  specs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  /* ---- 入离 / 人数 ---- */
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  detailTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: TINT_DEEP,
  },
  detailValue: { fontFamily: fonts.interSemi, fontSize: 22, lineHeight: 30, color: colors.heading },

  /* ---- 加购胶囊 ---- */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: TINT_CHIP,
  },
  chipText: { fontFamily: fonts.interSemi, fontSize: 18, lineHeight: 24, color: colors.primary },

  /* ---- 价格明细 ---- */
  table: {
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: colors.softBlue },
  rowValue: { fontFamily: fonts.interSemi, fontSize: 22, lineHeight: 30, color: colors.heading },
  rowStrike: { textDecorationLine: 'line-through', color: colors.textSoft },
  rowDiscount: { color: colors.primary },
  rowAction: { fontFamily: fonts.interSemi, fontSize: 18, lineHeight: 26, color: colors.primary },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pointsChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: TINT_CHIP,
  },
  pointsText: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 20, color: colors.primary },
  total: { fontFamily: fonts.interBold, fontSize: 36, lineHeight: 44, color: colors.primary },

  /* ---- 取消政策:左侧一条主色竖条 ---- */
  cancelCard: {
    gap: 8,
    padding: 24,
    borderRadius: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
  },
  cancelTitle: { fontFamily: fonts.interBold, fontSize: 22, lineHeight: 30, color: CARD_HEADING },

  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  termsLink: { fontFamily: fonts.interSemi, color: colors.primary },
});
