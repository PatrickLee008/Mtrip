import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context';

/**
 * 原型色彩体系:主蓝 #2563EB、辅助橙 #FF7D00、
 * 成功 #00B42A / 警告 #FF7D00 / 危险 #EF4444
 */
export const baseToken: ThemeConfig['token'] = {
  colorPrimary: '#2563EB',
  colorSuccess: '#00B42A',
  colorWarning: '#FF7D00',
  colorError: '#EF4444',
  colorInfo: '#2563EB',
  borderRadius: 8,
  fontFamily:
    "'Plus Jakarta Sans', Inter, system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
};

export const lightComponents: ThemeConfig['components'] = {
  Layout: {
    colorBgHeader: '#FFFFFF',
  },
  Card: { borderRadiusLG: 8 },
  Modal: { borderRadiusLG: 8 },
};
