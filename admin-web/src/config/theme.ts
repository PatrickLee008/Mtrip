import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context';

/**
 * UI 方案 2.1 色彩体系:主蓝 #1677FF、辅助橙 #FF7D00、
 * 成功 #00B42A / 警告 #FF7D00 / 危险 #F53F3F / 信息 #86909C
 */
export const baseToken: ThemeConfig['token'] = {
  colorPrimary: '#1677FF',
  colorSuccess: '#00B42A',
  colorWarning: '#FF7D00',
  colorError: '#F53F3F',
  colorInfo: '#1677FF',
  borderRadius: 4,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, Roboto, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
};

/** 亮色主题下的组件级微调(antd-vue 4.x Layout token) */
export const lightComponents: ThemeConfig['components'] = {
  Layout: {
    colorBgHeader: '#FFFFFF',
  },
  Card: { borderRadiusLG: 8 },
  Modal: { borderRadiusLG: 8 },
};

export const darkComponents: ThemeConfig['components'] = {
  Layout: {
    colorBgHeader: '#141414',
  },
  Card: { borderRadiusLG: 8 },
  Modal: { borderRadiusLG: 8 },
};
