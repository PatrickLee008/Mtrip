import type { MenuNode } from '@/api/types';
import { i18n } from './index';

/**
 * 菜单名称 i18n 映射(历史兼容)
 * 菜单多语言优先走 sys_menu.i18n_key;旧数据无 i18n_key 时,用本表把中文名兑成词条 key 兜底
 */
export const MENU_I18N: Record<string, string> = {
  数据大屏: 'menu.dashboard',
  系统配置: 'menu.config',
  站点管理: 'menu.configSite',
  全局配置: 'menu.configGlobal',
  支付渠道: 'menu.configPay',
  短信渠道: 'menu.configSms',
  存储渠道: 'menu.configStorage',
  地图配置: 'menu.configMap',
  权限模板: 'menu.configPermTpl',
  客户端版本: 'menu.configClient',
  商品: 'menu.goods',
  酒店: 'menu.goodsHotel',
  门票: 'menu.goodsTicket',
  商品分类: 'menu.goodsCategory',
  库存: 'menu.goodsStock',
  商品审核: 'menu.goodsAudit',
  订单: 'menu.order',
  全部订单: 'menu.orderAll',
  酒店订单: 'menu.orderHotel',
  门票订单: 'menu.orderTicket',
  退款: 'menu.orderRefund',
  核销: 'menu.orderVerify',
  核销记录: 'menu.verifyLog',
  财务: 'menu.finance',
  财务概览: 'menu.financeOverview',
  资金流水: 'menu.financeFlow',
  供应商结算: 'menu.financeSettle',
  商家结算: 'menu.financeMSettle',
  营销: 'menu.marketing',
  优惠券: 'menu.marketingCoupon',
  商家: 'menu.merchant',
  商家列表: 'menu.merchantList',
  商家账户: 'menu.merchantAccount',
  商家统计: 'menu.merchantStats',
  供应商: 'menu.supplier',
  供应商列表: 'menu.supplierList',
  结算: 'menu.supplierSettle',
  用户: 'menu.user',
  用户列表: 'menu.userList',
  用户反馈: 'menu.userFeedback',
  日志: 'menu.log',
  接口日志: 'menu.logApi',
  操作日志: 'menu.logOperation',
  系统: 'menu.system',
  管理员: 'menu.systemAdmin',
  角色: 'menu.systemRole',
  菜单: 'menu.systemMenu',
  回收站: 'menu.systemRecycle',
  统计: 'menu.stats',
  财务统计: 'menu.statsFinance',
  商品统计: 'menu.statsGoods',
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
 * 扩展新语言只需新增语言包,菜单数据无需变动
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
