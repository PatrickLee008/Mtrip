/**
 * 关怀模式房型卡(Figma `Hotel Details Lite` / `2642:10881` Room Card 4~6)
 *
 * ⚠️ **版式几经反复,以这一版为准**:09-18 曾按 `2540:17042` 改成「整宽 192 封面在上」的大卡,
 * 用户实际看过后判定与设计稿差太多,已按 `2642:10749` 改回**左 90×90 缩略图 + 右文字**的横排卡。
 * 别再照 `2540:17042` 改回去。
 *
 * 设计稿实测(`2642:10881`):
 *   卡壳   `--tab` 底 / 1px `--secondary` / 圆角 24 / padding 16 / 投影 0-1-2 黑 5%,内部 gap12
 *   左列   gap4 居中:90×90 圆角 8 缩略图;下方「See Room」= 20 eye-circle + Inter 600/12/16 主色
 *   右列   flex1 / pl16 / gap4:
 *          标题行 两端对齐:房型名 Outfit 600/20/24 `--text` + Bestseller 药丸
 *                (主色 10% 底,px12 py4 圆角 999,Inter 600/12/16 主色)
 *          参数行 wrap gap8,**每项定宽 100**:图标 + Inter 500/14/20 tracking.14 `--text-2`
 *   分隔线 导出资产 Line 3,实测描边 #D9E1FB(= `--secondary`)
 *   底行   两端对齐:
 *          左价格块 可选「划线原价 + 促销小字」同一行 gap4(均 Inter 600/12,原价 `--text-2` 划线、
 *                  促销主色);主价 Inter 600/20/24 主色 +「/ night」Inter 400/16/15 `--text-2`
 *          右 Choose 按钮:主色底 / **圆角 12** / px16 py8 / Inter 600/20/20 白
 *
 * **多房间选择**:Choose 点一下即加入(置 1 间)、就地换成 −/数量/+ 加减器(旧稿 `2707:13670`);
 * 减到 0 自动移出、按钮变回 Choose。不传 `onChangeQuantity` 就退回纯单选(Choose 直接进订房向导)。
 * ⚠️ 后端 `order/create` **一单只收一个 sku**,合计只是展示 —— 见 `HotelDetailLiteScreen` 底栏注释。
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsSku } from '@/types/models';
import { formatMoney } from '@/utils/format';
import { resolveMediaUri } from '@/utils/media';

/** 设计稿缩略图边长 */
const THUMB = 90;

interface Props {
  sku: GoodsSku;
  /** 房型没有可用图时的兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  /** 房型名右侧角标,如 Bestseller;不传不画(设计稿只有第一张卡有) */
  badge?: string | null;
  /**
   * 多房间选择:已选间数。>0 时右下角那枚 Choose 就地换成 −/数量/+ 加减器。
   * 不传 `onChangeQuantity` 就退回纯单选。
   */
  quantity?: number;
  onChangeQuantity?: (sku: GoodsSku, quantity: number) => void;
  /**
   * 划线原价与促销小字(都已格式化)。接口目前只下发 `base_price`,没有原价/促销字段,
   * 页面暂不传 —— 与 `LiteHotelCard` 只在有公民价时才画划线同一口径,不假装有折扣。
   */
  strike?: string | null;
  promo?: string | null;
  onSeeRoom: (sku: GoodsSku) => void;
  onChoose: (sku: GoodsSku) => void;
}

