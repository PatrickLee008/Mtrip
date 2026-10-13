/**
 * 「支持到店付款 · 即将开放」提示条
 *
 * 物业在商户端政策里打开「支持到店付款」后(`hotel_policies.booking.payAtHotel`,接口下发 `payAtHotel`),
 * App 筛选能筛出它,但到店付款下单本期未开放 —— 在酒店详情、核对页钱包卡上方、支付页三处给出同一句提示,
 * 免得用户以为能直接到店付。支付流程上线后删掉本组件的调用即可。
 *
 * 样式沿用订房向导里的浅主色提示块(主色 10% 底、圆角 12、信息图标)。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon from '@/components/home/HomeIcon';
import { colors } from '@/config/theme';
import { fonts } from '@/config/typography';

export default function PayAtHotelNotice() {
  const { t } = useTranslation();
  return (
    <View style={styles.box}>
      <HomeIcon name="info" size={16} color={colors.primary} />
      <View style={styles.texts}>
        <Text style={styles.title}>{t('hotels.payAtHotel.title')}</Text>
        <Text style={styles.desc}>{t('hotels.payAtHotel.desc')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(65, 105, 237, 0.1)',
  },
  texts: { flex: 1, gap: 2 },
  title: {
    fontFamily: fonts.interSemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  desc: {
    fontFamily: fonts.inter,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
  },
});
