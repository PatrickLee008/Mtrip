/**
 * 酒店筛选面板(Figma M-Trip / Filter overlay 408:1824)—— 从底部升起的浮层
 *
 * 结构:吸顶头(X / Filter By / Reset)→ 可滚动主体 → 吸底 CTA。
 * 主体分区(区块间距 24,区块内 16):
 *   Recent Filters   本机最近应用过的筛选项(没有就不渲染)
 *   Budget           计价口径下拉 → 直方图+双滑块(PriceRangeSlider)→ 最低/最高输入框
 *   Popular Filters  设计稿的常用项,与下方分组共用同一个选项键(勾一处,另一处同步)
 *   Star Rating / Guest Review Score / Property Types  固定选项
 *   Amenities / Bed Type / Room Features & View / Location  选项取自真实物业/房型数据,无数据的分组不渲染
 *
 * 设计稿实测:
 *   面板     --tab 底,上圆角 32,padding 24;吸顶/吸底条 padding 16、与主体之间 1px --secondary 分隔
 *   勾选行   space-between:左 20px 复选框 + 12px 文字(gap 4),右 12px 计数(--text-2)
 *   计价下拉 rgba(78,115,255,0.1) 底、圆角 8、padding 4,右侧 12px 箭头
 *   输入框   1px --secondary 描边、圆角 4、padding 8、高 36;内部 MMK 12px + 数值 16px
 *   CTA      主色、圆角 8、px16/py8,Inter 600/14 白字
 *
 * 与后端的关系:选项键(见 HotelFilterValue)经 filterToParams 转成 `/app/hotels/list` 的查询参数;
 * 右侧计数来自 `/app/hotels/filters`(按目的地/关键词圈定、不叠加其它条件),
 * CTA 里的总数是用当前草稿实查一次列表(pageSize=1)得到的真实结果数。
 * 设计稿的「2/3 bedrooms」没有卧室数数据可依,暂不提供;计价口径下拉没有第二组选项,走 onComingSoon。
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

import {
  fetchHotelFacets,
  fetchHotelList,
  type HotelFacetOption,
  type HotelFacets,
  type HotelListParams,
} from '@/api/goods';
import HomeIcon from '@/components/home/HomeIcon';
import PriceRangeSlider, { PriceRange } from '@/components/hotel/PriceRangeSlider';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { storage } from '@/utils/storage';

/** 价格域:设计稿只给了 10,000 / 500,000 两个示例值,这里取一个能容下它们的整档区间 */
export const PRICE_MIN = 0;
export const PRICE_MAX = 1_000_000;
export const PRICE_STEP = 10_000;

/**
 * checked 里是选项键,形如:
 *   breakfast / freeCancel / star:4 / score:9 / type:hotel
 *   amenity:wifi / bed:king / feature:minibar / city:yangon(后四类的值是后端归一化键)
 */
export interface HotelFilterValue {
  checked: string[];
  price: PriceRange;
}

/** 默认不限价:滑块停在两端时不带价格参数 */
export const DEFAULT_HOTEL_FILTER: HotelFilterValue = {
  checked: [],
  price: { low: PRICE_MIN, high: PRICE_MAX },
};

/** 列表接口的圈定范围(面板据此取计数与实时结果数) */
export type HotelFilterScope = Pick<HotelListParams, 'countryCode' | 'cityKey' | 'keyword' | 'citizen'>;

const valuesOf = (checked: string[], group: string) =>
  checked.filter((k) => k.startsWith(`${group}:`)).map((k) => k.slice(group.length + 1));

/** 选项键 → 列表接口参数;住客评分取所选档位里最高的那档(/10 制换算成库里的 /5 制) */
export function filterToParams(value: HotelFilterValue): HotelListParams {
  const { checked, price } = value;
  const csv = (group: string) => valuesOf(checked, group).join(',') || undefined;
  const scores = valuesOf(checked, 'score').map(Number);
  return {
    priceMin: price.low > PRICE_MIN ? price.low : undefined,
    priceMax: price.high < PRICE_MAX ? price.high : undefined,
    starLevels: csv('star'),
    reviewScore: scores.length ? Math.max(...scores) / 2 : undefined,
    propertyTypes: csv('type'),
    amenities: csv('amenity'),
    bedTypes: csv('bed'),
    roomFeatures: csv('feature'),
    cities: csv('city'),
    breakfast: checked.includes('breakfast') ? 1 : undefined,
    freeCancel: checked.includes('freeCancel') ? 1 : undefined,
  };
}

