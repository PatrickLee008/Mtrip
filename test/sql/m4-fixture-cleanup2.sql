USE mtrip_business;
DELETE FROM goods_stock_log WHERE goods_id = 999901;
SELECT COUNT(*) AS stock_log_left FROM goods_stock_log WHERE goods_id = 999901;