export default function LiteRoomCard({
  sku,
  coverSource,
  badge,
  quantity = 0,
  onChangeQuantity,
  strike,
  promo,
  onSeeRoom,
  onChoose,
}: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  /**
   * 缩略图:先过 `resolveMediaUri` 把脏值判掉(后台实测填过 `'111'`,非空却加载不出来),
   * 没有可用远程图再回落到设计稿临时图。
   */
  const remote = (sku.images ?? [])
    .map((uri) => resolveMediaUri(uri))
    .filter((uri): uri is string => uri !== null);
  const cover: ImageSourcePropType | undefined = remote[0] ? { uri: remote[0] } : coverSource;
  const price = Number(sku.base_price);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {/* 左列:缩略图 + See Room */}
        <View style={styles.left}>
          {cover ? (
            <Image source={cover} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}

          <Pressable
            style={({ pressed }) => [styles.seeRoom, pressed && styles.pressed]}
            onPress={() => onSeeRoom(sku)}
            hitSlop={6}
          >
            <HomeIcon name="eyeCircle" size={20} color={colors.primary} />
            <Text style={styles.seeRoomText}>{t('hotels.lite.seeRoom')}</Text>
          </Pressable>
        </View>

        {/* 右列:房型名 + 角标 + 参数行 */}
        <View style={styles.right}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={2}>
              {sku.room_name ?? `#${sku.id}`}
            </Text>
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>

          {/* 参数行:每项定宽 100,靠 wrap 折行(设计稿第二张卡四项折成两行) */}
          <View style={styles.metaWrap}>
            {sku.max_guests ? (
              <Meta icon="people" text={t('hotels.lite.guestsCount', { count: sku.max_guests })} />
            ) : null}
            {sku.bed_type ? <Meta icon="bedSize" text={sku.bed_type} /> : null}
            {sku.breakfast === 1 ? (
              <Meta icon="breakfast" text={t('hotels.detail.rooms.breakfast')} />
            ) : null}
            {/* 设计稿第二张卡还有 Wifi —— 接口的 `facilities` 是自由文本数组,命中才画 */}
            {(sku.facilities ?? []).some((f) => /wifi/i.test(f)) ? (
              <Meta icon="wifiFilled" text={t('hotels.detail.rooms.facilities.wifi')} />
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* 底行:价格 + Choose / 加减器 */}
      <View style={styles.footer}>
        <View style={styles.priceCol}>
          {strike || promo ? (
            <View style={styles.promoRow}>
              {strike ? <Text style={styles.strike}>{strike}</Text> : null}
              {promo ? <Text style={styles.promo}>{promo}</Text> : null}
            </View>
          ) : null}
          <View style={styles.priceLine}>
            <Text style={styles.price}>{formatMoney(price, currency)}</Text>
            <Text style={styles.perNight}>{t('hotels.lite.perNight')}</Text>
          </View>
        </View>

        {onChangeQuantity && quantity > 0 ? (
          <View style={styles.stepper}>
            <Pressable
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              onPress={() => onChangeQuantity(sku, quantity - 1)}
              hitSlop={4}
            >
              <HomeIcon name="minus" width={16} height={3} color={colors.heading} />
            </Pressable>
            <Text style={styles.stepValue}>{quantity}</Text>
            <Pressable
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              onPress={() => onChangeQuantity(sku, quantity + 1)}
              hitSlop={4}
            >
              <HomeIcon name="plus" size={16} color={colors.heading} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.chooseBtn, pressed && styles.pressed]}
            onPress={() => onChoose(sku)}
          >
            <Text style={styles.chooseText}>{t('hotels.lite.choose')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** 参数小项:图标 + 文字,定宽 100 让三项在 370 的卡里排成一行 */
function Meta({ icon, text }: { icon: HomeIconName; text: string }) {
  return (
    <View style={styles.meta}>
      <HomeIcon name={icon} size={16} color={colors.textSoft} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 16,
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  pressed: { opacity: 0.85 },

  top: { flexDirection: 'row', alignItems: 'flex-start' },

  left: { alignItems: 'center', gap: 4 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 8 },
  thumbEmpty: { backgroundColor: colors.tintBg },
  seeRoom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeRoomText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.primary },

  right: { flex: 1, minWidth: 0, paddingLeft: 16, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.outfitSemi,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  badgeText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.primary },

  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 100 },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /* 导出资产 Line 3 的实际描边是 #D9E1FB(= --secondary),不是通用的浅灰分隔线 */
  divider: { height: 1, backgroundColor: colors.softBlue },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  priceCol: { flexShrink: 1 },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  strike: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
    textDecorationLine: 'line-through',
  },
  promo: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.primary },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.primary },
  perNight: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 20, color: colors.textSoft },

  chooseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.btn,
    backgroundColor: colors.primary,
  },
  chooseText: {
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 20,
    textAlign: 'center',
    color: '#FFFFFF',
  },

  /* 加减器(旧稿 `2707:13670`):外框 --secondary 底,两侧按钮 --tab 底 1px --secondary */
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.btn,
    backgroundColor: colors.softBlue,
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  stepValue: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: fonts.interBold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },
});
