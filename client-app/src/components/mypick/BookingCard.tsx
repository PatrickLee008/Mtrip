/**
 * 预订卡(设计稿 `Booking Card 3`:单间 `289:1362` / 多房间 `2492:12049` / 多酒店 `2291:5340`)
 *
 * **一个 Trip 一张卡**:多房间与多酒店在列表里都只占一张,明细留到详情页(Figma `289:1112`)。
 * 三种形态共用这一份,差异只在三个可选入口:
 *   多房间  房型行换成「N Rooms」(由调用方把 `skuName` 传成这个文案)
 *   多酒店  封面下加一条 92 高的缩略图带(首段图 + 第二段图压 60% 黑幕 +「2nd Stay」白字),
 *           并在 Booking ID 下面加一行主色的「Multi Booking (N Stay)」
 *   待支付  稿面把地图按钮设为 hidden、主按钮换成整宽的 Continue Payment(`2438:7350`)
 *
 * 设计稿实测:底色 --tab #FEFEFE,1px 边框 --secondary #D9E1FB,**圆角 24**
 * (稿面 `rounded-[24px]`;本文件早先写的 32 是旧稿数值,本轮按现稿改),
 * 投影 DS_AG 0/20 blur40 spread-10 rgba(15,41,77,0.08)。
 *   顶部:368x176 封面 + 右上角状态胶囊(12 图标 + 大写状态文案,Inter 400/11 字距 0.55)
 *   缩略图带(仅多酒店):外框 2px --secondary、两格等宽;首格 2px 主色描边;第二格 60% 黑幕 + Inter 600/16 白字
 *   正文:padding 16、gap 12
 *     「Booking ID: 」Inter 400/16 --text-2 + 单号 Inter 600 #1B1D30
 *     (多酒店)「Multi Booking (N Stay)」Inter 600/16 主色
 *     酒店名 16 #0B1C30 → 地址(location 图标 + Inter 400/12 --text-2)→ 房型 Inter Medium 14 主色
 *     1px 分隔线
 *     两等分信息栏:图标 + 标签(Inter 400/10 大写 --text-2 透明度 .6)+ 值(Inter 700/12 --text #1B1D30)
 *     底部:主按钮(flex,py12,圆角 12,主色)+ 44x44 描边地图按钮
 *
 * ⚠️ 稿面酒店名是 Outfit Medium,本项目没加载 Outfit 500(只有 400/600/700),沿用 Inter Medium 顶替。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import CoverImage from '@/components/home/CoverImage';
import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

interface Props {
  /**
   * 版式:
   *   `list`(缺省)—— 「我的预订」列表卡(`289:1362`):封面通栏、卡圆角 24
   *   `stay`        —— 多酒店 Trip 详情里的每段住宿(`2142:4402`):卡圆角 32 / p25,
   *                    封面**内嵌**在卡里(圆角 20)。其余(PAID 胶囊 / 酒店名地址房型 /
   *                    DATES·TRAVELERS 两格 / 按钮行 / Booking ID 行)两种版式完全一样,
   *                    所以是同一个组件的两个壳,不另写一份。
   */
  variant?: 'list' | 'stay';
  /** 卡片宽度(页面内容宽度) */
  width: number;
  title: string;
  coverUri?: string | null;
  /** 无 coverUri 时的本地兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  address?: string;
  /** 房型 / 票种;多房间时调用方传「N Rooms」(稿面 `2492:12064` 就是这么写的) */
  skuName?: string;
  /** 「Booking ID: xxx」的单号;不传则整行不渲染(未登录的示例卡) */
  bookingNo?: string;
  /** 多酒店:「Multi Booking (N Stay)」;不传就不是多酒店卡 */
  multiStayLabel?: string;
  /** 多酒店:第二段的封面(压黑幕 +「2nd Stay」),与 `multiStayLabel` 一起才渲染缩略图带 */
  secondCoverUri?: string | null;
  secondCoverSource?: ImageSourcePropType;
  /** 缩略图带第二格的角标文案(「2nd Stay」) */
  secondStayLabel?: string;
  /** 状态胶囊文案(大写展示) */
  statusLabel: string;
  /** 状态胶囊底色,默认设计稿绿色 */
  statusColor?: string;
  /** 入离日期文案 */
  dates: string;
  /** 出行人文案 */
  travelers: string;
  /** 覆盖出行人栏标签(真实订单只有件数,此处传「数量」) */
  travelersLabel?: string;
  /** 覆盖主按钮文案(待支付卡稿面是 Continue Payment);缺省 View Details */
  detailLabel?: string;
  onPressDetail: () => void;
  /** 不传就不渲染地图按钮,主按钮整宽(稿面待支付卡把它设成了 hidden) */
  onPressMap?: () => void;
}

