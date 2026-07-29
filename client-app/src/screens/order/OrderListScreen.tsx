/**
 * 我的订单:状态筛选 Tab + 分页列表(未登录引导登录)
 */

import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { fetchOrderList } from '@/api/order';
import OrderItemCard from '@/components/business/OrderItemCard';
import CustomButton from '@/components/common/CustomButton';
import ListLayout from '@/components/layout/ListLayout';
import PageLayout from '@/components/layout/PageLayout';
import { ORDER_STATUS, ORDER_STATUS_I18N } from '@/config/global';
import { colors, fontSize, spacing } from '@/config/theme';
import { useUserStore } from '@/store/userStore';
import type { OrderItemData } from '@/types/models';

/** 筛选 Tab:全部 + 常用状态 */
const STATUS_TABS: Array<number | undefined> = [
  undefined,
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PAID,
  ORDER_STATUS.FINISHED,
  ORDER_STATUS.REFUNDING,
];

export default function OrderListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isLogin = useUserStore((s) => s.isLogin);
  const [status, setStatus] = useState<number | undefined>(undefined);
  // Tab 获焦时刷新(支付/取消后返回)
  const [focusVersion, setFocusVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFocusVersion((v) => v + 1);
    }, []),
  );

  const fetcher = useCallback(
    (page: number, pageSize: number) => fetchOrderList({ page, pageSize, status }),
    [status],
  );

  if (!isLogin) {
    return (
      <PageLayout>
        <View style={styles.guard}>
          <Text style={styles.guardIcon}>🔒</Text>
          <Text style={styles.guardText}>{t('user.notLogin')}</Text>
          <View style={styles.guardBtn}>
            <CustomButton title={t('user.login')} onPress={() => navigation.navigate('Login')} />
          </View>
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <View style={styles.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS_TABS.map((s) => {
            const active = s === status;
            return (
              <Pressable key={s ?? -1} style={styles.tab} onPress={() => setStatus(s)}>
                <Text style={[styles.tabText, active && styles.tabActive]}>
                  {s === undefined ? t('common.all') : t(ORDER_STATUS_I18N[s])}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ListLayout<OrderItemData>
        fetcher={fetcher}
        reloadKey={`${status ?? 'all'}-${focusVersion}`}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <OrderItemCard
            order={item}
            onPress={(o) => navigation.navigate('OrderDetail', { orderId: o.id })}
          />
        )}
      />
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  guard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  guardIcon: { fontSize: 40 },
  guardText: { marginTop: spacing.md, fontSize: fontSize.sm, color: colors.textSecondary },
  guardBtn: { marginTop: spacing.lg, width: 200 },
  tabBarWrap: { backgroundColor: colors.card },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary },
  tabActive: { color: colors.primary, fontWeight: '700' },
});
