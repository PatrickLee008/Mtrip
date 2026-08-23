/**
 * 酒店筛选面板(Figma M-Trip / Filter overlay 408:1824)—— 从底部升起的浮层
 *
 * 结构:吸顶头(X / Filter By / Reset)→ 可滚动主体 → 吸底 CTA。
 * 主体分区(区块间距 24,区块内 16):
 *   Recent Filters   最近用过的筛选项
 *   Budget           计价口径下拉 → 直方图+双滑块(PriceRangeSlider)→ 最低/最高输入框
 *   Popular Filters  10 个勾选项(其一是 4 颗星,无文字)
 *   Property Types   4 个勾选项 + Show more
 *
 * 设计稿实测:
 *   面板     --tab 底,上圆角 32,padding 24;吸顶/吸底条 padding 16、与主体之间 1px --secondary 分隔
 *   勾选行   space-between:左 20px 复选框 + 12px 文字(gap 4),右 12px 计数(--text-2)
 *   计价下拉 rgba(78,115,255,0.1) 底、圆角 8、padding 4,右侧 12px 箭头
 *   输入框   1px --secondary 描边、圆角 4、padding 8、高 36;内部 MMK 12px + 数值 16px
 *   CTA      主色、圆角 8、px16/py8,Inter 600/14 白字
 *
 * 与后端的关系:goods 列表接口(/api/v1/app/goods/list)只有 goodsType/categoryId/keyword,
 * 没有价格区间与设施筛选参数,**所以这些选择目前只留在前端状态里**,不参与请求;
 * 各项右侧的计数(600+/1200+…)与 CTA 里的总数同样是设计稿静态值。
 * 计价口径下拉与 Show more 在设计稿里没有第二组选项,统一走 onComingSoon。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import PriceRangeSlider, { PriceRange } from '@/components/hotel/PriceRangeSlider';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';

/** 价格域:设计稿只给了 10,000 / 500,000 两个示例值,这里取一个能容下它们的整档区间 */
export const PRICE_MIN = 0;
export const PRICE_MAX = 1_000_000;
export const PRICE_STEP = 10_000;

export interface HotelFilterValue {
  /** 选中项的复合键,形如 popular.wifi */
  checked: string[];
  price: PriceRange;
}

export const DEFAULT_HOTEL_FILTER: HotelFilterValue = {
  checked: [],
  price: { low: 10_000, high: 500_000 },
};

/** 计数是设计稿静态值,stars 表示该行用 4 颗星代替文字 */
interface FilterOption {
  key: string;
  count: string;
  stars?: number;
}

const RECENT: FilterOption[] = [{ key: 'breakfast', count: '600+' }];

const POPULAR: FilterOption[] = [
  { key: 'breakfast', count: '600+' },
  { key: 'rating4', count: '600+', stars: 4 },
  { key: 'hotel', count: '1200+' },
  { key: 'rating9', count: '800+' },
  { key: 'freeCancellation', count: '600+' },
  { key: 'wifi', count: '100+' },
  { key: 'gym', count: '100+' },
  { key: 'bedrooms2', count: '31' },
  { key: 'bedrooms3', count: '20' },
  { key: 'pool', count: '10' },
];

const PROPERTY: FilterOption[] = [
  { key: 'hotel', count: '1200+' },
  { key: 'homesApts', count: '800+' },
  { key: 'hostels', count: '600+' },
  { key: 'hourly', count: '100+' },
];

/** CTA 里的结果总数(设计稿静态值) */
const TOTAL_RESULTS = '6300+';

interface Props {
  visible: boolean;
  value: HotelFilterValue;
  onClose: () => void;
  onApply: (value: HotelFilterValue) => void;
  /** 设计稿有、当前没有对应能力的入口(计价口径下拉 / Show more) */
  onComingSoon: () => void;
}

