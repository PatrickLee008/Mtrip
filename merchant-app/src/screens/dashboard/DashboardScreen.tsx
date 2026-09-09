import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, PAGE_PADDING } from '@/config/theme';
import { fonts } from '@/config/typography';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <View style={styles.content}>
        <Image source={require('../../../assets/images/onboarding/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.copy}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Working on the homepage design—should have it ready soon!</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: PAGE_PADDING },
  logo: { width: 109, height: 80 },
  copy: { width: '100%', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.outfitBold, fontSize: 20, lineHeight: 30, color: colors.surface, textTransform: 'uppercase', textAlign: 'center' },
  subtitle: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface, textAlign: 'center' },
});
