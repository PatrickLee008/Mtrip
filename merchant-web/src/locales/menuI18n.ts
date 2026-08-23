import type { MenuNode } from '@/api/types';
import { i18n } from './index';

/**
 * 菜单名称 i18n 映射(历史兼容)
 * 菜单多语言优先走 merchant_menu.i18n_key;旧数据无 i18n_key 时,用本表把中文名兑成词条 key 兜底
 */
export const MENU_I18N: Record<string, string> = {
  工作台: 'menu.dashboard',
  组织与权限: 'menu.org',
  子账号管理: 'menu.account',
  角色管理: 'menu.role',
  门店管理: 'menu.store',
  订单核销: 'menu.order',
  商品管理: 'menu.goods',
  客房管理: 'menu.rooms',
  房量与价格: 'menu.availability',
  收益结算: 'menu.earnings',
  通知中心: 'menu.notifications',
  营销活动: 'menu.promotions',
  评价管理: 'menu.reviews',
  帮助中心: 'menu.support',
  设置: 'menu.settings',
};

/** 把后端返回的中文菜单名解析为 i18n key(找不到时返回 undefined,原样使用) */
export function resolveMenuI18nKey(name: string): string | undefined {
  return MENU_I18N[name];
}

/**
 * 统一菜单显示名解析(侧边栏/面包屑/页面标题/权限树共用):
 * 1) i18n_key(缺失时用中文名映射兜底)命中词条 → t(key)
 * 2) 未命中且当前非中文环境 → menu_name_en
 * 3) 其余 → menu_name(中文原值),再兜底原始 key(静态路由纯文本标题)
 */
export function resolveMenuTitle(i18nKey: string, nameZh: string, nameEn = ''): string {
  const g = i18n.global;
  const key = i18nKey || MENU_I18N[nameZh] || '';
  if (key && g.te(key)) {
    return g.t(key);
  }
  if (g.locale.value !== 'zh-CN' && nameEn) {
    return nameEn;
  }
  return nameZh || nameEn || key;
}

/** MenuNode 便捷包装(兼容旧数据无 i18n_key/menu_name_en 的情况) */
export function menuTitle(
  node: Pick<MenuNode, 'menu_name'> & Partial<Pick<MenuNode, 'menu_name_en' | 'i18n_key'>>,
): string {
  return resolveMenuTitle(node.i18n_key ?? '', node.menu_name, node.menu_name_en ?? '');
}
