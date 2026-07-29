/**
 * 分页列表布局:下拉刷新 + 上拉加载,内置加载/空/错误态
 * fetcher 返回后端统一分页结构 PageData
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PageData } from '@/api/types';
import { EmptyView, ErrorView, LoadingView } from '@/components/common/StateViews';
import { colors, fontSize, spacing } from '@/config/theme';

const PAGE_SIZE = 10;

interface Props<T> {
  fetcher: (page: number, pageSize: number) => Promise<PageData<T>>;
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  /** 变化时重置并重新加载(如筛选条件) */
  reloadKey?: string | number;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  emptyText?: string;
}

export default function ListLayout<T>({
  fetcher,
  renderItem,
  keyExtractor,
  reloadKey,
  ListHeaderComponent,
  emptyText,
}: Props<T>) {
  const { t } = useTranslation();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);
  const busyRef = useRef(false);

  const load = useCallback(
    async (page: number, mode: 'init' | 'refresh' | 'more') => {
      if (busyRef.current) return;
      busyRef.current = true;
      if (mode === 'init') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const data = await fetcher(page, PAGE_SIZE);
        pageRef.current = page;
        setItems((prev) => (page === 1 ? data.list : [...prev, ...data.list]));
        setHasMore(page * data.pageSize < data.total);
        setError('');
      } catch (e) {
        if (page === 1) setItems([]);
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        busyRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [fetcher],
  );

  useEffect(() => {
    void load(1, 'init');
  }, [load, reloadKey]);

  if (loading) return <LoadingView />;
  if (error && items.length === 0) return <ErrorView message={error} onRetry={() => void load(1, 'init')} />;

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.content}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={<EmptyView text={emptyText} />}
      ListFooterComponent={
        items.length > 0 ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {loadingMore ? t('common.loadMore') : hasMore ? '' : t('common.noMore')}
            </Text>
          </View>
        ) : null
      }
      refreshing={refreshing}
      onRefresh={() => void load(1, 'refresh')}
      onEndReached={() => {
        if (hasMore && !loadingMore) void load(pageRef.current + 1, 'more');
      }}
      onEndReachedThreshold={0.3}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: spacing.md },
  emptyContent: { flexGrow: 1 },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  footerText: { fontSize: fontSize.xs, color: colors.textSecondary },
});
