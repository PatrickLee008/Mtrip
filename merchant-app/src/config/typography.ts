import type { TextStyle } from 'react-native';

import { colors } from '@/config/theme';

export const fonts = {
  outfit: 'Outfit_400Regular',
  outfitSemi: 'Outfit_600SemiBold',
  outfitBold: 'Outfit_700Bold',
  inter: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemi: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const;

export const text: Record<string, TextStyle> = {
  heroTitle: {
    fontFamily: fonts.outfitBold,
    fontSize: 20,
    lineHeight: 30,
    color: colors.surface,
    textTransform: 'uppercase',
  },
  heroBody: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 21, color: colors.surface },
  featureTitle: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.slate900 },
  featureBody: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.slate900 },
  button: { fontFamily: fonts.outfitSemi, fontSize: 16, lineHeight: 24, color: colors.surface },
  body: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, color: colors.text },
};