export default function BookingCard({
  variant = 'list',
  width,
  title,
  coverUri,
  coverSource,
  address,
  skuName,
  bookingNo,
  multiStayLabel,
  secondCoverUri,
  secondCoverSource,
  secondStayLabel,
  statusLabel,
  statusColor = colors.statusPaid,
  dates,
  travelers,
  travelersLabel,
  detailLabel,
  onPressDetail,
  onPressMap,
}: Props) {
  const { t } = useTranslation();
  const stay = variant === 'stay';
  /* stay 版封面内嵌在 p25 的卡里,可用宽要再减两侧 padding */
  const coverWidth = width - 2 - (stay ? 50 : 0);
  /** 缩略图带一格的宽:卡宽减 1px 卡边框 ×2、2px 外框 ×2、2px 内边 ×2,再一分为二 */
  const stayCellWidth = (coverWidth - 8) / 2;
  return (
    <View style={[styles.card, { width }, stay && styles.cardStay]}>
      <View style={[styles.coverWrap, stay && styles.coverWrapStay]}>
        <CoverImage
          uri={coverUri}
          fallback={coverSource}
          width={coverWidth}
          height={176}
          radius={stay ? 20 : 0}
          label={title}
        />
        <View style={[styles.status, { backgroundColor: statusColor }]}>
          <HomeIcon name="check" size={13} color="#FFFFFF" />
          <Text style={styles.statusText}>{statusLabel.toUpperCase()}</Text>
        </View>
      </View>

      {/**
       * 多酒店的缩略图带(稿面 `I2291:5340;2291:5234`):两格等宽,第二格压黑幕标「2nd Stay」。
       * 只有同时给了 `multiStayLabel` 与第二段图源才渲染 —— 单间/多房间卡没有这一条。
       */}
      {multiStayLabel && (secondCoverUri || secondCoverSource) ? (
        <View style={styles.stayStrip}>
          <View style={[styles.stayCell, styles.stayCellFirst]}>
            <CoverImage uri={coverUri} fallback={coverSource} width={stayCellWidth} height={80} label={title} />
          </View>
          <View style={styles.stayCell}>
            <CoverImage
              uri={secondCoverUri}
              fallback={secondCoverSource}
              width={stayCellWidth}
              height={84}
              label=""
            />
            <View style={styles.stayScrim} />
            <Text style={styles.stayText}>{secondStayLabel}</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.body, stay && styles.bodyStay]}>
        {/* 稿面:列表卡把 Booking ID 放正文最上(`2492:12190`),Stay 卡放在按钮行之后(`2516:16888`) */}
        {bookingNo && !stay ? (
          <Text style={styles.bookingId} numberOfLines={1}>
            {t('myPick.booking.bookingId')}
            <Text style={styles.bookingIdValue}>{bookingNo}</Text>
          </Text>
        ) : null}

        {multiStayLabel ? <Text style={styles.multiStay}>{multiStayLabel}</Text> : null}

        <View style={styles.headGroup}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {address ? (
            <View style={styles.addressRow}>
              <HomeIcon name="location" size={16} color={colors.textSoft} />
              <Text style={styles.address} numberOfLines={1}>
                {address}
              </Text>
            </View>
          ) : null}
          {skuName ? (
            <Text style={styles.sku} numberOfLines={1}>
              {skuName}
            </Text>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <HomeIcon name="calendar" size={16} color={colors.primary} />
            <View style={styles.metaText}>
              <Text style={styles.metaLabel}>{t('myPick.booking.dates')}</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {dates}
              </Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <HomeIcon name="travelers" size={18} color={colors.primary} />
            <View style={styles.metaText}>
              <Text style={styles.metaLabel}>
                {travelersLabel ?? t('myPick.booking.travelers')}
              </Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {travelers}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onPressDetail}
          >
            <Text style={styles.primaryBtnText}>
              {detailLabel ?? t('myPick.booking.viewDetails')}
            </Text>
          </Pressable>
          {onPressMap ? (
            <Pressable
              style={({ pressed }) => [styles.mapBtn, pressed && styles.pressed]}
              onPress={onPressMap}
            >
              <HomeIcon name="map" size={18} color={colors.body} />
            </Pressable>
          ) : null}
        </View>

        {bookingNo && stay ? (
          <Text style={styles.bookingId} numberOfLines={1}>
            {t('myPick.booking.bookingId')}
            <Text style={styles.bookingIdValue}>{bookingNo}</Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    /* 现稿是 24(旧稿 32);与预订结果页、购物车页的卡同一档 */
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    /* 设计稿 DS_AG:0/20 blur40 spread-10 rgba(15,41,77,0.08) */
    shadowColor: '#0F294D',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  /* stay 版:卡圆角 32 + p25 + gap16(`2142:4402`) */
  cardStay: { borderRadius: 32, padding: 25, gap: 16 },
  coverWrap: { height: 176 },
  coverWrapStay: { height: 176, borderRadius: 20, overflow: 'hidden' },
  status: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 25,
    paddingHorizontal: 12,
    borderRadius: 999,
    /* 设计稿 Overlay+Shadow:0/4 blur6 spread-1 黑 10% */
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusText: {
    fontFamily: fonts.inter,
    fontSize: 11,
    lineHeight: 16.5,
    letterSpacing: 0.55,
    color: '#FFFFFF',
  },
  /**
   * 多酒店缩略图带(`I2291:5340;2291:5234`):整条 92 高
   * = 2px `--secondary` 外框 + 2px 透明内边 + 84 高的两格(稿面两格之间没有间隙)。
   */
  stayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderWidth: 2,
    borderColor: colors.softBlue,
  },
  stayCell: { flex: 1, height: 84, overflow: 'hidden', justifyContent: 'center' },
  stayCellFirst: { borderWidth: 2, borderColor: colors.primary },
  /* 第二段压 60% 黑幕,白字压在正中(稿面 `I2291:5340;2291:5336`) */
  stayScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  stayText: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.interSemi,
    fontSize: 16,
    color: '#FFFFFF',
  },

  body: { padding: 16, gap: 12 },
  /* stay 版的内边距已由卡壳承担,正文不再重复 padding */
  bodyStay: { padding: 0 },
  bookingId: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 16, color: colors.textSoft },
  bookingIdValue: { fontFamily: fonts.interSemi, color: colors.heading },
  /* 「Multi Booking (2 Stay)」Inter 600/16 主色(稿面 `I2291:5340;2291:5239`) */
  multiStay: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 16, color: colors.primary },
  headGroup: { gap: 4 },
  title: { fontFamily: fonts.interMedium, fontSize: 16, lineHeight: 16, color: '#0B1C30' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24 },
  address: { flex: 1, fontFamily: fonts.inter, fontSize: 12, color: colors.textSoft },
  sku: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  divider: { height: 1, backgroundColor: colors.divider },
  metaRow: { flexDirection: 'row', gap: 4 },
  metaCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { flex: 1 },
  metaLabel: {
    fontFamily: fonts.inter,
    fontSize: 10,
    lineHeight: 15,
    textTransform: 'uppercase',
    color: colors.textSoft,
    opacity: 0.6,
  },
  metaValue: { fontFamily: fonts.interBold, fontSize: 12, lineHeight: 24, color: colors.heading },
  actions: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },
  mapBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  pressed: { opacity: 0.85 },
});
