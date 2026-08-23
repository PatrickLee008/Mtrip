/**
 * 区块标题行:Outfit 600/24 标题 + 右侧「查看全部」链接(设计稿 06/07/08/09/10/11/13 共用)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { text } from '@/config/typography';

interface Props {
  title: string;
  /** 传入即显示右侧链接 */
  onSeeAll?: () => void;
  /** 覆盖右侧链接文案(默认 home.seeAll = See All) */
  seeAllLabel?: string;
}

export default function SectionHeader({ title, onSeeAll, seeAllLabel }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Text style={text.h2} numberOfLines={1}>
        {title}
      </Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={text.link}>{seeAllLabel ?? t('home.seeAll')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});
