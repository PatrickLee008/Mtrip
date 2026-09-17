/**
 * 商户端侧边栏「物业专属」菜单口径。
 *
 * 背景:左侧切换器选中 All Properties 时没有具体物业上下文,物业专属页面既无数据也无入口,
 * 因此侧边栏隐藏这些菜单;切换到具体物业后再出现。切回 All Properties 时,
 * BasicLayout 用同一份口径把停留在这些页面的用户送回「所有物业」页。
 *
 * 与 merchant_menu.module_key 的关系:menu_key='hotel' 的菜单(房型、房量与价格)在
 * user store 的 visibleMenus 里已按业务模块过滤,这里再补上「必须选中物业」这一层,
 * 供 All Properties 场景与切换跳转共用。
 */

/** 选中任意具体物业才显示(Operations 分组)。 */
export const PROPERTY_SCOPED_PATHS = ['/availability', '/order'];

/** 仅酒店物业显示(HOTEL MANAGEMENT 分组)。 */
export const HOTEL_SCOPED_PATHS = ['/rooms'];

interface SelectedProperty {
  business_type?: string;
}

/** 该菜单在当前物业上下文下是否可见 */
export function isMenuPathVisible(path: string, selected: SelectedProperty | null): boolean {
  if (PROPERTY_SCOPED_PATHS.includes(path)) return selected !== null;
  if (HOTEL_SCOPED_PATHS.includes(path)) return selected?.business_type === 'hotel';
  return true;
}
