import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context';

/**
 * Super Admin Portal 设计令牌(docs/redesign/super-admin-portal/design-system.md):
 * 主蓝 #1664FF、成功 #027A48 / 警告 #B54708 / 危险 #C01048 / 信息 #026AA2。
 * 深色导航底 navy #0A1628(见 BasicLayout / SideMenu 的 --sap-navy)。
 */
export const baseToken: ThemeConfig['token'] = {
  colorPrimary: '#1664FF',
  colorSuccess: '#027A48',
  colorWarning: '#B54708',
  colorError: '#C01048',
  colorInfo: '#026AA2',
  borderRadius: 4,
  fontFamily:
    '"Inter", -apple-system, BlinkMacSystemFont, Roboto, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
};

/** 组件级微调(antd-vue 4.x Layout token) */
export const lightComponents: ThemeConfig['components'] = {
  Layout: {
    colorBgHeader: '#FFFFFF',
  },
  Card: { borderRadiusLG: 8 },
  Modal: { borderRadiusLG: 8 },
};
