import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/config/theme';

export type FeatureIconName = 'booking' | 'mobile' | 'support';

const ICONS: Record<FeatureIconName, { bg: string; stroke: string; d: string }> = {
  // Path data copied from the downloaded Figma SVG assets in assets/images/onboarding/.
  booking: {
    bg: colors.successLight,
    stroke: colors.success,
    d: 'M13 7H21M21 7V15M21 7L13 15L9 11L3 17',
  },
  mobile: {
    bg: colors.primaryLight,
    stroke: colors.info,
    d: 'M12 18H12.01M8 21H16C17.1038 21 18 20.1038 18 19V5C18 3.89617 17.1038 3 16 3H8C6.89617 3 6 3.89617 6 5V19C6 20.1038 6.89617 21 8 21L12 18',
  },
  support: {
    bg: colors.warningLight,
    stroke: colors.warning,
    d: 'M18.364 5.636L14.828 9.172M14.828 14.828L18.364 18.364M9.172 9.172L5.636 5.636M9.172 14.828L5.636 18.364M21 12C21 16.9672 16.9672 21 12 21C7.03276 21 3 16.9672 3 12C3 7.03276 7.03276 3 12 3C16.9672 3 21 7.03276 21 12L18.364 5.636M13.364 5.636C13.364 7.84366 11.5717 9.636 9.364 9.636C7.15634 9.636 5.364 7.84366 5.364 5.636C5.364 3.42834 7.15634 1.636 9.364 1.636C11.5717 1.636 13.364 3.42834 13.364 5.636V5.636',
  },
};

interface FeatureIconProps {
  name: FeatureIconName;
}

export default function FeatureIcon({ name }: FeatureIconProps) {
  const icon = ICONS[name];
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 9999,
        backgroundColor: icon.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d={icon.d}
          stroke={icon.stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
