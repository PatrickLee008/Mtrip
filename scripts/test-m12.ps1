# 本地Docker集成测试：仅创建/清理mtrip_m12_s1_test内的夹具，不复制真实数据。
# 前提：已应用27/28迁移，重启商户/订单服务并等待healthz正常，确保Hyperf扫描缓存更新完成。
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
function Assert-Exit([string]$step) { if ($LASTEXITCODE -ne 0) { throw "$step failed: $LASTEXITCODE" } }
$sql = @'
CREATE DATABASE IF NOT EXISTS mtrip_m12_s1_test CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
GRANT ALL PRIVILEGES ON mtrip_m12_s1_test.* TO 'mtrip'@'%';
SELECT CONCAT('CREATE TABLE IF NOT EXISTS mtrip_m12_s1_test.`',TABLE_NAME,'` LIKE `',TABLE_SCHEMA,'`.`',TABLE_NAME,'`;') FROM information_schema.TABLES WHERE TABLE_SCHEMA IN ('mtrip_business','mtrip_system') AND TABLE_TYPE='BASE TABLE';
'@
$schema = $sql | docker exec -i mtrip-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --skip-column-names --default-character-set=utf8mb4'
Assert-Exit 'test database setup'
$schema | docker exec -i mtrip-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --default-character-set=utf8mb4'
Assert-Exit 'schema clone'
# 存量隔离库也升级结构；替换两库名称后只作用于允许的测试库。
$migration = (Get-Content (Join-Path $repo 'database/merchant/28-merchant-directory-property.sql') -Raw -Encoding utf8).Replace('mtrip_business', 'mtrip_m12_s1_test').Replace('mtrip_system', 'mtrip_m12_s1_test')
$migration | docker exec -i mtrip-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --default-character-set=utf8mb4'
Assert-Exit 'S2 test schema migration'
$s3Migration = (Get-Content (Join-Path $repo 'database/merchant/29-merchant-documents-notifications.sql') -Raw -Encoding utf8).Replace('mtrip_business', 'mtrip_m12_s1_test').Replace('mtrip_system', 'mtrip_m12_s1_test')
$s3Migration | docker exec -i mtrip-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --default-character-set=utf8mb4'
Assert-Exit 'S3 test schema migration'
$s4Migration = (Get-Content (Join-Path $repo 'database/merchant/30-merchant-account-security.sql') -Raw -Encoding utf8).Replace('mtrip_business', 'mtrip_m12_s1_test').Replace('mtrip_system', 'mtrip_m12_s1_test')
$s4Migration | docker exec -i mtrip-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --default-character-set=utf8mb4'
Assert-Exit 'S4 test schema migration'
# Dashboard reads merchant-owned promotions; a schema clone alone does not upgrade existing test tables.
$promotionMigration = (Get-Content (Join-Path $repo 'database/marketing/07-merchant-promotion-owner.sql') -Raw -Encoding utf8).Replace('mtrip_business', 'mtrip_m12_s1_test')
$promotionMigration | docker exec -i mtrip-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --default-character-set=utf8mb4'
Assert-Exit 'merchant promotion test schema migration'
$s5Migration = (Get-Content (Join-Path $repo 'database/merchant/31-merchant-marketplace.sql') -Raw -Encoding utf8).Replace('mtrip_business', 'mtrip_m12_s1_test')
$s5Migration | docker exec -i mtrip-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --default-character-set=utf8mb4'
Assert-Exit 'S5 test schema migration'
$s6Migration = (Get-Content (Join-Path $repo 'database/merchant/32-merchant-compliance.sql') -Raw -Encoding utf8).Replace('mtrip_business', 'mtrip_m12_s1_test').Replace('mtrip_system', 'mtrip_m12_s1_test')
$s6Migration | docker exec -i mtrip-mysql-1 sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --default-character-set=utf8mb4'
Assert-Exit 'S6 test schema migration'
foreach ($entry in @(@('merchant', 'm12-status.php'), @('order', 'm12-orders.php'), @('order', 'm12-dashboard.php'), @('merchant', 'm12-directory.php'), @('merchant', 'm12-s3.php'), @('merchant', 'm12-s4.php'), @('merchant', 'm12-s5.php'), @('goods', 'm12-marketplace.php'), @('merchant', 'm12-s6.php'))) {
    $service = $entry[0]
    $file = $entry[1]
    $containerName = "mtrip-$service-service-1"
    docker cp (Join-Path $repo 'backend/shared/tests/integration/M12Bootstrap.php') "${containerName}:/tmp/M12Bootstrap.php"
    Assert-Exit 'copy bootstrap'
    docker cp (Join-Path $repo "backend/services/$service-service/test/$file") "${containerName}:/tmp/$file"
    Assert-Exit 'copy test'
    docker exec -e DB_BUSINESS_DATABASE=mtrip_m12_s1_test -e DB_SYSTEM_DATABASE=mtrip_m12_s1_test $containerName php -d display_errors=1 "/tmp/$file"
    Assert-Exit "$service integration"
}
Write-Output 'M12 integration suites passed. No Git operation was performed.'
