/**
 * 首页搜索区(设计稿 `Search Section` node 81:2466)
 *
 * 设计稿实测:370x45 r24 #FEFEFE,pad 13/25,gap 12,
 * 1px --secondary #D9E1FB 描边 + DS_AG 投影(0/20 blur40 spread-10 #0F294D 8%)
 * 设计稿里 Explore 按钮(81:2473)已隐藏,搜索靠键盘回车提交。
 */

import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { fetchHotelList } from '@/api/goods';
import { useSiteStore } from '@/store/siteStore';
import { useCommonStore } from '@/store/commonStore';
import type { GoodsItem } from '@/types/models';
import { colors, shadows } from '@/config/theme';
import { fonts } from '@/config/typography';

export default function SearchSection() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const siteId = useSiteStore(s => s.siteId);
  const lite = useCommonStore(s => s.liteMode);
  const [value, setValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const keyword = value.trim();

  function close() {
    setExpanded(false);
    Keyboard.dismiss();
  }
  function submit() {
    if (!keyword) return;
    close();
    navigation.navigate('GoodsList', { keyword });
  }
  function openHotel(hotel: GoodsItem) {
    close();
    const id = hotel.property_id ?? hotel.id;
    if (lite) navigation.navigate('HotelDetailLite', { id });
    else navigation.navigate('HotelDetail', { propertyId: id });
  }

  return (
    <View>
      <View style={styles.wrap}>
        <HomeIcon name="search" size={18} color={colors.primary} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={text => { setValue(text); setExpanded(true); }}
          onFocus={() => setExpanded(true)}
          accessibilityLabel={t('home.searchPlaceholder')}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor="#8B8C91"
          returnKeyType="search"
          onSubmitEditing={submit}
        />
      </View>
      {expanded && focused && keyword !== '' && (
        <HotelSuggestions key={siteId + '/' + keyword} keyword={keyword} onSelect={openHotel} onSubmit={submit} />
      )}
    </View>
  );
}

function HotelSuggestions({ keyword, onSelect, onSubmit }: {
  keyword: string;
  onSelect: (hotel: GoodsItem) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<GoodsItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const page = await fetchHotelList({ keyword, page: 1, pageSize: 5 }, { silent: true });
        if (active) setItems(page.list);
      } catch {
        if (active) setFailed(true);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [keyword, attempt]);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{t('home.quickAction.hotels')}</Text>
      {failed ? (
        <Pressable style={styles.row} accessibilityRole="button" onPress={() => {
          setFailed(false);
          setAttempt(n => n + 1);
        }}>
          <Text>{t('home.searchFailed')}</Text>
        </Pressable>
      ) : items === null ? <Text style={styles.row}>{t('common.loading')}</Text>
        : items.length === 0 ? <Text style={styles.row}>{t('hotels.results.empty')}</Text>
        : items.map(hotel => (
          <Pressable key={hotel.property_id ?? hotel.id} style={styles.row} accessibilityRole="button" onPress={() => onSelect(hotel)}>
            <Text numberOfLines={1}>{hotel.property_name || hotel.goods_name}</Text>
            {!!hotel.address && <Text numberOfLines={1} style={styles.address}>{hotel.address}</Text>}
          </Pressable>
        ))}
      <Pressable accessibilityRole="button" style={styles.row} onPress={onSubmit}>
        <Text style={styles.heading}>{t('home.seeAll')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderRadius: 16, marginTop: 6, padding: 14 },
  row: { paddingVertical: 10 },
  heading: { fontFamily: fonts.inter, color: colors.primary, fontWeight: '600' },
  address: { color: colors.muted, marginTop: 2 },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 45,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.softBlue,
    backgroundColor: colors.surface,
    paddingHorizontal: 25,
    ...shadows.card,
  },
  /**
   * `minWidth: 0` 不能省(登录页 / 酒店搜索框同款):web 端 TextInput 落成 `<input>`,
   * 其 `min-width: auto` 约等于 20 个字符宽,`flex: 1` 压不下去,富余空间为负时整行溢出。
   */
  input: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    fontFamily: fonts.inter,
    fontSize: 16,
    color: colors.body,
    padding: 0,
  },
});
