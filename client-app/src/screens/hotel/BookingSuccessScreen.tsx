/**
 * 预订结果页 · 正常模式(Figma `2659:13475` 多房间 / `224:3826` 单房间)
 *
 * **两张稿其实是同一页**:唯一差别是状态卡里「Booking Status」有几行 ——
 * 多房间一行一个预订(标「(Room n)」),单房间只有一行、不带房号。
 * 所以这里一份实现两用,行数由下单时的购物车快照(`roomCartStore.booked`)决定。
 *
 * 一屏两态(与关怀模式 `BookingSuccessLiteScreen` 同一套状态机,由路由参数 `status` 决定):
 *   `confirmed`  绿勾 + PAID / CONFIRMED
 *   `confirming` 橙钟 + PAID / CONFIRMING(**设计稿画的是这一态**)
 * ⚠️ **`confirming` 目前产生不了,不是漏接**:后端 `ORDER_STATUS` 没有「等酒店确认」这一档,
 * `order/pay` 与 `trip/pay` 成功即已支付、预订已确认。两态都实现好放在这里,
 * 后端补上该状态时只需让 `useBookingWizard.goSuccess` 传 `status: 'confirming'`,页面不用再动。
 *
 * **与上一版(1675:6714)的差别**:上一版是二维码核销凭证页(QR + Booking Summary 四行 +
 * Download Voucher)。新稿把这些都去掉了 —— 核销码并没有丢,它在订单详情页
 * (`OrderDetailScreen` 的 `VerifyCodeView`),所以「View Booking」跳 `OrderDetail` 就够了;
 * 没有订单号(演示模式)时该按钮退回订单列表。吸底也按稿只剩这一枚按钮(稿面没有「Back to Home」)——
 * 正因为**本屏没有任何返回入口**,那枚按钮必须用 `navigation.reset` 而不是 `navigate`:
 * push 一层订单详情的话,详情页返回又回到本屏,除了再点一次 View Booking 无路可走
 * (已按缺陷报回来)。现在重置成「底部 Tab(我的预订)+ 订单详情」,
 * 详情页返回落到预订列表,已完成的结账流程整个从历史里移除 —— 本来也不该退回去。
 *
 * 设计稿实测:
 *   页面      底色 `#F8FAFC`(两层线性渐变压平,与全站 `--background` 不同,只有这一屏用)
 *             Main pt96(含 54 状态栏)px16 gap32,pb80 + 吸底栏
 *   结果头    96x88 圆底(状态色 10%)+ 40 图标 → 标题 Inter 700 24/32 tracking -0.96
 *             → 说明 16/24 `#434655` 居中
 *   凭证卡    `--tab` 底 / 1px 白 / 圆角 24 / p25 / 投影 0 -4 20 `rgba(78,115,255,.08)`
 *     Logo 区  py24 居中:logo 100x74(contain)+「Travel with us」Inter 600 20/24 主色,
 *              带 0 0 4 `rgba(0,0,0,.25)` 文字投影
 *     状态区  py20 gap12;每行 py4 两端对齐:32 圆主色底 + 20 白图标 / 文案 Inter 500 16/20 `--text-2`;
 *              右药丸 px12 py4 圆角 999:12 图标 + Inter 600 12/16 白大写 tracking .24。
 *              **分隔线只有一条**(Payment 与第一条 Booking 之间),房间行之间没有
 *     单号行  「Booking ID: 」Inter 400 18/28 `--text-2` + 单号 Inter 600 `--text`;右 20 复制图标
 *   详情区    gap8:标题 Inter 600 20(稿面行高 16 是文本框高度,RN 上会切掉下行字母,
 *             按关怀模式成功页同一处的做法给 24);卡 1px `#E5EEFF` 圆角 24 p25 gap16
 *             投影 0 10 15 `rgba(78,115,255,.08)`
 *             96 方图圆角 12.8 + 酒店名 Inter 400 18/22.5 + 日期行(10.5x11.667 图标 + Inter 500 14/20)
 *   引流卡    `rgba(221,225,255,.3)` 底 1px `#DDE1FF` 圆角 24 p25 gap7.5,两行居中
 *   吸底      `--tab` 底 py16 px16,整宽主色按钮 p16 圆角 12、Inter 400 16/24 白
 *
 * ⚠️ 稿面的说明文字与两枚状态药丸用的是 Plus Jakarta Sans,**本项目没装这个字族**
 * (App.tsx 只加载 Outfit 与 Inter),这里与关怀模式成功页一样用 Inter 顶替 ——
 * 两页同属一套设计,顶替口径必须一致。
 * ⚠️ 稿面缩略图是酒店照片,接口这一层没把酒店封面透到成功页;这里**用本单第一间房的封面**
 * (购物车快照里现成的真实图),没有才回落到临时图,不假装有图。
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';

import { tempCoverFor } from '@/assets/tempImages';
import HomeIcon from '@/components/home/HomeIcon';
import BookingStatusRows from '@/components/hotel/booking/BookingStatusRows';
import { formatMonthDayYear } from '@/components/hotel/booking/bookingFormat';
import { DEEP_PRIMARY, bookingShared } from '@/components/hotel/booking/bookingShared';
import { PAGE_PADDING, colors, radius } from '@/config/theme';
import { formatMoney } from '@/utils/format';
import { useSiteStore } from '@/store/siteStore';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import { BOOKING_DEMO } from '@/screens/hotel/bookingDemo';
import { formatCountdown, useBookingResult } from '@/screens/hotel/useBookingResult';
import { useCommonStore } from '@/store/commonStore';
import { useRoomCartStore } from '@/store/roomCartStore';

/** 只有这一屏用的页面底色(设计稿的双层线性渐变压平即 #F8FAFC) */
const PAGE_BG = '#F8FAFC';
/** 设计稿 `MTrip Logo 2026 Profile Pic 1`(532x386,展示框 100x74 contain) */
const VOUCHER_LOGO = require('../../../assets/images/logo-2026.png');

