/**
 * 主题令牌(与管理后台 admin-web 主色一致)
 */

export const colors = {
  primary: '#1668dc',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  text: '#1f1f1f',
  textSecondary: '#8c8c8c',
  border: '#f0f0f0',
  background: '#f5f6f8',
  card: '#ffffff',
  price: '#ff6b35',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  price: 18,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  round: 999,
} as const;
