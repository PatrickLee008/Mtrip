/**
 * 支付方式行(设计稿 1675:6597 起「Popular / Other Payment Methods」)
 *
 * 设计稿实测:共用壳 padding 25、两端对齐
 *   左侧 gap16:40 的圆角 8 图标板(`#E5EEFF` 底;mTrip 钱包那格换成深主色 10%)+ 两行文案
 *        标题 Inter 700/16 `--text`、副行 Inter 400/16 `--text-2`
 *   右侧 24 的勾选框(fluent:checkbox-unchecked-16-filled)
 *
 * 可展开的两行(Credit/debit Cards、Mobile Banking)右侧换成 12x7.4 的 chevron,
 * 标题下方多一行卡组织标(高 16、1px `--secondary` 描边、圆角 4、padding 4)。
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import HomeIcon from '@/components/home/HomeIcon';
import { PAY_TILE_BG, TINT_DEEP, bookingShared } from '@/components/hotel/booking/bookingShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

export interface BrandLogo {
  key: string;
  source: ImageSourcePropType;
  width: number;
}

interface Props {
  icon: ImageSourcePropType;
  /** 叠在 icon 上的第二层(设计稿只有 Mobile Banking 那格是两层) */
  iconOverlay?: ImageSourcePropType | null;
  /** 图标板底色换成深主色 10%(设计稿只有 mTrip 钱包那格) */
  deepTile?: boolean;
  /** 图标在板子里不铺满(设计稿 MMQR 是 55% 宽 / 84% 高的窄图) */
  iconInset?: boolean;
  title: string;
  desc?: string | null;
  /** 展开型的行:右侧是 chevron,不是勾选框 */
  expandable?: boolean;
  expanded?: boolean;
  checked?: boolean;
  brands?: BrandLogo[];
  onPress: () => void;
  children?: React.ReactNode;
}

export default function PaymentMethodRow({
  icon,
  iconOverlay,
  deepTile = false,
  iconInset = false,
  title,
  desc,
  expandable = false,
  expanded = false,
  checked = false,
  brands,
  onPress,
  children,
}: Props) {
  return (
    <View style={[bookingShared.panel, styles.card]}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && bookingShared.pressed]}
        onPress={onPress}
      >
        <View style={styles.left}>
          <View style={[styles.tile, deepTile && styles.tileDeep]}>
            <Image
              source={icon}
              style={iconInset ? styles.tileImageInset : styles.tileImage}
              resizeMode={iconInset ? 'contain' : 'cover'}
            />
            {iconOverlay ? (
              <Image source={iconOverlay} style={styles.tileOverlay} resizeMode="contain" />
            ) : null}
          </View>
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {desc ? (
              <Text style={styles.desc} numberOfLines={1}>
                {desc}
              </Text>
            ) : null}
            {brands?.length ? (
              <View style={styles.brands}>
                {brands.map((brand) => (
                  <View key={brand.key} style={styles.brandBox}>
                    <Image
                      source={brand.source}
                      style={{ width: brand.width, height: 16 }}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {expandable ? (
          <View style={expanded ? styles.chevronUp : undefined}>
            <HomeIcon name="chevronDown" width={12} height={7.4} color={colors.primary} />
          </View>
        ) : (
          <HomeIcon
            name={checked ? 'checkboxIndeterminate' : 'checkbox'}
            size={24}
            color={checked ? colors.primary : colors.softBlue}
          />
        )}
      </Pressable>

      {expandable && expanded && children ? <View style={styles.expand}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  left: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1, minWidth: 0 },

  tile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: PAY_TILE_BG,
  },
  tileDeep: { backgroundColor: TINT_DEEP },
  tileImage: { width: '100%', height: '100%' },
  tileImageInset: { width: '55%', height: '84%' },
  tileOverlay: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },

  title: { fontFamily: fonts.interBold, fontSize: 16, lineHeight: 24, color: colors.heading },
  desc: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.textSoft },

  brands: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  brandBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.softBlue,
  },

  chevronUp: { transform: [{ rotate: '180deg' }] },
  expand: { gap: 12 },
});