export default function HotelFilterSheet({
  visible,
  value,
  onClose,
  onApply,
  onComingSoon,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  /* 关闭动画要放完才能卸载 Modal,故内部自己维持一份挂载态 */
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  /* 面板内是草稿:改动到点 Show Results 才回传给页面,X 关闭则丢弃 */
  const [draft, setDraft] = useState<HotelFilterValue>(value);

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // value 只在打开的那一刻取一次,拖动草稿时不该被父级回灌
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const translateY = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [winH, 0] }),
    [anim, winH],
  );

  const toggle = (key: string) =>
    setDraft((d) => ({
      ...d,
      checked: d.checked.includes(key)
        ? d.checked.filter((k) => k !== key)
        : [...d.checked, key],
    }));

  const setPrice = (price: PriceRange) => setDraft((d) => ({ ...d, price }));

  /** 输入框里只认数字,失焦时再夹到合法区间(边输边夹会把中间态吃掉) */
  const editPrice = (key: keyof PriceRange, raw: string) => {
    const n = Number(raw.replace(/[^0-9]/g, '')) || 0;
    setDraft((d) => ({
      ...d,
      price: key === 'low' ? { ...d.price, low: n } : { ...d.price, high: n },
    }));
  };
  const commitPrice = () =>
    setDraft((d) => {
      const low = Math.min(Math.max(d.price.low, PRICE_MIN), PRICE_MAX);
      const high = Math.min(Math.max(d.price.high, PRICE_MIN), PRICE_MAX);
      return { ...d, price: { low: Math.min(low, high), high: Math.max(low, high) } };
    });

  const renderRow = (section: string, opt: FilterOption) => {
    const key = `${section}.${opt.key}`;
    const checked = draft.checked.includes(key);
    return (
      <Pressable
        key={key}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => toggle(key)}
      >
        <View style={styles.rowLeft}>
          {/* 设计稿只画了未选中态,选中态沿用登录/酒店页既有的 checkboxIndeterminate + 主色 */}
          <HomeIcon
            name={checked ? 'checkboxIndeterminate' : 'checkbox'}
            size={20}
            color={checked ? colors.primary : colors.textSoft}
          />
          {opt.stars ? (
            <View style={styles.stars}>
              {Array.from({ length: opt.stars }).map((_, i) => (
                <HomeIcon key={i} name="star" size={16} color={colors.star} />
              ))}
            </View>
          ) : (
            <Text style={styles.rowLabel}>{t(`hotels.filter.options.${opt.key}`)}</Text>
          )}
        </View>
        <Text style={styles.rowCount}>{opt.count}</Text>
      </Pressable>
    );
  };

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[styles.panel, { maxHeight: winH * 0.86, transform: [{ translateY }] }]}
        >
          {/* 吸顶头 */}
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <Pressable onPress={onClose} hitSlop={12}>
                <HomeIcon name="close" size={12} color={colors.textSoft} />
              </Pressable>
            </View>
            <Text style={styles.headerTitle}>{t('hotels.filter.title')}</Text>
            <View style={[styles.headerSide, styles.headerRight]}>
              <Pressable onPress={() => setDraft(DEFAULT_HOTEL_FILTER)} hitSlop={12}>
                <Text style={styles.reset}>{t('hotels.filter.reset')}</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 01 最近使用 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('hotels.filter.recent')}</Text>
              {RECENT.map((opt) => renderRow('recent', opt))}
            </View>

            {/* 02 预算 */}
            <View style={styles.section}>
              <Text style={styles.budgetLabel}>{t('hotels.filter.budget')}</Text>

              <Pressable
                style={({ pressed }) => [styles.select, pressed && styles.pressed]}
                onPress={onComingSoon}
              >
                <Text style={styles.selectText}>{t('hotels.filter.budgetBasis')}</Text>
                {/* caretLeft 转 -90° 即设计稿的下拉箭头 */}
                <View style={styles.caret}>
                  <HomeIcon name="caretLeft" size={12} color={colors.textSoft} />
                </View>
              </Pressable>

              <PriceRangeSlider
                min={PRICE_MIN}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={draft.price}
                onChange={setPrice}
              />

              <View style={styles.priceRow}>
                {(['low', 'high'] as const).map((key) => (
                  <View key={key} style={styles.priceCol}>
                    <Text style={styles.priceLabel}>
                      {t(key === 'low' ? 'hotels.filter.minimum' : 'hotels.filter.maximum')}
                    </Text>
                    <View style={styles.priceBox}>
                      <Text style={styles.currency}>{t('hotels.filter.currency')}</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={draft.price[key].toLocaleString('en-US')}
                        onChangeText={(v) => editPrice(key, v)}
                        onBlur={commitPrice}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        selectTextOnFocus
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 03 热门筛选 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('hotels.filter.popular')}</Text>
              {POPULAR.map((opt) => renderRow('popular', opt))}
            </View>

            {/* 04 住宿类型 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('hotels.filter.propertyTypes')}</Text>
              {PROPERTY.map((opt) => renderRow('property', opt))}
              <Pressable
                style={({ pressed }) => [styles.showMore, pressed && styles.pressed]}
                onPress={onComingSoon}
                hitSlop={8}
              >
                <Text style={styles.showMoreText}>{t('hotels.filter.showMore')}</Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* 吸底 CTA */}
          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={() => onApply(draft)}
            >
              <Text style={styles.ctaText}>
                {t('hotels.filter.showResults', { total: TOTAL_RESULTS })}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.4)' },

  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.softBlue,
  },
  /* 三等分栏:左 X / 中标题 / 右 Reset。不给 flex-start 的话按钮会被拉满整栏,误触关闭 */
  headerSide: { flex: 1, alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.interSemi,
    fontSize: 20,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
    textAlign: 'center',
  },
  reset: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },

  /* RN 的 flexShrink 默认是 0:不显式给 1,主体撑高后会顶穿面板的 maxHeight */
  body: { flexShrink: 1 },
  bodyContent: { padding: 24, gap: 24 },
  section: { gap: 16 },
  sectionTitle: {
    fontFamily: fonts.interSemi,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowLabel: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  rowCount: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  budgetLabel: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
    borderRadius: 8,
    /* 设计稿 rgba(78,115,255,0.1),比 tintBg 更透,直接用原值 */
    backgroundColor: 'rgba(78, 115, 255, 0.1)',
  },
  selectText: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  caret: { transform: [{ rotate: '-90deg' }] },

  priceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  priceCol: { flex: 1, gap: 4 },
  priceLabel: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSoft,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.softBlue,
    borderRadius: 4,
  },
  currency: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },
  priceInput: {
    flex: 1,
    /* 同酒店页搜索框:web 端 <input> 的 min-width:auto 会把描边框撑破 */
    minWidth: 0,
    padding: 0,
    fontFamily: fonts.inter,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.heading,
  },

  showMore: { alignSelf: 'flex-start' },
  showMoreText: {
    fontFamily: fonts.interSemi,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.primary,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.softBlue,
    backgroundColor: colors.surface,
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  pressed: { opacity: 0.85 },
});
