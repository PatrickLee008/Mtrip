/**
 * 首页:站点切换 + 搜索 + 酒店/门票入口 + 推荐/热门商品
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchHome } from '@/api/goods';
import GoodsCard from '@/components/business/GoodsCard';
import SiteSwitchEntry from '@/components/business/SiteSwitchEntry';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import { GOODS_TYPE } from '@/config/global';
import { colors, fontSize, radius, spacing } from '@/config/theme';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsItem } from '@/types/models';

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const siteId = useSiteStore((s) => s.siteId);
  const siteName = useSiteStore((s) => s.siteName);
  const switchSite = useSiteStore((s) => s.switchSite);

  const [keyword, setKeyword] = useState('');
  const [recommend, setRecommend] = useState<GoodsItem[]>([]);
  const [hot, setHot] = useState<GoodsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchHome();
      setRecommend(data.recommend);
      setHot(data.hot);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, siteId]);

  // 首次进入若无站点快照,拉取默认站点配置(货币/时区/语言)
  useEffect(() => {
    if (!siteName) {
      switchSite(siteId).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goodsPress = (goods: GoodsItem) => navigation.navigate('GoodsDetail', { id: goods.id });

  const search = () => {
    const kw = keyword.trim();
    navigation.navigate('GoodsList', kw ? { keyword: kw } : {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <SiteSwitchEntry onPress={() => navigation.navigate('SiteSelect')} />
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={keyword}
          onChangeText={setKeyword}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <Pressable style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>{t('common.search')}</Text>
        </Pressable>
      </View>
      <View style={styles.entryRow}>
        <Pressable
          style={styles.entry}
          onPress={() =>
            navigation.navigate('GoodsList', { goodsType: GOODS_TYPE.HOTEL, title: t('home.hotel') })
          }
        >
          <Text style={styles.entryIcon}>🏨</Text>
          <Text style={styles.entryText}>{t('home.hotel')}</Text>
        </Pressable>
        <Pressable
          style={styles.entry}
          onPress={() =>
            navigation.navigate('GoodsList', { goodsType: GOODS_TYPE.TICKET, title: t('home.ticket') })
          }
        >
          <Text style={styles.entryIcon}>🎫</Text>
          <Text style={styles.entryText}>{t('home.ticket')}</Text>
        </Pressable>
      </View>
      {loading ? (
        <LoadingView />
      ) : error && recommend.length === 0 && hot.length === 0 ? (
        <ErrorView message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView
          style={styles.flex}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        >
          {recommend.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('home.recommend')}</Text>
              {recommend.map((g) => (
                <GoodsCard key={g.id} goods={g} onPress={goodsPress} />
              ))}
            </>
          ) : null}
          {hot.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('home.hot')}</Text>
              {hot.map((g) => (
                <GoodsCard key={g.id} goods={g} onPress={goodsPress} />
              ))}
            </>
          ) : null}
          <View style={styles.bottomSpace} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  search: {
    flex: 1,
    height: 40,
    backgroundColor: colors.card,
    borderRadius: radius.round,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  searchBtn: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.round,
    paddingHorizontal: spacing.lg,
    height: 40,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '600' },
  entryRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  entry: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginRight: spacing.md,
  },
  entryIcon: { fontSize: 26 },
  entryText: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  bottomSpace: { height: spacing.xl },
});
