SET NAMES utf8mb4;
USE mtrip_system;

-- 将 M18 总览提升为独立一级页面，复用原菜单 ID、路由和角色授权。
UPDATE sys_menu
SET parent_id = 0,
    menu_name = '平台配置',
    menu_name_en = 'Platform Configuration',
    i18n_key = 'platformConfig.menuTitle',
    icon = 'SettingOutlined',
    sort = 12
WHERE id = 1314 AND perm_key = 'config:overview:list' AND deleted_at IS NULL;
