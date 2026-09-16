/**
 * 关怀模式「酒店政策」页(Figma `Hotel Details Lite` / Lite Hotel Details Policies `2352:8890`)
 *
 * 主详情页顶栏的「Hotel Policy」落到这里。设计稿自上而下:
 * 页头大图 → Booking Policies → 入住 / 退房 → 儿童与加床 → 住店规则。
 *
 * **内容与完整模式的 `HotelPoliciesTab`(222:3503)同源**:同一份 `detailDemo` 常量与
 * `hotels.detail.policies.*` 文案,关怀版只换版式(一列大卡、字号大一档)。
 *
 * **退改规则这一段是真的**:`/app/goods/detail` 的 `refundRules` 按
 * rule_type(1 免费取消 / 2 阶梯 / 3 不可退)渲染,没有规则时按「免费取消」口径显示
 * —— 与 order-service `computeRefund` 的兜底一致(无规则视为全额可退)。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { fetchHotelDetail } from '@/api/goods';
import { TEMP_HOTEL_COVERS } from '@/assets/tempImages';
import { ErrorView, LoadingView } from '@/components/common/StateViews';
import HomeIcon from '@/components/home/HomeIcon';
import { liteShared } from '@/components/hotel/lite/liteShared';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';
import type { RootStackParamList } from '@/navigation/types';
import {
  DETAIL_CHECK_TIMES,
  DETAIL_EXTRA_BEDS,
  DETAIL_PROPERTY_RULES,
  DETAIL_REQUIRED_DOCS,
} from '@/screens/hotel/detailDemo';
import { useSiteStore } from '@/store/siteStore';
import type { GoodsDetail, RefundRule } from '@/types/models';
import { formatMoney } from '@/utils/format';

/** 设计稿这一页的小标题用的是这一版深蓝(与完整模式政策页同一个值) */
const HEADING_BLUE = '#204DDA';

