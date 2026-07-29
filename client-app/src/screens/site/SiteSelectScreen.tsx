/**
 * 站点选择:切换站点后联动货币/语言,返回首页刷新
 */

import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { ErrorView, LoadingView } from '@/components/common/StateViews';
import PageLayout from '@/components/layout/PageLayout';
import { SUPPORTED_LANGS, type Lang } from '@/config/global';
import { colors, fontSize, radius, spacing } from '@/config/theme';
import { changeLanguage } from '@/i18n';
import { useCommonStore } from '@/store/commonStore';
import { useSiteStore } from '@/store/siteStore';
import type { SiteInfo } from '@/types/models';

export default function SiteSelectScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const siteId = useSiteStore((s) => s.siteId);
  const siteList = useSiteStore((s) => s.siteList);
  const loadSiteList = useSiteStore((s) => s.loadSiteList);
  const switchSite = useSiteStore((s) => s.switchSite);
  const setLang = useCommonStore((s) => s.setLang);

  const [loading, setLoading] = useState(siteList.length === 0);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(0);

  useEffect(() => {
    if (siteList.length > 0) return;
    loadSiteList()
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [siteList.length, loadSiteList]);

  const select = async (site: SiteInfo) => {
    if (switching) return;
    setSwitching(site.id);
    try {
      await switchSite(site.id);
      // 站点默认语言在支持范围内时联动 i18n
      const lang = site.language as Lang;
      if (SUPPORTED_LANGS.includes(lang)) {
        await setLang(lang);
        changeLanguage(lang);
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSwitching(0);
    }
  };

  if (loading) return <LoadingView />;
  if (error && siteList.length === 0) {
    return (
      <ErrorView
        message={error}
        onRetry={() => {
          setError('');
          setLoading(true);
          loadSiteList()
            .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setLoading(false));
        }}
      />
    );
  }

  return (
    <PageLayout>
      <FlatList
        data={siteList}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const active = item.id === siteId;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => void select(item)}
            >
              <View style={styles.info}>
                <Text style={[styles.name, active && styles.activeName]}>{item.site_name}</Text>
                <Text style={styles.meta}>
                  {item.country_code} · {item.currency} · {item.language}
                </Text>
              </View>
              {active ? <Text style={styles.current}>{t('site.current')}</Text> : null}
            </Pressable>
          );
        }}
      />
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.85 },
  info: { flex: 1 },
  name: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  activeName: { color: colors.primary },
  meta: { marginTop: spacing.xs, fontSize: fontSize.xs, color: colors.textSecondary },
  current: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' },
});