/** 本机最近应用过的筛选项(存 key + 展示名,动态选项的名字来自接口) */
const RECENT_STORAGE_KEY = 'hotel.recentFilters';
const RECENT_MAX = 5;
interface RecentItem {
  key: string;
  label: string;
}

interface FilterOption {
  key: string;
  label: string;
  /** 该行用 N 颗星代替文字 */
  stars?: number;
}

const STAR_LEVELS = [5, 4, 3, 2, 1];
const SCORE_LEVELS = [9, 8, 7, 6];
const PROPERTY_TYPES = ['hotel', 'homesApts', 'hostels', 'hourly'];
const POPULAR_KEYS = [
  'breakfast',
  'star:4',
  'type:hotel',
  'score:9',
  'freeCancel',
  'amenity:wifi',
  'amenity:gym',
  'amenity:pool',
];

interface Props {
  visible: boolean;
  value: HotelFilterValue;
  /** 目的地/关键词/公民身份,决定计数与实时结果数的范围 */
  scope?: HotelFilterScope;
  onClose: () => void;
  onApply: (value: HotelFilterValue) => void;
  /** 设计稿有、当前没有对应能力的入口(计价口径下拉) */
  onComingSoon: () => void;
}

export default function HotelFilterSheet({
  visible,
  value,
  scope,
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
  const [facets, setFacets] = useState<HotelFacets | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  /** 当前草稿的真实结果数;null = 查询中 */
  const [resultTotal, setResultTotal] = useState<number | null>(null);

  const scopeKey = JSON.stringify(scope ?? {});
  const draftKey = JSON.stringify(draft);

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMounted(true);
      void storage.getObject<RecentItem[]>(RECENT_STORAGE_KEY).then((list) => setRecent(list ?? []));
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

  /* 计数:每次打开按当前范围取一次 */
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    fetchHotelFacets({ countryCode: scope?.countryCode, cityKey: scope?.cityKey, keyword: scope?.keyword })
      .then((data) => {
        if (alive) setFacets(data);
      })
      .catch(() => {
        if (alive) setFacets(null);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scopeKey]);

  /* CTA 结果数:草稿变动后防抖 300ms 实查一次 */
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setResultTotal(null);
    const timer = setTimeout(() => {
      fetchHotelList({ ...scope, ...filterToParams(draft), page: 1, pageSize: 1 })
        .then((data) => {
          if (alive) setResultTotal(data.total);
        })
        .catch(() => {
          if (alive) setResultTotal(null);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, draftKey, scopeKey]);

  const translateY = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [winH, 0] }),
    [anim, winH],
  );

  /** 住客评分是「N 分以上」,档位之间互斥 */
  const toggle = (key: string) =>
    setDraft((d) => {
      if (d.checked.includes(key)) return { ...d, checked: d.checked.filter((k) => k !== key) };
      const rest = key.startsWith('score:')
        ? d.checked.filter((k) => !k.startsWith('score:'))
        : d.checked;
      return { ...d, checked: [...rest, key] };
    });

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

  /* ---- 选项 ---- */
  const dynamic = (group: string, list: HotelFacetOption[] | undefined): FilterOption[] =>
    (list ?? []).map((o) => ({ key: `${group}:${o.key}`, label: o.label }));
  const amenityOptions = dynamic('amenity', facets?.amenities);
  const bedOptions = dynamic('bed', facets?.beds);
  const featureOptions = dynamic('feature', facets?.features);
  const cityOptions = dynamic('city', facets?.cities);
  const dynamicOptions = [...amenityOptions, ...bedOptions, ...featureOptions, ...cityOptions];

  /** 右侧计数;接口没回来之前不显示 */
  const facetCount = (key: string): number | undefined => {
    if (!facets) return undefined;
    if (key in facets.counts) return facets.counts[key];
    const [group, val] = key.split(':');
    const groups: Record<string, HotelFacetOption[]> = {
      amenity: facets.amenities,
      bed: facets.beds,
      feature: facets.features,
      city: facets.cities,
    };
    return groups[group] ? (groups[group].find((o) => o.key === val)?.count ?? 0) : undefined;
  };

  const staticLabel: Record<string, string> = {
    breakfast: t('hotels.filter.options.breakfast'),
    freeCancel: t('hotels.filter.options.freeCancellation'),
    'amenity:wifi': t('hotels.filter.options.wifi'),
    'amenity:gym': t('hotels.filter.options.gym'),
    'amenity:pool': t('hotels.filter.options.pool'),
  };
  PROPERTY_TYPES.forEach((k) => {
    staticLabel[`type:${k}`] = t(`hotels.filter.options.${k}`);
  });
  SCORE_LEVELS.forEach((n) => {
    staticLabel[`score:${n}`] = t('hotels.filter.scoreAtLeast', { score: n });
  });
  STAR_LEVELS.forEach((n) => {
    staticLabel[`star:${n}`] = t('hotels.filter.starsLabel', { stars: n });
  });

  const labelOf = (key: string) =>
    staticLabel[key] ??
    dynamicOptions.find((o) => o.key === key)?.label ??
    recent.find((r) => r.key === key)?.label ??
    key;
  const opt = (key: string): FilterOption => ({
    key,
    label: labelOf(key),
    stars: key.startsWith('star:') ? Number(key.slice(5)) : undefined,
  });

  /** 应用时把这次勾选的项排到「最近筛选」最前 */
  const apply = () => {
    if (draft.checked.length) {
      const fresh = draft.checked.map((key) => ({ key, label: labelOf(key) }));
      const next = [...fresh, ...recent.filter((r) => !draft.checked.includes(r.key))];
      void storage.setObject(RECENT_STORAGE_KEY, next.slice(0, RECENT_MAX));
    }
    onApply(draft);
  };

  const renderRow = (section: string, option: FilterOption) => {
    const checked = draft.checked.includes(option.key);
    const count = facetCount(option.key);
    return (
      <Pressable
        key={`${section}.${option.key}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => toggle(option.key)}
      >
        <View style={styles.rowLeft}>
          {/* 设计稿只画了未选中态,选中态沿用登录/酒店页既有的 checkboxIndeterminate + 主色 */}
          <HomeIcon
            name={checked ? 'checkboxIndeterminate' : 'checkbox'}
            size={20}
            color={checked ? colors.primary : colors.textSoft}
          />
          {option.stars ? (
            <View style={styles.stars}>
              {Array.from({ length: option.stars }).map((_, i) => (
                <HomeIcon key={i} name="star" size={16} color={colors.star} />
              ))}
            </View>
          ) : (
            <Text style={styles.rowLabel}>{option.label}</Text>
          )}
        </View>
        {count !== undefined && <Text style={styles.rowCount}>{count}</Text>}
      </Pressable>
    );
  };

  const renderSection = (section: string, title: string, options: FilterOption[]) =>
    options.length === 0 ? null : (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {options.map((o) => renderRow(section, o))}
      </View>
    );

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
            {renderSection('recent', t('hotels.filter.recent'), recent.map((r) => opt(r.key)))}

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
            {renderSection('popular', t('hotels.filter.popular'), POPULAR_KEYS.map(opt))}

            {/* 04 固定分组 */}
            {renderSection('star', t('hotels.filter.starRating'), STAR_LEVELS.map((n) => opt(`star:${n}`)))}
            {renderSection('score', t('hotels.filter.reviewScore'), SCORE_LEVELS.map((n) => opt(`score:${n}`)))}
            {renderSection('type', t('hotels.filter.propertyTypes'), PROPERTY_TYPES.map((k) => opt(`type:${k}`)))}

            {/* 05 数据驱动分组(选项来自真实物业/房型) */}
            {renderSection('amenity', t('hotels.filter.amenities'), amenityOptions)}
            {renderSection('bed', t('hotels.filter.bedType'), bedOptions)}
            {renderSection('feature', t('hotels.filter.roomFeatures'), featureOptions)}
            {renderSection('city', t('hotels.filter.location'), cityOptions)}
          </ScrollView>

          {/* 吸底 CTA */}
          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={apply}>
              <Text style={styles.ctaText}>
                {t('hotels.filter.showResults', { total: resultTotal ?? '…' })}
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
