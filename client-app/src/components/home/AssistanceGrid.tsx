/**
 * 旅行协助(设计稿 12):三行 358x82 r20 #EFF4FF,pad 20,gap 16
 * 左 40x40 圆形图标底(前两条 #0036AD,紧急求助 #FFDAD6/#BA1A1A)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeIcon, { type HomeIconName } from '@/components/home/HomeIcon';
import { colors, radius } from '@/config/theme';
import { fonts } from '@/config/typography';
import { ASSISTANCE_ITEMS } from '@/screens/home/homeSections';

const ICONS: Record<string, HomeIconName> = {
  liveSupport: 'chat',
  visaGuide: 'document',
  emergency: 'alert',
};

interface Props {
  onPress: (key: string) => void;
}

export default function AssistanceGrid({ onPress }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      {ASSISTANCE_ITEMS.map((key) => {
        const emergency = key === 'emergency';
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => onPress(key)}
          >
            <View style={[styles.circle, emergency && styles.circleDanger]}>
              <HomeIcon
                name={ICONS[key]}
                size={20}
                color={emergency ? colors.emergencyFg : '#FFFFFF'}
              />
            </View>
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {t(`home.assistance.${key}.name`)}
              </Text>
              <Text style={styles.desc} numberOfLines={1}>
                {t(`home.assistance.${key}.desc`)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 82,
    borderRadius: radius.tile,
    backgroundColor: colors.tintBg,
    paddingHorizontal: 20,
  },
  pressed: { opacity: 0.85 },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.deepBlue,
  },
  circleDanger: { backgroundColor: colors.emergencyBg },
  body: { flex: 1, marginLeft: 16 },
  name: { fontFamily: fonts.inter, fontSize: 16, lineHeight: 24, color: colors.cardTitle },
  desc: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 18, color: colors.muted },
});
