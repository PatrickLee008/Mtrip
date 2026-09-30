SET NAMES utf8mb4;

-- 管理后台「实名审核」(Identity Verification Review):审核 App 资料向导第 2 步提交的实名资料。
--
--   1) user_info 补审核留痕字段:审核人 / 审核时间 / 驳回原因(驳回原因会回显给用户)
--   2) 菜单:终端用户管理(1000)下新增页面 1015 + 两个按钮权限(通过 / 驳回)
--      前后端权限键三处对齐:user:realname:list / user:realname:approve / user:realname:reject
--
-- 幂等:列按 information_schema 判存在;菜单 INSERT IGNORE。

USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'user_info' AND COLUMN_NAME = 'real_name_audit_by');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `user_info`
     ADD COLUMN `real_name_audit_by`      VARCHAR(64)  NOT NULL DEFAULT '''' COMMENT ''实名审核人'' AFTER `real_name_submit_at`,
     ADD COLUMN `real_name_audit_at`      DATETIME     NULL DEFAULT NULL   COMMENT ''实名审核时间'' AFTER `real_name_audit_by`,
     ADD COLUMN `real_name_reject_reason` VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''实名驳回原因'' AFTER `real_name_audit_at`,
     ADD KEY `idx_real_name_status` (`real_name_status`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

USE `mtrip_system`;

INSERT IGNORE INTO sys_menu
    (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, route_path, component, icon, sort)
VALUES
    (1015, 1000, '实名审核', 'Identity Verification', 'user:realname:list', 2,
     '/user/real-name', 'user/real-name/index', '', 15);

INSERT IGNORE INTO sys_menu
    (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, sort)
VALUES
    (101501, 1015, '通过实名', 'Approve', 'user:realname:approve', 3, 1),
    (101502, 1015, '驳回实名', 'Reject', 'user:realname:reject', 3, 2);

-- 超管角色补齐页面与按钮;其余角色由后台角色管理按需勾选
INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT 1, id
FROM sys_menu
WHERE id IN (1015, 101501, 101502) AND deleted_at IS NULL;
