USE mtrip_business;
SELECT COUNT(*) AS total, SUM(booking_status>0) AS backfilled, SUM(booking_status=0) AS legacy FROM order_main;
SELECT booking_status, payment_status, COUNT(*) AS c FROM order_main GROUP BY booking_status, payment_status ORDER BY 1,2;
SHOW TABLES LIKE 'order_%';
SHOW TABLES LIKE 'merchant_store_goods';
SELECT id, menu_name, menu_name_en, business_scope FROM merchant_menu WHERE id=400;
SELECT COUNT(*) AS btn_count FROM merchant_menu WHERE id BETWEEN 40002 AND 40014;
SELECT COUNT(*) AS role_grants FROM merchant_role_menu WHERE menu_id BETWEEN 40002 AND 40014;
