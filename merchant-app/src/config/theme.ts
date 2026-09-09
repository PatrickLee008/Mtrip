/** Merchant App 设计令牌:以 Figma mTrip_Merchant 首屏色板为准。 */

import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  primary: '#0D9488',
  primaryLight: '#CCFBF1',
  canvas: '#F8FAFB',
  surface: '#FFFFFF',
  slate900: '#1E293B',
  text: '#1B1D30',
  body: '#475569',
  muted: 'rgba(30, 41, 59, 0.8)',
  border: '#F8FAFB',
  success: '#16A34A',
  successLight: '#E6F4EA',
  info: '#0284C7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 24, round: 999 } as const;
export const PAGE_PADDING = 16;

const sheetShadow = Platform.select({
  web: { boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.25)' } as unknown as ViewStyle,
  default: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  } as ViewStyle,
});

export const shadows = {
  sheet: sheetShadow,
} as const;
