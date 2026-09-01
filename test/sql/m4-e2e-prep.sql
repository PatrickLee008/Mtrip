USE mtrip_business;
SELECT site_id, merchant_id, COUNT(*) AS cnt FROM order_main WHERE deleted_at IS NULL GROUP BY site_id, merchant_id ORDER BY cnt DESC LIMIT 10;
SELECT id, merchant_name, status, access_code FROM merchant_info WHERE id IN (1001,1002,1004,1007,1010);
SELECT id, site_id, merchant_id, username, status, auth_version, two_fa_status, is_owner FROM merchant_admin WHERE id IN (4001,4004,4007,4010);
