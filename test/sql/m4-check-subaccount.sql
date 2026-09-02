USE mtrip_business;
SELECT a.id, a.admin_name, a.is_owner, a.account_type, a.merchant_id, a.store_id, a.group_id, a.status, a.auth_version, a.two_fa_status
FROM merchant_admin a WHERE a.site_id = 3 AND a.deleted_at IS NULL ORDER BY a.account_type, a.id;
SELECT ar.admin_id, ar.role_id FROM merchant_admin_role ar
JOIN merchant_admin a ON a.id = ar.admin_id
WHERE a.site_id = 3 AND a.deleted_at IS NULL AND a.is_owner = 0;
SELECT rm.role_id, m.perm_key FROM merchant_role_menu rm
JOIN merchant_menu m ON m.id = rm.menu_id
WHERE m.perm_key = 'mch:order:message';