export default function HotelPolicyLiteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = useRoute<RouteProp<RootStackParamList, 'HotelPolicyLite'>>().params;
  const currency = useSiteStore((s) => s.currency);

  const [detail, setDetail] = useState<GoodsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchHotelDetail(params.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error || !detail) return <ErrorView message={error} onRetry={() => void load()} />;

  return (
    <View style={liteShared.root}>
      <SafeAreaView style={liteShared.safe} edges={['top']}>
        <View style={liteShared.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <HomeIcon name="arrowLeft" size={20} color={colors.primary} />
          </Pressable>
          <Text style={liteShared.topTitle} numberOfLines={1}>
            {t('hotels.detail.policies.title')}
          </Text>
        </View>

        <ScrollView
          style={liteShared.flex}
          contentContainerStyle={liteShared.main}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image
              source={detail.images?.[0] ? { uri: detail.images[0] } : TEMP_HOTEL_COVERS[0]}
              style={styles.headerImage}
              resizeMode="cover"
            />
          </View>

          {/* 01 预订政策(含真实退改规则) */}
          <View style={liteShared.card}>
            <View style={liteShared.row}>
              <HomeIcon name="bookingPolicy" width={18} height={20} color={HEADING_BLUE} />
              <Text style={[liteShared.sectionTitle, styles.headingBlue]}>
                {t('hotels.detail.policies.booking.title')}
              </Text>
            </View>

            <View style={styles.clause}>
              <Text style={liteShared.itemTitle}>
                {t('hotels.detail.policies.booking.cancellation.title')}
              </Text>
              <Text style={liteShared.body}>{refundText(detail.refundRules, t)}</Text>
            </View>

            <View style={styles.clause}>
              <Text style={liteShared.itemTitle}>
                {t('hotels.detail.policies.booking.prepayment.title')}
              </Text>
              <Text style={liteShared.body}>
                {t('hotels.detail.policies.booking.prepayment.body')}
              </Text>
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>{t('hotels.detail.policies.taxes.title')}</Text>
              <Text style={liteShared.body}>{t('hotels.detail.policies.taxes.body')}</Text>
            </View>
          </View>

          {/* 02/03 入住 / 退房 */}
          {DETAIL_CHECK_TIMES.map((item) => (
            <View key={item.key} style={liteShared.card}>
              <View style={liteShared.row}>
                <HomeIcon name={item.icon} size={20} color={colors.primary} />
                <Text style={liteShared.sectionTitle}>
                  {t(`hotels.detail.policies.${item.key}.title`)}
                </Text>
              </View>
              <Text style={styles.checkTime}>{item.time}</Text>
              <Text style={liteShared.body}>{t(`hotels.detail.policies.${item.key}.body`)}</Text>

              {item.key === 'checkIn' ? (
                <View style={styles.docs}>
                  <Text style={liteShared.groupTitle}>
                    {t('hotels.detail.policies.requiredDocs')}
                  </Text>
                  {DETAIL_REQUIRED_DOCS.map((doc) => (
                    <View key={doc} style={liteShared.row}>
                      <HomeIcon name="checkmarkCircle" size={20} color={colors.primary} />
                      <Text style={liteShared.bodyLarge}>
                        {t(`hotels.detail.policies.docs.${doc}`)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}

          {/* 04 儿童与加床 */}
          <View style={liteShared.card}>
            <Text style={liteShared.sectionTitle}>
              {t('hotels.detail.policies.extraBeds.title')}
            </Text>
            {DETAIL_EXTRA_BEDS.map((bed) => (
              <View key={bed.key} style={styles.bedRow}>
                <View style={liteShared.flexCol}>
                  <Text style={liteShared.itemTitle}>
                    {t(`hotels.detail.policies.extraBeds.${bed.key}.label`)}
                  </Text>
                  <Text style={liteShared.body}>
                    {t(`hotels.detail.policies.extraBeds.${bed.key}.body`)}
                  </Text>
                </View>
                <Text style={styles.bedPrice}>
                  {bed.complimentary
                    ? t('hotels.detail.policies.extraBeds.complimentary')
                    : `${formatMoney(bed.price ?? 0, currency)}${t('hotels.detail.rooms.perNight')}`}
                </Text>
              </View>
            ))}
          </View>

          {/* 05 住店规则 */}
          <View style={liteShared.card}>
            <Text style={liteShared.sectionTitle}>{t('hotels.detail.policies.rules.title')}</Text>
            {DETAIL_PROPERTY_RULES.map((rule) => (
              <View key={rule.key} style={liteShared.row}>
                <HomeIcon
                  name={rule.icon}
                  width={rule.width}
                  height={rule.height}
                  color={colors.primary}
                />
                <View style={liteShared.flexCol}>
                  <Text style={liteShared.itemTitle}>
                    {t(`hotels.detail.policies.rules.${rule.key}.title`)}
                  </Text>
                  <Text style={liteShared.body}>
                    {t(`hotels.detail.policies.rules.${rule.key}.body`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * 退改规则文案:取商品级(sku_type=0)或任一房型规则里**最先命中的一条**。
 * rule_type 1 免费取消 / 2 阶梯 / 3 不可退;没有规则 = 免费取消(与后端兜底一致)。
 */
function refundText(rules: RefundRule[] | undefined, t: (key: string) => string): string {
  const rule = rules?.[0];
  if (!rule || rule.rule_type === 1) return t('hotels.lite.policy.freeCancel');
  if (rule.rule_type === 3) return t('hotels.lite.policy.nonRefundable');
  return t('hotels.lite.policy.tieredRefund');
}

const styles = StyleSheet.create({
  header: { width: '100%', height: 180, borderRadius: 24, overflow: 'hidden' },
  headerImage: { width: '100%', height: '100%' },

  headingBlue: { color: HEADING_BLUE },
  clause: { gap: 4 },
  notice: {
    gap: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.tintBg,
  },
  noticeTitle: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.heading },

  checkTime: { fontFamily: fonts.interBold, fontSize: 32, lineHeight: 40, color: colors.primary },
  docs: { gap: 12, paddingTop: 4 },

  bedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bedPrice: { fontFamily: fonts.interSemi, fontSize: 16, lineHeight: 24, color: colors.primary },
});