export default function BookingSuccessScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingSuccess'>>();
  const insets = useSafeAreaInsets();
  const showToast = useCommonStore((s) => s.showToast);
  const comingSoon = () => showToast(t('home.comingSoon'));
  /**
   * 本单订下的房型。读的是**下单时转存的快照**而不是 `items` ——
   * 支付成功会清空购物车,读 `items` 到这一屏永远是空的。
   * 快照里**一条 = 一个预订**(`trip/create` 按房型各建一单),所以状态行一条一行。
   */
  const bookedRooms = useRoomCartStore((s) => s.booked);

  /* 真实下单带参进来,缺参就回落到演示数值 */
  const p = route.params ?? {};
  /**
   * **读订单**(用户 2026-09-22 要求):单号 / 金额 / 状态 / 支付截止时间以接口为准,
   * 路由参数只作兜底(演示模式没有 orderId,整页仍走参数)。
   * 支付失败态还靠它对**同一张单**重新发起支付 —— 绝不在这一屏建新单。
   */
  const result = useBookingResult({
    orderId: p.orderId,
    orderNo: p.orderNo,
    tripId: p.tripId,
    paidTotal: p.paidTotal,
    status: p.status,
    failReason: p.failReason,
  });
  const currency = useSiteStore((s) => s.currency);
  const failed = result.status === 'failed';
  const confirmed = result.status === 'confirmed';
  const bookingId = result.bookingId || BOOKING_DEMO.referenceId;
  const hotelName = p.hotelName ?? t(`hotels.results.demo.${BOOKING_DEMO.hotelKey}.name`);
  /**
   * 地址只在演示模式回落到设计稿的 Bagan 地址;真实订单没有地址就留空并隐藏引流卡,
   * 否则会给一家真实酒店挂上一条完全不相干的城市(后台目前允许 address 为空)。
   */
  const address =
    p.address ?? (p.orderNo ? '' : t(`hotels.results.demo.${BOOKING_DEMO.hotelKey}.address`));
  const checkIn = p.checkIn ?? BOOKING_DEMO.checkIn;
  const checkOut = p.checkOut ?? BOOKING_DEMO.checkOut;

  /* 失败态红、待确认橙、成功绿 —— 结果头圆底与状态徽标共用这一个色 */
  const tone = failed ? colors.hot : confirmed ? colors.statusPaid : colors.orange;
  /** 缩略图:本单第一间房的封面(真实图),演示模式/没带图时回落临时图 */
  const thumb = bookedRooms[0]?.cover ?? tempCoverFor(0);

  const copyId = () => {
    void Clipboard.setStringAsync(bookingId);
    showToast(t('hotels.booking.success.idCopied'));
  };

  /**
   * 「View Booking」去订单详情看核销码;没有订单号(演示模式)就退回订单列表。
   *
   * **用 `reset` 不用 `navigate`**:本屏是下单流程的终点,稿面没有返回入口(吸底只有这一枚按钮),
   * 再 push 一层订单详情的话,详情页返回又回到本屏 —— 除了再点一次 View Booking 无路可走,
   * 用户会卡在「成功页 ⇄ 订单详情」里出不来(已按缺陷报回来)。
   * 这里把栈重置成「底部 Tab(我的预订)+ 订单详情」:详情页返回落到预订列表,
   * 已完成的结账流程整个从历史里移除 —— 本来也不该退回去。
   */
  const viewBooking = () =>
    navigation.reset({
      index: 1,
      routes: [
        { name: 'MainTabs', params: { screen: 'MyPickTab' } },
        p.orderId
          ? { name: 'OrderDetail', params: { orderId: p.orderId } }
          : { name: 'OrderList' },
      ],
    });

  /**
   * 「Booking Status」行:多房间一行一个预订并标房号(稿面 `(Room 1)` / `(Room 2)`);
   * 单房型链路快照是空的,按 `224:3826` 只出一行、不带房号。
   * 同一房型订了多间时稿面没画,按既有的「× n」口径补在房号里,不另造版式。
   */
  const statusRows =
    bookedRooms.length > 0
      ? bookedRooms.map((room, i) => ({
          key: room.roomKey,
          roomLabel:
            room.quantity > 1
              ? t('hotels.booking.success.statusRoomTimes', { index: i + 1, count: room.quantity })
              : t('hotels.booking.success.statusRoom', { index: i + 1 }),
        }))
      : [{ key: 'single', roomLabel: '' }];

  return (
    <View style={styles.root}>
      <View style={[styles.statusBar, { height: insets.top }]} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.main, { paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* -------------------------------------------------- 结果头 2659:13477 */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: `${tone}1A` }]}>
            <HomeIcon
              name={failed ? 'dismissCircle' : confirmed ? 'checkmarkCircle' : 'clock'}
              size={40}
              color={tone}
            />
          </View>
          <Text style={styles.title}>
            {t(
              failed
                ? result.expired
                  ? 'hotels.booking.success.expiredTitle'
                  : 'hotels.booking.success.failedTitle'
                : confirmed
                  ? 'hotels.booking.success.confirmedTitle'
                  : 'hotels.booking.success.confirmingTitle',
            )}
          </Text>
          <Text style={styles.desc}>
            {t(
              failed
                ? result.expired
                  ? 'hotels.booking.success.expiredDesc'
                  : 'hotels.booking.success.failedDesc'
                : confirmed
                  ? 'hotels.booking.success.confirmedDesc'
                  : 'hotels.booking.success.confirmingDesc',
            )}
          </Text>
          {/* 后端给的具体原因(余额不足 / 库存变化…),比稿面的固定文案有用 */}
          {failed && !result.expired && result.failReason ? (
            <Text style={styles.failReason}>{result.failReason}</Text>
          ) : null}
          {/* 应付金额取接口(多房间是整车实付),不用前端估的数 */}
          {failed && !result.expired && result.payAmount > 0 ? (
            <Text style={styles.amountLine}>{formatMoney(result.payAmount, currency)}</Text>
          ) : null}
          {/* 剩余可支付时间:到点后端超时任务会自动取消并释放库存 */}
          {failed && !result.expired && result.secondsLeft !== null ? (
            <View style={styles.countdown}>
              <HomeIcon name="clock" size={16} color={colors.hot} />
              <Text style={styles.countdownText}>
                {`${t('hotels.booking.success.payWithin')} ${formatCountdown(result.secondsLeft)}`}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ------------------------------------------------- 凭证卡 2659:13488 */}
        <View style={styles.voucherCard}>
          <View style={styles.logoBlock}>
            <Image source={VOUCHER_LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={styles.tagline}>{t('hotels.booking.success.travelWithUs')}</Text>
          </View>

          {/* 状态行与订单详情页共用一份(同一个 Figma 组件 `2661:16931`) */}
          <View style={styles.statusBlockWrap}>
            <BookingStatusRows
              paymentLabel={t('hotels.booking.success.paymentStatus')}
              /* 以前写死 PAID —— 失败态下那是错的 */
              paymentBadge={t(
                failed ? 'hotels.booking.success.failedBadge' : 'hotels.booking.success.paid',
              )}
              bookingLabel={t('hotels.booking.success.bookingStatus')}
              rows={statusRows.map((row) => ({
                key: row.key,
                roomLabel: row.roomLabel,
                badge: t(
                  failed
                    ? 'hotels.booking.success.pendingBadge'
                    : confirmed
                      ? 'hotels.booking.success.confirmed'
                      : 'hotels.booking.success.confirming',
                ),
                badgeIcon: failed ? 'clock' : confirmed ? 'checkmarkCircle' : 'clock',
                badgeColor: tone,
              }))}
            />
          </View>

          <View style={styles.idRow}>
            <Text style={styles.idLabel} numberOfLines={1}>
              {t('hotels.booking.success.bookingId')}
              <Text style={styles.idValue}>{bookingId}</Text>
            </Text>
            <Pressable onPress={copyId} hitSlop={8}>
              {({ pressed }) => (
                <View style={pressed ? bookingShared.pressed : undefined}>
                  <HomeIcon name="copy" width={17} height={20} color={colors.textSoft} />
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* ------------------------------------------------ 预订详情 2659:13580 */}
        <View style={styles.detailGroup}>
          <Text style={styles.detailHead}>{t('hotels.booking.success.bookingDetails')}</Text>
          <View style={styles.detailCard}>
            <Image source={thumb} style={styles.thumb} resizeMode="cover" />
            <View style={styles.detailInfo}>
              <Text style={styles.hotelName} numberOfLines={2}>
                {hotelName}
              </Text>
              <View style={styles.dateRow}>
                <HomeIcon
                  name="calendarOutline"
                  width={10.5}
                  height={11.667}
                  color={colors.textSoft}
                />
                <Text style={styles.dateText} numberOfLines={1}>
                  {t('hotels.booking.success.dateRange', {
                    checkIn: formatMonthDayYear(checkIn, i18n.language),
                    checkOut: formatMonthDayYear(checkOut, i18n.language),
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 引流卡 2659:13597 —— 文案里要嵌城市名,地址为空时整块不出 */}
        {address ? (
          <View style={styles.upsell}>
            <Text style={styles.upsellText}>
              {t('hotels.booking.success.upsell', { city: address.split(',').pop()?.trim() })}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.upsellLink, pressed && bookingShared.pressed]}
              onPress={comingSoon}
            >
              <Text style={styles.upsellLinkText}>{t('hotels.booking.success.upsellLink')}</Text>
              <HomeIcon name="arrowRightLine" size={9.333} color={DEEP_PRIMARY} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/**
       * 吸底 2659:13620 —— 成功态稿面只有 View Booking 这一枚。
       * 失败态多一枚「稍后再付」:主按钮对**已有订单**重新发起支付(`useBookingResult.repay`),
       * 成功即就地切成 confirmed(不再 push 新页);超时后主按钮禁用,只能去我的预订。
       */}
      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        {failed ? (
          <View style={styles.btnRow}>
            <Pressable
              style={({ pressed }) => [styles.ghostBtn, pressed && bookingShared.pressed]}
              onPress={viewBooking}
            >
              <Text style={styles.ghostText}>{t('hotels.booking.success.payLater')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                styles.flex,
                (result.paying || result.expired) && styles.btnDisabled,
                pressed && bookingShared.pressed,
              ]}
              disabled={result.paying || result.expired}
              onPress={() => {
                void result.repay().then((ok) => {
                  if (ok) showToast(t('hotels.booking.success.paidToast'));
                });
              }}
            >
              <Text style={styles.primaryText}>
                {result.paying ? t('common.loading') : t('hotels.booking.success.payNow')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && bookingShared.pressed]}
            onPress={viewBooking}
          >
            <Text style={styles.primaryText}>{t('hotels.booking.success.viewBooking')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  flex: { flex: 1 },
  statusBar: { backgroundColor: '#000000' },
  /* 稿面 Main pt96 是从屏幕顶算的,状态栏 54 已由上面那条黑条占掉 */
  main: { paddingHorizontal: PAGE_PADDING, paddingTop: 96 - 54, gap: 32 },

  /* ---- 结果头 ---- */
  header: { alignItems: 'center', gap: 16 },
  iconWrap: {
    width: 96,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  title: {
    width: '100%',
    fontFamily: fonts.interBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.96,
    textAlign: 'center',
    color: colors.heading,
  },
  desc: {
    width: '100%',
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.muted,
  },

  /* ---- 凭证卡 ---- */
  voucherCard: {
    width: '100%',
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: colors.surface,
    shadowColor: '#4E73FF',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 3,
  },
  logoBlock: { alignItems: 'center', paddingVertical: 24 },
  logo: { width: 100, height: 74 },
  tagline: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },

  /* 稿面状态区整体 py20;行内样式在 components/hotel/booking/BookingStatusRows */
  statusBlockWrap: { width: '100%', paddingVertical: 20 },

  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  idLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.inter,
    fontSize: 18,
    lineHeight: 28,
    color: colors.textSoft,
  },
  idValue: { fontFamily: fonts.interSemi, color: colors.heading },

  /* ---- 预订详情 ---- */
  detailGroup: { gap: 8 },
  detailHead: {
    paddingHorizontal: 4,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },
  detailCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5EEFF',
    backgroundColor: colors.surface,
    /* 稿面是 drop-shadow 0 10 15 rgba(78,115,255,.08) —— 与全局 shadows.card 的色不同,单独写 */
    shadowColor: '#4E73FF',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  thumb: { width: 96, height: 96, borderRadius: 12.8 },
  detailInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
  hotelName: { fontFamily: fonts.inter, fontSize: 18, lineHeight: 22.5, color: colors.heading },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  dateText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /* ---- 引流卡 ---- */
  upsell: {
    alignItems: 'center',
    gap: 7.5,
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DDE1FF',
    backgroundColor: 'rgba(221, 225, 255, 0.3)',
  },
  upsellText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: '#0037B9',
  },
  upsellLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  upsellLinkText: {
    fontFamily: fonts.interBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    textAlign: 'center',
    color: DEEP_PRIMARY,
  },

  /* ---- 吸底 ---- */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 16,
    backgroundColor: colors.surface,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryText: {
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },

  /* ---- 支付失败态(结果页第三态) ---- */
  /** 后端给的失败原因:红、居中、压在说明下面 */
  failReason: {
    fontFamily: fonts.inter,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.hot,
  },
  /** 应付金额:失败态下让用户知道这一按下去要付多少 */
  amountLine: {
    fontFamily: fonts.interBold,
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.primary,
  },
  /** 剩余可支付时间:红底浅色胶囊 */
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${colors.hot}1A`,
  },
  countdownText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.hot,
  },
  /** 失败态吸底两枚按钮:稍后再付(描边)+ 立即支付(主色,占宽) */
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghostText: {
    fontFamily: fonts.interMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.primary,
  },
  btnDisabled: { opacity: 0.5 },
});
