/**
 * 关怀模式房型卡(Figma `Hotel Details Lite`:单选 `2492:10530`、多选 `2707:13098` 同卡两态)
 *
 * 单选态右下角是 Choose 按钮,多选态换成 −/数量/+ 的加减器(设计稿 `2707:13670`),
 * 其余部分完全一样,所以做成一个组件 + `mode`,不拆两份。
 *
 * 设计稿实测:
 *   卡片   --tab 底,1px --secondary,圆角 24,padding 16,投影 0/1 blur2 黑 5%,内部 gap12
 *   左列   90×90 圆角 8 缩略图;图上可叠「张数」角标(黑 20% 药丸 + 20 图标 + Inter 400/16 白)
 *          图下「See Room」:16 的 eye-circle + Inter 600/12/16 主色
 *   右列   pl16 gap4:标题行 = 房型名 Outfit 600/20/24 + 角标药丸(主色 10% 底,px12 py4,Inter 600/12 主色)
 *          属性行 wrap gap8,每项定宽 100:12~16 图标 + Inter 500/14/20 --text-2
 *   分隔线 1px rgba(196,197,215,0.3)
 *   底行   左价格块(可选删除线原价 12 + 促销 12 主色;主价 Inter 600/20/24 主色 + "/ night" 16 --text-2)
 *          右 Choose(主色圆角 16,px16 py8,Inter 500/20 白)或加减器
 *   加减器 外框 --secondary 底圆角 12;两侧按钮 --tab 底 1px --secondary;数字 Inter 700/20,最小宽 28
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors, radius, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsSku } from '@/types/models';
import { formatMoney } from '@/utils/format';

export type RoomCardMode = 'single' | 'multi';

interface Props {
  sku: GoodsSku;
  /** 房型没有图时的兜底图(设计稿临时素材) */
  coverSource?: ImageSourcePropType;
  /** 标题右侧角标,如 Bestseller;不传不画 */
  badge?: string | null;
  mode?: RoomCardMode;
  /** 多选态的已选间数 */
  quantity?: number;
  onSeeRoom: (sku: GoodsSku) => void;
  onChoose: (sku: GoodsSku) => void;
  onChangeQuantity?: (sku: GoodsSku, quantity: number) => void;
}

export default function LiteRoomCard({
  sku,
  coverSource,
  badge,
  mode = 'single',
  quantity = 0,
  onSeeRoom,
  onChoose,
  onChangeQuantity,
}: Props) {
  const { t } = useTranslation();
  const currency = useSiteStore((s) => s.currency);

  const images = sku.images ?? [];
  const cover = images[0] ? { uri: images[0] } : coverSource;
  const price = Number(sku.base_price);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.thumbBox}>
            {cover ? (
              <Image source={cover} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]} />
            )}
            {images.length > 1 ? (
              <View style={styles.countBadge}>
                <HomeIcon name="imageCopy" size={14} color="#FFFFFF" />
                <Text style={styles.countText}>{images.length}</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.seeRoom, pressed && styles.pressed]}
            onPress={() => onSeeRoom(sku)}
            hitSlop={6}
          >
            <HomeIcon name="eyeCircle" size={16} color={colors.primary} />
            <Text style={styles.seeRoomText}>{t('hotels.lite.seeRoom')}</Text>
          </Pressable>
        </View>

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

          <View style={styles.metaWrap}>
            {sku.max_guests ? (
              <Meta icon="people" text={t('hotels.lite.guestsCount', { count: sku.max_guests })} />
            ) : null}
            {sku.bed_type ? <Meta icon="bedSize" text={sku.bed_type} /> : null}
            {sku.breakfast === 1 ? (
              <Meta icon="breakfast" text={t('hotels.detail.rooms.breakfast')} />
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.priceCol}>
          <View style={styles.priceLine}>
            <Text style={styles.price}>{formatMoney(price, currency)}</Text>
            <Text style={styles.perNight}>{t('hotels.lite.perNight')}</Text>
          </View>
        </View>

        {mode === 'single' ? (
          <Pressable
            style={({ pressed }) => [styles.choose, pressed && styles.pressed]}
            onPress={() => onChoose(sku)}
          >
            <Text style={styles.chooseText}>{t('hotels.lite.choose')}</Text>
          </Pressable>
        ) : (
          <View style={styles.stepper}>
            <Pressable
              style={({ pressed }) => [
                styles.stepBtn,
                quantity <= 0 && styles.stepDisabled,
                pressed && quantity > 0 && styles.pressed,
              ]}
              disabled={quantity <= 0}
              onPress={() => onChangeQuantity?.(sku, quantity - 1)}
              hitSlop={4}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{quantity}</Text>
            <Pressable
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              onPress={() => onChangeQuantity?.(sku, quantity + 1)}
              hitSlop={4}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/** 属性小项:图标 + 文字,定宽 100 让三项在 370 的卡里排成一行 */
function Meta({ icon, text }: { icon: 'people' | 'bedSize' | 'breakfast'; text: string }) {
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
    ...shadows.subtle,
  },
  pressed: { opacity: 0.85 },

  row: { flexDirection: 'row', alignItems: 'flex-start' },
  left: { alignItems: 'center', gap: 4 },
  thumbBox: { width: 90, height: 90, borderRadius: 8, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { backgroundColor: colors.tintBg },
  countBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  countText: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  seeRoom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeRoomText: { fontFamily: fonts.interSemi, fontSize: 12, lineHeight: 16, color: colors.primary },

  right: { flex: 1, minWidth: 0, paddingLeft: 16, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
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

  divider: { height: 1, backgroundColor: 'rgba(196, 197, 215, 0.3)' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  priceCol: { flex: 1, minWidth: 0 },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  price: { fontFamily: fonts.interSemi, fontSize: 20, lineHeight: 24, color: colors.primary },
  perNight: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 20, color: colors.textSoft },

  choose: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  chooseText: {
    fontFamily: fonts.interMedium,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.14,
    color: '#FFFFFF',
  },

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
  stepDisabled: { opacity: 0.5 },
  stepText: { fontFamily: fonts.interBold, fontSize: 20, lineHeight: 24, color: colors.heading },
  stepValue: {
    minWidth: 36,
    textAlign: 'center',
    fontFamily: fonts.interBold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heading,
  },
});
